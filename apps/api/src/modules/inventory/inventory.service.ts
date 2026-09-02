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
  CreateOpeningInventoryDto,
  OpeningInventoryLineDto,
  UpdateOpeningInventoryDto,
} from "./dto/opening-inventory.dto.js";
import type { CreateInitialStockDto } from "./dto/initial-stock.dto.js";
import type { QueryInventoryLedgerDto } from "./dto/inventory-ledger.dto.js";
import {
  calculateLineAmount,
  canEstablishInitialStock,
} from "./inventory.rules.js";

const documentInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.InventoryDocumentInclude;

type DocumentRecord = Prisma.InventoryDocumentGetPayload<{
  include: typeof documentInclude;
}>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listDocuments(warehouseId?: string) {
    const items = await this.prisma.inventoryDocument.findMany({
      where: { type: "OPENING", warehouseId },
      include: documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map((item) => this.toDocumentView(item)) };
  }

  async getDocument(id: string) {
    const item = await this.prisma.inventoryDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!item) this.notFound();
    return this.toDocumentView(item!);
  }

  async listBalances(warehouseId?: string) {
    const items = await this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: {
        product: {
          include: { baseUnit: true, category: true },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          categoryName: item.product.category.name,
          unitName: item.product.baseUnit.name,
          safetyStock: item.product.safetyStock.toString(),
        },
        warehouse: item.warehouse,
        quantity: item.quantity.toString(),
        totalCost: item.totalCost.toString(),
        averageCost: item.averageCost.toString(),
        version: item.version,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async listLedger(query: QueryInventoryLedgerDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException({
        code: "INVENTORY_LEDGER_DATE_RANGE_INVALID",
        detail: "开始日期不能晚于结束日期。",
      });

    const keyword = query.keyword?.trim();
    const where: Prisma.InventoryLedgerEntryWhereInput = {
      warehouseId: query.warehouseId,
      productId: query.productId,
      sourceDocumentType: query.sourceDocumentType,
      businessDate:
        query.from || query.to
          ? {
              gte: query.from
                ? new Date(`${query.from}T00:00:00.000Z`)
                : undefined,
              lte: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
            }
          : undefined,
      product: keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: "insensitive" } },
              { code: { contains: keyword, mode: "insensitive" } },
              {
                barcodes: {
                  some: { barcode: { contains: keyword, mode: "insensitive" } },
                },
              },
            ],
          }
        : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, items] = await Promise.all([
      this.prisma.inventoryLedgerEntry.count({ where }),
      this.prisma.inventoryLedgerEntry.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              baseUnit: { select: { name: true } },
            },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
          postedBy: { select: { id: true, displayName: true } },
        },
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        skip,
        take: query.pageSize,
      }),
    ]);
    const documentNumbers = await this.resolveLedgerDocumentNumbers(items);
    return {
      items: items.map((item) => ({
        id: item.id,
        sourceDocumentId: item.sourceDocumentId,
        sourceDocumentType: item.sourceDocumentType,
        sourceDocumentNumber:
          documentNumbers.get(item.sourceDocumentId) ?? null,
        product: {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          unitName: item.product.baseUnit.name,
        },
        warehouse: item.warehouse,
        location: item.location,
        quantityChange: item.quantityChange.toString(),
        unitCost: item.unitCost.toString(),
        costAmount: item.costAmount.toString(),
        businessDate: item.businessDate.toISOString().slice(0, 10),
        postedAt: item.postedAt.toISOString(),
        postedBy: item.postedBy,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  private async resolveLedgerDocumentNumbers(
    items: { sourceDocumentId: string; sourceDocumentType: string }[],
  ) {
    const idsFor = (...types: string[]) =>
      items
        .filter((item) => types.includes(item.sourceDocumentType))
        .map((item) => item.sourceDocumentId);
    const [
      inventory,
      stocktakes,
      damages,
      purchases,
      purchaseReturns,
      sales,
      salesReturns,
      salesReversals,
    ] = await Promise.all([
      this.prisma.inventoryDocument.findMany({
        where: { id: { in: idsFor("INITIAL_STOCK", "OPENING") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.inventoryStocktake.findMany({
        where: { id: { in: idsFor("STOCKTAKE_GAIN", "STOCKTAKE_LOSS") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.inventoryDamageDocument.findMany({
        where: { id: { in: idsFor("INVENTORY_DAMAGE") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.purchaseDocument.findMany({
        where: { id: { in: idsFor("PURCHASE_RECEIPT") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.purchaseReturn.findMany({
        where: { id: { in: idsFor("PURCHASE_RETURN") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.salesDocument.findMany({
        where: { id: { in: idsFor("SALES_DISPATCH", "CASH_SALE") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.salesReturn.findMany({
        where: { id: { in: idsFor("SALES_RETURN") } },
        select: { id: true, documentNumber: true },
      }),
      this.prisma.salesReversal.findMany({
        where: { id: { in: idsFor("SALES_REVERSAL") } },
        select: { id: true, documentNumber: true },
      }),
    ]);
    return new Map(
      [
        ...inventory,
        ...stocktakes,
        ...damages,
        ...purchases,
        ...purchaseReturns,
        ...sales,
        ...salesReturns,
        ...salesReversals,
      ].map((item) => [item.id, item.documentNumber]),
    );
  }

  async createOpening(
    input: CreateOpeningInventoryDto,
    actor: AuthenticatedUser,
  ) {
    await this.validateDraftInput(input);
    try {
      const sequence = await this.prisma.$queryRaw<[{ next: bigint }]>`
        SELECT nextval('opening_inventory_number_seq') AS next
      `;
      const documentNumber = `QC-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
      const item = await this.prisma.inventoryDocument.create({
        data: {
          documentNumber,
          businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
          warehouseId: input.warehouseId,
          notes: input.notes?.trim() || null,
          createdById: actor.id,
          lines: { create: await this.lineData(input.lines) },
        },
        include: documentInclude,
      });
      return this.toDocumentView(item);
    } catch (error) {
      this.mapConstraintError(error);
      throw error;
    }
  }

  async createInitialStock(
    input: CreateInitialStockDto,
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
        detail: "建档入库必须提供 12 到 100 位幂等键。",
      });
    const quantity = new Prisma.Decimal(input.quantity);
    const unitCost = new Prisma.Decimal(input.unitCost);
    if (quantity.lte(0))
      throw new BadRequestException({
        code: "INITIAL_STOCK_QUANTITY_INVALID",
        detail: "当前库存数量必须大于零。",
      });

    try {
      const documentId = await this.prisma.$transaction(
        async (tx) => {
          const previous = await tx.inventoryPostingRequest.findUnique({
            where: { idempotencyKey },
          });
          if (previous) return previous.documentId;

          await tx.$queryRaw`SELECT "id"::text FROM "products" WHERE "id" = ${input.productId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT "id"::text FROM "warehouses" WHERE "id" = ${input.warehouseId}::uuid FOR UPDATE`;
          const product = await tx.product.findFirst({
            where: {
              id: input.productId,
              status: "ACTIVE",
              type: { not: "SERVICE" },
            },
            include: { baseUnit: true },
          });
          const warehouse = await tx.warehouse.findFirst({
            where: { id: input.warehouseId, status: "ACTIVE" },
          });
          const existingLedger = await tx.inventoryLedgerEntry.count({
            where: {
              productId: input.productId,
              warehouseId: input.warehouseId,
            },
          });
          if (!product)
            throw new BadRequestException({
              code: "PRODUCT_UNAVAILABLE",
              detail: "建档入库只能使用刚建立的启用实物商品。",
            });
          if (!warehouse)
            throw new BadRequestException({
              code: "WAREHOUSE_UNAVAILABLE",
              detail: "请选择启用中的仓库。",
            });
          if (!canEstablishInitialStock(existingLedger, input.quantity))
            throw new ConflictException({
              code: "INITIAL_STOCK_ALREADY_EXISTS",
              detail: "该商品在所选仓库已经有库存记录，不能重复建档入库。",
            });

          const sequence = await tx.$queryRaw<[{ next: bigint }]>`
          SELECT nextval('initial_stock_number_seq') AS next
        `;
          const documentNumber = `JR-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
          const lineAmount = calculateLineAmount(
            input.quantity,
            input.unitCost,
          );
          const now = new Date();
          const document = await tx.inventoryDocument.create({
            data: {
              documentNumber,
              type: "INITIAL_STOCK",
              businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
              warehouseId: input.warehouseId,
              notes: "新增商品时自动建立当前库存",
              createdById: actor.id,
              lines: {
                create: {
                  productId: product.id,
                  productNameSnapshot: product.name,
                  unitNameSnapshot: product.baseUnit.name,
                  quantity,
                  unitCost,
                  lineAmount,
                },
              },
            },
            include: { lines: true },
          });
          const line = document.lines[0];
          await tx.inventoryLedgerEntry.create({
            data: {
              sourceDocumentId: document.id,
              sourceDocumentLineId: line.id,
              sourceDocumentType: "INITIAL_STOCK",
              productId: product.id,
              warehouseId: input.warehouseId,
              quantityChange: quantity,
              unitCost,
              costAmount: lineAmount,
              businessDate: document.businessDate,
              postedById: actor.id,
            },
          });
          await tx.inventoryBalance.create({
            data: {
              productId: product.id,
              warehouseId: input.warehouseId,
              quantity,
              totalCost: lineAmount,
              averageCost: unitCost,
            },
          });
          await tx.inventoryDocument.update({
            where: { id: document.id },
            data: {
              status: "POSTED",
              submittedById: actor.id,
              submittedAt: now,
              postedById: actor.id,
              postedAt: now,
              version: { increment: 1 },
            },
          });
          await tx.inventoryPostingRequest.create({
            data: {
              idempotencyKey,
              operation: "inventory.initial_stock.post",
              documentId: document.id,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: actor.id,
              action: "inventory.initial_stock.post",
              entityType: "InventoryDocument",
              entityId: document.id,
              result: "SUCCESS",
              ipAddress,
              metadata: {
                documentNumber,
                productId: product.id,
                warehouseId: input.warehouseId,
                quantity: quantity.toString(),
                unitCost: unitCost.toString(),
              },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: "inventory.initial_stock.posted",
              aggregateType: "InventoryDocument",
              aggregateId: document.id,
              payload: {
                documentNumber,
                productId: product.id,
                warehouseId: input.warehouseId,
              },
            },
          });
          return document.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
      return this.getDocument(documentId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException({
          code: "INITIAL_STOCK_CONFLICT",
          detail: "商品库存已经建立或请求正在处理中，请刷新库存核对。",
        });
      throw error;
    }
  }

  async updateOpening(
    id: string,
    input: UpdateOpeningInventoryDto,
    _actor: AuthenticatedUser,
  ) {
    await this.validateDraftInput(input);
    const data = await this.lineData(input.lines);
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.inventoryDocument.updateMany({
        where: { id, status: "DRAFT", version: input.version },
        data: {
          businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
          warehouseId: input.warehouseId,
          notes: input.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return null;
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocumentLine.createMany({
        data: data.map((line) => ({ ...line, documentId: id })),
      });
      return tx.inventoryDocument.findUnique({
        where: { id },
        include: documentInclude,
      });
    });
    if (!updated) this.stateConflict();
    return this.toDocumentView(updated!);
  }

  async submit(id: string, version: number, actor: AuthenticatedUser) {
    const current = await this.prisma.inventoryDocument.findUnique({
      where: { id },
      select: { status: true, lines: { select: { id: true } } },
    });
    if (!current) this.notFound();
    if (current!.lines.length === 0)
      throw new BadRequestException({
        code: "INVENTORY_LINES_REQUIRED",
        detail: "期初库存至少需要一行商品。",
      });
    const result = await this.prisma.inventoryDocument.updateMany({
      where: { id, status: "DRAFT", version },
      data: {
        status: "SUBMITTED",
        submittedById: actor.id,
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) this.stateConflict();
    return this.getDocument(id);
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
    ) {
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "正式过账必须提供 12 到 100 位幂等键。",
      });
    }
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const previous = await tx.inventoryPostingRequest.findUnique({
            where: { idempotencyKey },
          });
          if (previous) {
            if (previous.documentId !== id)
              throw new ConflictException({
                code: "IDEMPOTENCY_KEY_REUSED",
                detail: "该幂等键已用于另一张单据。",
              });
            return;
          }
          await tx.$queryRaw`SELECT "id"::text FROM "inventory_documents" WHERE "id" = ${id}::uuid FOR UPDATE`;
          const document = await tx.inventoryDocument.findUnique({
            where: { id },
            include: { lines: true },
          });
          if (!document) this.notFound();
          await tx.$queryRaw`SELECT "id"::text FROM "warehouses" WHERE "id" = ${document!.warehouseId}::uuid FOR UPDATE`;
          if (document!.status === "POSTED") {
            await tx.inventoryPostingRequest.create({
              data: {
                idempotencyKey,
                operation: "inventory.opening.post",
                documentId: id,
              },
            });
            return;
          }
          if (document!.status !== "SUBMITTED")
            this.stateConflict("只有已提交的期初库存单才能过账。");
          if (document!.lines.length === 0)
            throw new BadRequestException({
              code: "INVENTORY_LINES_REQUIRED",
              detail: "期初库存没有商品行。",
            });
          const existingLedger = await tx.inventoryLedgerEntry.count({
            where: { warehouseId: document!.warehouseId },
          });
          if (existingLedger > 0)
            throw new ConflictException({
              code: "OPENING_AFTER_LEDGER_FORBIDDEN",
              detail: "该仓库已有库存流水，不能再建立期初库存。",
            });
          for (const line of document!.lines) {
            await tx.inventoryLedgerEntry.create({
              data: {
                sourceDocumentId: id,
                sourceDocumentLineId: line.id,
                sourceDocumentType: "OPENING",
                productId: line.productId,
                warehouseId: document!.warehouseId,
                locationId: line.locationId,
                quantityChange: line.quantity,
                unitCost: line.unitCost,
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
                quantity: line.quantity,
                totalCost: line.lineAmount,
                averageCost: line.unitCost,
              },
              update: {
                quantity: { increment: line.quantity },
                totalCost: { increment: line.lineAmount },
                averageCost: line.unitCost,
                version: { increment: 1 },
              },
            });
          }
          await tx.inventoryDocument.update({
            where: { id },
            data: {
              status: "POSTED",
              postedById: actor.id,
              postedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await tx.inventoryPostingRequest.create({
            data: {
              idempotencyKey,
              operation: "inventory.opening.post",
              documentId: id,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: actor.id,
              action: "inventory.opening.post",
              entityType: "InventoryDocument",
              entityId: id,
              result: "SUCCESS",
              ipAddress,
              metadata: {
                documentNumber: document!.documentNumber,
                lineCount: document!.lines.length,
              },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: "inventory.opening.posted",
              aggregateType: "InventoryDocument",
              aggregateId: id,
              payload: {
                documentNumber: document!.documentNumber,
                warehouseId: document!.warehouseId,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getDocument(id);
    } catch (error) {
      this.mapConstraintError(error);
      throw error;
    }
  }

  private async validateDraftInput(input: CreateOpeningInventoryDto) {
    const productIds = input.lines.map((line) => line.productId);
    if (new Set(productIds).size !== productIds.length)
      throw new BadRequestException({
        code: "INVENTORY_PRODUCT_DUPLICATE",
        detail: "同一商品在期初单中只能出现一次。",
      });
    for (const line of input.lines) {
      if (new Prisma.Decimal(line.quantity).lte(0))
        throw new BadRequestException({
          code: "INVENTORY_QUANTITY_INVALID",
          detail: "期初数量必须大于零。",
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
        select: { id: true },
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
        detail: "期初库存只能选择启用中的实物商品。",
      });
    const locationIds = input.lines.flatMap((line) =>
      line.locationId ? [line.locationId] : [],
    );
    if (locationIds.length) {
      const count = await this.prisma.warehouseLocation.count({
        where: {
          id: { in: locationIds },
          warehouseId: input.warehouseId,
          status: "ACTIVE",
        },
      });
      if (count !== new Set(locationIds).size)
        throw new BadRequestException({
          code: "LOCATION_MISMATCH",
          detail: "库位不属于所选仓库或已停用。",
        });
    }
  }

  private async lineData(lines: OpeningInventoryLineDto[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: lines.map((line) => line.productId) } },
      include: { baseUnit: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return lines.map((line) => {
      const product = byId.get(line.productId)!;
      const quantity = new Prisma.Decimal(line.quantity);
      const unitCost = new Prisma.Decimal(line.unitCost);
      return {
        productId: line.productId,
        locationId: line.locationId || null,
        productNameSnapshot: product.name,
        unitNameSnapshot: product.baseUnit.name,
        quantity,
        unitCost,
        lineAmount: calculateLineAmount(line.quantity, line.unitCost),
      };
    });
  }

  private toDocumentView(item: DocumentRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      lines: item.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitCost: line.unitCost.toString(),
        lineAmount: line.lineAmount.toString(),
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "INVENTORY_DOCUMENT_NOT_FOUND",
      detail: "期初库存单不存在。",
    });
  }

  private stateConflict(
    detail = "单据状态或版本已经变化，请刷新后重试。",
  ): never {
    throw new ConflictException({ code: "INVENTORY_STATE_CONFLICT", detail });
  }

  private mapConstraintError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException({
        code: "OPENING_INVENTORY_EXISTS",
        detail: "该仓库已经建立期初库存单。",
      });
    }
  }
}
