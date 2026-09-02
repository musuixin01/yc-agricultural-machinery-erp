import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type {
  CreateInventoryDamageDto,
  InventoryDamageLineDto,
  UpdateInventoryDamageDto,
} from "./dto/inventory-damage.dto.js";
import { calculateInventoryDamageCost } from "./inventory.rules.js";

const damageInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.InventoryDamageDocumentInclude;

type DamageRecord = Prisma.InventoryDamageDocumentGetPayload<{
  include: typeof damageInclude;
}>;

@Injectable()
export class InventoryDamageService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.inventoryDamageDocument.findMany({
      include: damageInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const costs = await this.damageCosts(items.map((item) => item.id));
    return {
      items: items.map((item) => this.toView(item, costs.get(item.id))),
    };
  }

  async get(id: string) {
    const item = await this.prisma.inventoryDamageDocument.findUnique({
      where: { id },
      include: damageInclude,
    });
    if (!item) this.notFound();
    const costs = await this.damageCosts([id]);
    return this.toView(item!, costs.get(id));
  }

  async create(input: CreateInventoryDamageDto, actor: AuthenticatedUser) {
    const lines = await this.validateAndBuildLines(input);
    const sequence = await this.prisma.$queryRaw<[{ next: bigint }]>`
      SELECT nextval('inventory_damage_number_seq') AS next
    `;
    const documentNumber = `BS-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
    const item = await this.prisma.inventoryDamageDocument.create({
      data: {
        documentNumber,
        businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
        warehouseId: input.warehouseId,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        lines: { create: lines },
      },
      include: damageInclude,
    });
    return this.toView(item);
  }

  async update(
    id: string,
    input: UpdateInventoryDamageDto,
    _actor: AuthenticatedUser,
  ) {
    const lines = await this.validateAndBuildLines(input);
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id"::text FROM "inventory_damage_documents" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await tx.inventoryDamageDocument.findUnique({
        where: { id },
        select: { status: true, version: true },
      });
      if (!current) this.notFound();
      if (current!.status !== "DRAFT" || current!.version !== input.version)
        this.stateConflict();
      await tx.inventoryDamageLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDamageLine.createMany({
        data: lines.map((line) => ({ ...line, documentId: id })),
      });
      return tx.inventoryDamageDocument.update({
        where: { id },
        data: {
          businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
          warehouseId: input.warehouseId,
          notes: input.notes?.trim() || null,
          version: { increment: 1 },
        },
        include: damageInclude,
      });
    });
    return this.toView(item);
  }

  async submit(id: string, version: number, actor: AuthenticatedUser) {
    const result = await this.prisma.inventoryDamageDocument.updateMany({
      where: { id, status: "DRAFT", version, lines: { some: {} } },
      data: {
        status: "SUBMITTED",
        submittedById: actor.id,
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const exists = await this.prisma.inventoryDamageDocument.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) this.notFound();
      this.stateConflict();
    }
    return this.get(id);
  }

  async post(
    id: string,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    await this.prisma.$transaction(
      async (tx) => {
        const previous = await tx.inventoryDamagePostingRequest.findUnique({
          where: { idempotencyKey },
        });
        if (previous) {
          if (previous.documentId !== id)
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一张报损单。",
            });
          return;
        }
        await tx.$queryRaw`SELECT "id"::text FROM "inventory_damage_documents" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const item = await tx.inventoryDamageDocument.findUnique({
          where: { id },
          include: { lines: { orderBy: { productId: "asc" } } },
        });
        if (!item) this.notFound();
        if (item!.status === "POSTED") {
          await tx.inventoryDamagePostingRequest.create({
            data: { idempotencyKey, documentId: id },
          });
          return;
        }
        if (item!.status !== "SUBMITTED")
          this.stateConflict("只有已提交的报损单才能正式过账。");

        const balances = new Map<
          string,
          {
            id: string;
            quantity: Prisma.Decimal;
            totalCost: Prisma.Decimal;
            averageCost: Prisma.Decimal;
          }
        >();
        for (const line of item!.lines) {
          await tx.$queryRaw`SELECT "id"::text FROM "inventory_balances" WHERE "warehouse_id" = ${item!.warehouseId}::uuid AND "product_id" = ${line.productId}::uuid FOR UPDATE`;
          const balance = await tx.inventoryBalance.findUnique({
            where: {
              productId_warehouseId: {
                productId: line.productId,
                warehouseId: item!.warehouseId,
              },
            },
          });
          if (!balance || balance.quantity.lt(line.quantity))
            throw new ConflictException({
              code: "DAMAGE_STOCK_INSUFFICIENT",
              detail: `${line.productNameSnapshot} 当前库存不足，不能报损 ${line.quantity.toString()} ${line.unitNameSnapshot}。`,
            });
          balances.set(line.productId, balance);
        }

        let totalCost = new Prisma.Decimal(0);
        for (const line of item!.lines) {
          const balance = balances.get(line.productId)!;
          const costAmount = calculateInventoryDamageCost(
            line.quantity.toString(),
            balance.quantity.toString(),
            balance.totalCost.toString(),
            balance.averageCost.toString(),
          );
          const nextQuantity = balance.quantity.sub(line.quantity);
          const nextTotalCost = balance.totalCost.sub(costAmount);
          if (nextQuantity.lt(0) || nextTotalCost.lt(0))
            throw new ConflictException({
              code: "DAMAGE_INVENTORY_INVALID",
              detail: `${line.productNameSnapshot} 的库存数量或成本不足，不能完成报损。`,
            });
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              quantity: nextQuantity,
              totalCost: nextQuantity.eq(0)
                ? new Prisma.Decimal(0)
                : nextTotalCost,
              averageCost: nextQuantity.eq(0)
                ? new Prisma.Decimal(0)
                : nextTotalCost
                    .div(nextQuantity)
                    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
              version: { increment: 1 },
            },
          });
          await tx.inventoryLedgerEntry.create({
            data: {
              sourceDocumentId: item!.id,
              sourceDocumentLineId: line.id,
              sourceDocumentType: "INVENTORY_DAMAGE",
              productId: line.productId,
              warehouseId: item!.warehouseId,
              quantityChange: line.quantity.negated(),
              unitCost: balance.averageCost,
              costAmount: costAmount.negated(),
              businessDate: item!.businessDate,
              postedById: actor.id,
            },
          });
          totalCost = totalCost.add(costAmount);
        }
        await tx.inventoryDamageDocument.update({
          where: { id },
          data: {
            status: "POSTED",
            postedById: actor.id,
            postedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.inventoryDamagePostingRequest.create({
          data: { idempotencyKey, documentId: id },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "inventory.damage.post",
            entityType: "InventoryDamageDocument",
            entityId: id,
            result: "SUCCESS",
            ipAddress,
            metadata: {
              documentNumber: item!.documentNumber,
              warehouseId: item!.warehouseId,
              lineCount: item!.lines.length,
              totalCost: totalCost.toString(),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: "inventory.damage.posted",
            aggregateType: "InventoryDamageDocument",
            aggregateId: id,
            payload: {
              documentNumber: item!.documentNumber,
              warehouseId: item!.warehouseId,
              lineCount: item!.lines.length,
              totalCost: totalCost.toString(),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(id);
  }

  private async validateAndBuildLines(input: CreateInventoryDamageDto) {
    const productIds = input.lines.map((line) => line.productId);
    if (new Set(productIds).size !== productIds.length)
      throw new BadRequestException({
        code: "DAMAGE_PRODUCT_DUPLICATE",
        detail: "同一商品在一张报损单中只能出现一次。",
      });
    for (const line of input.lines) {
      if (new Prisma.Decimal(line.quantity).lte(0))
        throw new BadRequestException({
          code: "DAMAGE_QUANTITY_INVALID",
          detail: "报损数量必须大于零。",
        });
      if (line.reason === "OTHER" && !line.reasonDetail?.trim())
        throw new BadRequestException({
          code: "DAMAGE_REASON_DETAIL_REQUIRED",
          detail: "选择“其他原因”时必须填写具体说明。",
        });
    }
    const [warehouse, products] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: input.warehouseId, status: "ACTIVE" },
      }),
      this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          status: "ACTIVE",
          type: { not: "SERVICE" },
        },
        include: { baseUnit: true },
      }),
    ]);
    if (!warehouse)
      throw new BadRequestException({
        code: "WAREHOUSE_UNAVAILABLE",
        detail: "请选择启用中的仓库。",
      });
    if (products.length !== productIds.length)
      throw new BadRequestException({
        code: "PRODUCT_UNAVAILABLE",
        detail: "报损只能选择启用中的实物商品。",
      });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    return input.lines.map((line: InventoryDamageLineDto) => {
      const product = productById.get(line.productId)!;
      return {
        productId: product.id,
        productNameSnapshot: product.name,
        unitNameSnapshot: product.baseUnit.name,
        quantity: new Prisma.Decimal(line.quantity),
        reason: line.reason,
        reasonDetail: line.reasonDetail?.trim() || null,
      };
    });
  }

  private async damageCosts(documentIds: string[]) {
    if (documentIds.length === 0) return new Map<string, Prisma.Decimal>();
    const entries = await this.prisma.inventoryLedgerEntry.findMany({
      where: {
        sourceDocumentType: "INVENTORY_DAMAGE",
        sourceDocumentId: { in: documentIds },
      },
      select: { sourceDocumentId: true, costAmount: true },
    });
    const result = new Map<string, Prisma.Decimal>();
    for (const entry of entries)
      result.set(
        entry.sourceDocumentId,
        (result.get(entry.sourceDocumentId) ?? new Prisma.Decimal(0)).add(
          entry.costAmount.abs(),
        ),
      );
    return result;
  }

  private toView(item: DamageRecord, totalCost = new Prisma.Decimal(0)) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      totalCost: totalCost.toString(),
      lines: item.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  private validateIdempotencyKey(value: string) {
    if (!value || value.length < 12 || value.length > 100)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "报损过账必须提供 12 到 100 位幂等键。",
      });
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "INVENTORY_DAMAGE_NOT_FOUND",
      detail: "库存报损单不存在。",
    });
  }

  private stateConflict(
    detail = "报损单状态或版本已经变化，请刷新后重试。",
  ): never {
    throw new ConflictException({ code: "DAMAGE_STATE_CONFLICT", detail });
  }
}
