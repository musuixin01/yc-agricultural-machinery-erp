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
  CreatePurchaseReceiptDto,
  PurchaseReceiptLineDto,
  UpdatePurchaseReceiptDto,
} from "./dto/purchase-receipt.dto.js";
import {
  calculateLineAmount,
  calculateMovingAverage,
} from "./purchasing.rules.js";

const documentInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  payableEntry: true,
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PurchaseDocumentInclude;

type DocumentRecord = Prisma.PurchaseDocumentGetPayload<{
  include: typeof documentInclude;
}>;

@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.purchaseDocument.findMany({
      include: documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async get(id: string) {
    const item = await this.prisma.purchaseDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!item) this.notFound();
    return this.toView(item!);
  }

  async listPayables() {
    const items = await this.prisma.payableEntry.findMany({
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        sourceDocument: { select: { documentNumber: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    return {
      items: items.map((item) => ({
        ...item,
        originalAmount: item.originalAmount.toString(),
        outstandingAmount: item.outstandingAmount.toString(),
        dueDate: item.dueDate.toISOString().slice(0, 10),
        postedAt: item.postedAt.toISOString(),
      })),
    };
  }

  async create(input: CreatePurchaseReceiptDto, actor: AuthenticatedUser) {
    await this.validate(input);
    const lines = await this.lineData(input.lines);
    try {
      const sequence = await this.prisma.$queryRaw<[{ next: bigint }]>`
        SELECT nextval('purchase_receipt_number_seq') AS next
      `;
      const number = `CGRK-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
      const item = await this.prisma.purchaseDocument.create({
        data: {
          documentNumber: number,
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          businessDate: this.date(input.businessDate),
          dueDate: this.date(input.dueDate),
          totalAmount: lines.reduce(
            (sum, line) => sum.add(line.lineAmount),
            new Prisma.Decimal(0),
          ),
          notes: input.notes?.trim() || null,
          createdById: actor.id,
          lines: { create: lines },
        },
        include: documentInclude,
      });
      return this.toView(item);
    } catch (error) {
      this.mapConstraint(error);
      throw error;
    }
  }

  async update(id: string, input: UpdatePurchaseReceiptDto) {
    await this.validate(input);
    const lines = await this.lineData(input.lines);
    const item = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.purchaseDocument.updateMany({
        where: { id, status: "DRAFT", version: input.version },
        data: {
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          businessDate: this.date(input.businessDate),
          dueDate: this.date(input.dueDate),
          totalAmount: lines.reduce(
            (sum, line) => sum.add(line.lineAmount),
            new Prisma.Decimal(0),
          ),
          notes: input.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return null;
      await tx.purchaseLine.deleteMany({ where: { documentId: id } });
      await tx.purchaseLine.createMany({
        data: lines.map((line) => ({ ...line, documentId: id })),
      });
      return tx.purchaseDocument.findUnique({
        where: { id },
        include: documentInclude,
      });
    });
    if (!item) this.conflict();
    return this.toView(item!);
  }

  async submit(id: string, version: number, actor: AuthenticatedUser) {
    const changed = await this.prisma.purchaseDocument.updateMany({
      where: { id, status: "DRAFT", version, lines: { some: {} } },
      data: {
        status: "SUBMITTED",
        submittedById: actor.id,
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) this.conflict();
    return this.get(id);
  }

  async post(
    id: string,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (
      !idempotencyKey ||
      idempotencyKey.length < 12 ||
      idempotencyKey.length > 100
    )
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "正式过账必须提供 12 到 100 位幂等键。",
      });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.purchasePostingRequest.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (previous.documentId !== id)
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一张采购入库单。",
                });
              return;
            }
            const header = await tx.purchaseDocument.findUnique({
              where: { id },
              select: { warehouseId: true },
            });
            if (!header) this.notFound();
            await tx.$queryRaw`SELECT "id"::text FROM "warehouses" WHERE "id" = ${header!.warehouseId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id"::text FROM "purchase_documents" WHERE "id" = ${id}::uuid FOR UPDATE`;
            const document = await tx.purchaseDocument.findUnique({
              where: { id },
              include: { lines: true },
            });
            if (!document) this.notFound();
            if (document!.status === "POSTED") {
              await tx.purchasePostingRequest.create({
                data: { idempotencyKey, documentId: id },
              });
              return;
            }
            if (document!.status !== "SUBMITTED")
              this.conflict("只有已提交的采购入库单才能过账。");
            for (const line of document!.lines) {
              const current = await tx.inventoryBalance.findUnique({
                where: {
                  productId_warehouseId: {
                    productId: line.productId,
                    warehouseId: document!.warehouseId,
                  },
                },
              });
              const oldQuantity = current?.quantity ?? new Prisma.Decimal(0);
              const oldTotal = current?.totalCost ?? new Prisma.Decimal(0);
              const nextQuantity = oldQuantity.add(line.quantity);
              const nextTotal = oldTotal.add(line.lineAmount);
              const nextAverage = calculateMovingAverage(
                oldQuantity,
                oldTotal,
                line.quantity,
                line.lineAmount,
              );
              await tx.inventoryLedgerEntry.create({
                data: {
                  sourceDocumentId: id,
                  sourceDocumentLineId: line.id,
                  sourceDocumentType: "PURCHASE_RECEIPT",
                  productId: line.productId,
                  warehouseId: document!.warehouseId,
                  quantityChange: line.quantity,
                  unitCost: line.unitPrice,
                  costAmount: line.lineAmount,
                  businessDate: document!.businessDate,
                  postedById: actor.id,
                },
              });
              await tx.inventoryBalance.upsert({
                where: {
                  productId_warehouseId: {
                    productId: line.productId,
                    warehouseId: document!.warehouseId,
                  },
                },
                create: {
                  productId: line.productId,
                  warehouseId: document!.warehouseId,
                  quantity: nextQuantity,
                  totalCost: nextTotal,
                  averageCost: nextAverage,
                },
                update: {
                  quantity: nextQuantity,
                  totalCost: nextTotal,
                  averageCost: nextAverage,
                  version: { increment: 1 },
                },
              });
            }
            if (document!.totalAmount.gt(0)) {
              await tx.payableEntry.create({
                data: {
                  supplierId: document!.supplierId,
                  sourceDocumentId: id,
                  originalAmount: document!.totalAmount,
                  outstandingAmount: document!.totalAmount,
                  dueDate: document!.dueDate,
                  postedById: actor.id,
                },
              });
            }
            await tx.purchaseDocument.update({
              where: { id },
              data: {
                status: "POSTED",
                postedById: actor.id,
                postedAt: new Date(),
                version: { increment: 1 },
              },
            });
            await tx.purchasePostingRequest.create({
              data: { idempotencyKey, documentId: id },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "purchasing.receipt.post",
                entityType: "PurchaseDocument",
                entityId: id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber: document!.documentNumber,
                  lineCount: document!.lines.length,
                  totalAmount: document!.totalAmount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "purchasing.receipt.posted",
                aggregateType: "PurchaseDocument",
                aggregateId: id,
                payload: {
                  documentNumber: document!.documentNumber,
                  supplierId: document!.supplierId,
                  warehouseId: document!.warehouseId,
                },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.get(id);
      } catch (error) {
        if (this.isRetryableTransaction(error) && attempt < 3) continue;
        this.mapConstraint(error);
        throw error;
      }
    }
    throw new ConflictException({
      code: "PURCHASE_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时过账的采购单较多，请刷新后重试。",
    });
  }

  private async validate(input: CreatePurchaseReceiptDto) {
    if (this.date(input.dueDate) < this.date(input.businessDate))
      throw new BadRequestException({
        code: "PURCHASE_DUE_DATE_INVALID",
        detail: "付款到期日不能早于采购业务日期。",
      });
    const ids = input.lines.map((line) => line.productId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException({
        code: "PURCHASE_PRODUCT_DUPLICATE",
        detail: "同一商品在一张采购入库单中只能出现一次。",
      });
    if (input.lines.some((line) => new Prisma.Decimal(line.quantity).lte(0)))
      throw new BadRequestException({
        code: "PURCHASE_QUANTITY_INVALID",
        detail: "采购到货数量必须大于零。",
      });
    const [supplier, warehouse, productCount] = await Promise.all([
      this.prisma.party.findFirst({
        where: {
          id: input.supplierId,
          status: "ACTIVE",
          roles: { some: { type: "SUPPLIER" } },
        },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: input.warehouseId, status: "ACTIVE" },
      }),
      this.prisma.product.count({
        where: {
          id: { in: ids },
          status: "ACTIVE",
          type: { not: "SERVICE" },
        },
      }),
    ]);
    if (!supplier)
      throw new BadRequestException({
        code: "SUPPLIER_UNAVAILABLE",
        detail: "请选择启用中的供应商。",
      });
    if (!warehouse)
      throw new BadRequestException({
        code: "WAREHOUSE_UNAVAILABLE",
        detail: "请选择启用中的收货仓库。",
      });
    if (productCount !== ids.length)
      throw new BadRequestException({
        code: "PRODUCT_UNAVAILABLE",
        detail: "采购入库只能选择启用中的实物商品。",
      });
  }

  private async lineData(lines: PurchaseReceiptLineDto[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: lines.map((line) => line.productId) } },
      include: { baseUnit: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return lines.map((line) => ({
      productId: line.productId,
      productNameSnapshot: byId.get(line.productId)!.name,
      unitNameSnapshot: byId.get(line.productId)!.baseUnit.name,
      quantity: new Prisma.Decimal(line.quantity),
      unitPrice: new Prisma.Decimal(line.unitPrice),
      lineAmount: calculateLineAmount(line.quantity, line.unitPrice),
    }));
  }

  private toView(item: DocumentRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      dueDate: item.dueDate.toISOString().slice(0, 10),
      totalAmount: item.totalAmount.toString(),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      payableEntry: item.payableEntry
        ? {
            ...item.payableEntry,
            originalAmount: item.payableEntry.originalAmount.toString(),
            outstandingAmount: item.payableEntry.outstandingAmount.toString(),
            dueDate: item.payableEntry.dueDate.toISOString().slice(0, 10),
            postedAt: item.payableEntry.postedAt.toISOString(),
          }
        : null,
      lines: item.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        lineAmount: line.lineAmount.toString(),
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "PURCHASE_DOCUMENT_NOT_FOUND",
      detail: "采购入库单不存在。",
    });
  }

  private conflict(
    detail = "采购入库单状态或版本已经变化，请刷新后重试。",
  ): never {
    throw new ConflictException({ code: "PURCHASE_STATE_CONFLICT", detail });
  }

  private mapConstraint(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException({
        code: "PURCHASE_POSTING_CONFLICT",
        detail: "采购入库单已经处理或请求键重复，请刷新后核对结果。",
      });
  }

  private isRetryableTransaction(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }
}
