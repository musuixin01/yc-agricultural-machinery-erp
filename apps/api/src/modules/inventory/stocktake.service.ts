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
  CreateInventoryStocktakeDto,
  SaveInventoryStocktakeCountsDto,
} from "./dto/stocktake.dto.js";
import {
  calculateStocktakeCost,
  calculateStocktakeVariance,
} from "./inventory.rules.js";

const stocktakeInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { productNameSnapshot: "asc" as const },
  },
} satisfies Prisma.InventoryStocktakeInclude;

type StocktakeRecord = Prisma.InventoryStocktakeGetPayload<{
  include: typeof stocktakeInclude;
}>;

@Injectable()
export class StocktakeService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.inventoryStocktake.findMany({
      include: stocktakeInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async get(id: string) {
    const item = await this.prisma.inventoryStocktake.findUnique({
      where: { id },
      include: stocktakeInclude,
    });
    if (!item) this.notFound();
    return this.toView(item!);
  }

  async create(input: CreateInventoryStocktakeDto, actor: AuthenticatedUser) {
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id"::text FROM "warehouses" WHERE "id" = ${input.warehouseId}::uuid FOR UPDATE`;
          const warehouse = await tx.warehouse.findFirst({
            where: { id: input.warehouseId, status: "ACTIVE" },
          });
          if (!warehouse)
            throw new BadRequestException({
              code: "WAREHOUSE_UNAVAILABLE",
              detail: "请选择启用中的仓库。",
            });
          const balances = await tx.inventoryBalance.findMany({
            where: { warehouseId: input.warehouseId, quantity: { gt: 0 } },
            include: { product: { include: { baseUnit: true } } },
            orderBy: { productId: "asc" },
          });
          if (balances.length === 0)
            throw new BadRequestException({
              code: "STOCKTAKE_EMPTY_WAREHOUSE",
              detail: "该仓库没有可盘点的正式库存。",
            });
          const sequence = await tx.$queryRaw<[{ next: bigint }]>`
            SELECT nextval('inventory_stocktake_number_seq') AS next
          `;
          const documentNumber = `PD-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
          const item = await tx.inventoryStocktake.create({
            data: {
              documentNumber,
              businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
              warehouseId: input.warehouseId,
              notes: input.notes?.trim() || null,
              createdById: actor.id,
              lines: {
                create: balances.map((balance) => ({
                  productId: balance.productId,
                  productNameSnapshot: balance.product.name,
                  unitNameSnapshot: balance.product.baseUnit.name,
                  baselineQuantity: balance.quantity,
                  baselineTotalCost: balance.totalCost,
                  baselineAverageCost: balance.averageCost,
                  baselineBalanceVersion: balance.version,
                })),
              },
            },
            select: { id: true },
          });
          return item.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.get(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException({
          code: "STOCKTAKE_ACTIVE_EXISTS",
          detail: "该仓库已有未完成的盘点单，请先继续原盘点。",
        });
      throw error;
    }
  }

  async saveCounts(
    id: string,
    input: SaveInventoryStocktakeCountsDto,
    _actor: AuthenticatedUser,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id"::text FROM "inventory_stocktakes" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const item = await tx.inventoryStocktake.findUnique({
        where: { id },
        select: { status: true, version: true },
      });
      if (!item) this.notFound();
      if (item!.status !== "DRAFT" || item!.version !== input.version)
        this.stateConflict();
      const lineIds = input.lines.map((line) => line.lineId);
      if (new Set(lineIds).size !== lineIds.length)
        throw new BadRequestException({
          code: "STOCKTAKE_LINE_DUPLICATE",
          detail: "同一盘点商品不能重复提交。",
        });
      const lines = await tx.inventoryStocktakeLine.findMany({
        where: { stocktakeId: id, id: { in: lineIds } },
        select: { id: true, baselineQuantity: true },
      });
      if (lines.length !== lineIds.length)
        throw new BadRequestException({
          code: "STOCKTAKE_LINE_MISMATCH",
          detail: "盘点明细不属于当前单据，请刷新后重试。",
        });
      const baselineById = new Map(
        lines.map((line) => [line.id, line.baselineQuantity]),
      );
      for (const line of input.lines) {
        const counted = new Prisma.Decimal(line.countedQuantity);
        const variance = counted.sub(baselineById.get(line.lineId)!);
        await tx.inventoryStocktakeLine.update({
          where: { id: line.lineId },
          data: {
            countedQuantity: counted,
            varianceQuantity: variance,
            reason: line.reason?.trim() || null,
          },
        });
      }
      await tx.inventoryStocktake.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
    });
    return this.get(id);
  }

  async submit(id: string, version: number, actor: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id"::text FROM "inventory_stocktakes" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const item = await tx.inventoryStocktake.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!item) this.notFound();
      if (item!.status !== "DRAFT" || item!.version !== version)
        this.stateConflict();
      if (item!.lines.some((line) => line.countedQuantity === null))
        throw new BadRequestException({
          code: "STOCKTAKE_COUNTS_INCOMPLETE",
          detail: "请先录完全部商品的实盘数量。",
        });
      const missingReason = item!.lines.find(
        (line) =>
          !line.countedQuantity!.eq(line.baselineQuantity) &&
          !line.reason?.trim(),
      );
      if (missingReason)
        throw new BadRequestException({
          code: "STOCKTAKE_VARIANCE_REASON_REQUIRED",
          detail: `${missingReason.productNameSnapshot} 存在盘点差异，请填写原因。`,
        });
      await tx.inventoryStocktake.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedById: actor.id,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
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
        const previous = await tx.inventoryStocktakePostingRequest.findUnique({
          where: { idempotencyKey },
        });
        if (previous) {
          if (previous.stocktakeId !== id)
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一张盘点单。",
            });
          return;
        }
        await tx.$queryRaw`SELECT "id"::text FROM "inventory_stocktakes" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const item = await tx.inventoryStocktake.findUnique({
          where: { id },
          include: { lines: { orderBy: { productId: "asc" } } },
        });
        if (!item) this.notFound();
        if (item!.status === "POSTED") {
          await tx.inventoryStocktakePostingRequest.create({
            data: { idempotencyKey, stocktakeId: id },
          });
          return;
        }
        if (item!.status !== "SUBMITTED")
          this.stateConflict("只有已提交的盘点单才能正式过账。");

        const balances = new Map<string, { id: string }>();
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
          if (
            !balance ||
            balance.version !== line.baselineBalanceVersion ||
            !balance.quantity.eq(line.baselineQuantity) ||
            !balance.totalCost.eq(line.baselineTotalCost) ||
            !balance.averageCost.eq(line.baselineAverageCost)
          )
            throw new ConflictException({
              code: "STOCKTAKE_BASELINE_CHANGED",
              detail: `${line.productNameSnapshot} 在盘点期间发生过库存变化，请新建盘点后重试。`,
            });
          balances.set(line.productId, balance);
        }

        let gainLines = 0;
        let lossLines = 0;
        for (const line of item!.lines) {
          if (line.countedQuantity === null) this.stateConflict();
          const variance = calculateStocktakeVariance(
            line.baselineQuantity.toString(),
            line.countedQuantity!.toString(),
          );
          if (!line.varianceQuantity?.eq(variance)) this.stateConflict();
          if (variance.eq(0)) continue;
          const balance = balances.get(line.productId)!;
          const { nextTotalCost, costChange } = calculateStocktakeCost(
            line.countedQuantity!.toString(),
            line.baselineAverageCost.toString(),
            line.baselineTotalCost.toString(),
          );
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              quantity: line.countedQuantity,
              totalCost: nextTotalCost,
              averageCost: line.countedQuantity!.eq(0)
                ? new Prisma.Decimal(0)
                : line.baselineAverageCost,
              version: { increment: 1 },
            },
          });
          await tx.inventoryLedgerEntry.create({
            data: {
              sourceDocumentId: item!.id,
              sourceDocumentLineId: line.id,
              sourceDocumentType: variance.gt(0)
                ? "STOCKTAKE_GAIN"
                : "STOCKTAKE_LOSS",
              productId: line.productId,
              warehouseId: item!.warehouseId,
              quantityChange: variance,
              unitCost: line.baselineAverageCost,
              costAmount: costChange,
              businessDate: item!.businessDate,
              postedById: actor.id,
            },
          });
          if (variance.gt(0)) gainLines += 1;
          else lossLines += 1;
        }
        await tx.inventoryStocktake.update({
          where: { id },
          data: {
            status: "POSTED",
            postedById: actor.id,
            postedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.inventoryStocktakePostingRequest.create({
          data: { idempotencyKey, stocktakeId: id },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "inventory.stocktake.post",
            entityType: "InventoryStocktake",
            entityId: id,
            result: "SUCCESS",
            ipAddress,
            metadata: {
              documentNumber: item!.documentNumber,
              warehouseId: item!.warehouseId,
              lineCount: item!.lines.length,
              gainLines,
              lossLines,
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: "inventory.stocktake.posted",
            aggregateType: "InventoryStocktake",
            aggregateId: id,
            payload: {
              documentNumber: item!.documentNumber,
              warehouseId: item!.warehouseId,
              gainLines,
              lossLines,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(id);
  }

  private validateIdempotencyKey(value: string) {
    if (!value || value.length < 12 || value.length > 100)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "盘点过账必须提供 12 到 100 位幂等键。",
      });
  }

  private toView(item: StocktakeRecord) {
    const countedCount = item.lines.filter(
      (line) => line.countedQuantity !== null,
    ).length;
    const varianceCount = item.lines.filter(
      (line) => line.varianceQuantity && !line.varianceQuantity.eq(0),
    ).length;
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      progress: { counted: countedCount, total: item.lines.length },
      varianceCount,
      lines: item.lines.map((line) => ({
        ...line,
        baselineQuantity: line.baselineQuantity.toString(),
        baselineTotalCost: line.baselineTotalCost.toString(),
        baselineAverageCost: line.baselineAverageCost.toString(),
        countedQuantity: line.countedQuantity?.toString() ?? null,
        varianceQuantity: line.varianceQuantity?.toString() ?? null,
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "STOCKTAKE_NOT_FOUND",
      detail: "盘点单不存在。",
    });
  }

  private stateConflict(
    detail = "盘点单状态或版本已经变化，请刷新后重试。",
  ): never {
    throw new ConflictException({ code: "STOCKTAKE_STATE_CONFLICT", detail });
  }
}
