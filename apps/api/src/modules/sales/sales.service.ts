import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import {
  SYSTEM_WALK_IN_CUSTOMER_CODE,
  SYSTEM_WALK_IN_CUSTOMER_NAME,
} from "../parties/parties.constants.js";
import type {
  CreateSalesDocumentDto,
  SalesLineDto,
  UpdateSalesDocumentDto,
} from "./dto/sales-document.dto.js";
import {
  calculateGrossProfit,
  calculateSalesCost,
  calculateSalesLineAmount,
  salesPostingEffects,
} from "./sales.rules.js";

const documentInclude = {
  customer: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  receivableEntry: true,
  reversal: {
    include: { postedBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.SalesDocumentInclude;

type DocumentRecord = Prisma.SalesDocumentGetPayload<{
  include: typeof documentInclude;
}>;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.salesDocument.findMany({
      include: documentInclude,
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async get(id: string) {
    const item = await this.prisma.salesDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!item) this.notFound();
    return this.toView(item!);
  }

  async listReceivables(customerId?: string) {
    const items = await this.prisma.receivableEntry.findMany({
      where: {
        customerId,
        status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        sourceDocument: {
          select: {
            documentNumber: true,
            businessDate: true,
            customerNameSnapshot: true,
            customerPhoneSnapshot: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { postedAt: "asc" }],
    });
    return {
      items: items.map((item) => ({
        ...item,
        originalAmount: item.originalAmount.toString(),
        outstandingAmount: item.outstandingAmount.toString(),
        dueDate: item.dueDate.toISOString().slice(0, 10),
        postedAt: item.postedAt.toISOString(),
        sourceDocument: {
          ...item.sourceDocument,
          businessDate: item.sourceDocument.businessDate
            .toISOString()
            .slice(0, 10),
        },
      })),
    };
  }

  async create(input: CreateSalesDocumentDto, actor: AuthenticatedUser) {
    const [customer, cashAccountId] = await Promise.all([
      this.resolveCustomer(input.settlementType, input.customerId),
      this.resolveCashAccount(input.settlementType, input.cashAccountId, actor),
    ]);
    await this.validate(input, customer.id, cashAccountId);
    const lines = await this.lineData(input.lines);
    const sequence = await this.prisma.$queryRaw<[{ next: bigint }]>`
      SELECT nextval('sales_dispatch_number_seq') AS next
    `;
    const documentNumber = `XS-${this.date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
    const item = await this.prisma.salesDocument.create({
      data: {
        documentNumber,
        settlementType: input.settlementType,
        customerId: customer.id,
        customerNameSnapshot:
          input.settlementType === "CREDIT" ? customer.name : "散客",
        customerPhoneSnapshot: null,
        warehouseId: input.warehouseId,
        cashAccountId,
        businessDate: this.date(input.businessDate),
        soldAt: new Date(input.soldAt),
        dueDate: this.date(input.dueDate ?? input.businessDate),
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
  }

  async update(id: string, input: UpdateSalesDocumentDto) {
    const [customer, cashAccountId] = await Promise.all([
      this.resolveCustomer(input.settlementType, input.customerId),
      this.resolveCashAccount(input.settlementType, input.cashAccountId),
    ]);
    await this.validate(input, customer.id, cashAccountId);
    const lines = await this.lineData(input.lines);
    const item = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.salesDocument.updateMany({
        where: { id, status: "DRAFT", version: input.version },
        data: {
          settlementType: input.settlementType,
          customerId: customer.id,
          customerNameSnapshot:
            input.settlementType === "CREDIT" ? customer.name : "散客",
          customerPhoneSnapshot: null,
          warehouseId: input.warehouseId,
          cashAccountId,
          businessDate: this.date(input.businessDate),
          soldAt: new Date(input.soldAt),
          dueDate: this.date(input.dueDate ?? input.businessDate),
          totalAmount: lines.reduce(
            (sum, line) => sum.add(line.lineAmount),
            new Prisma.Decimal(0),
          ),
          notes: input.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return null;
      await tx.salesLine.deleteMany({ where: { documentId: id } });
      await tx.salesLine.createMany({
        data: lines.map((line) => ({ ...line, documentId: id })),
      });
      return tx.salesDocument.findUnique({
        where: { id },
        include: documentInclude,
      });
    });
    if (!item) this.conflict();
    return this.toView(item!);
  }

  async submit(id: string, version: number, actor: AuthenticatedUser) {
    const changed = await this.prisma.salesDocument.updateMany({
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
            const previous = await tx.salesPostingRequest.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (previous.documentId !== id)
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一张销售出库单。",
                });
              return;
            }

            const header = await tx.salesDocument.findUnique({
              where: { id },
              select: {
                warehouseId: true,
                customerId: true,
                settlementType: true,
                cashAccountId: true,
              },
            });
            if (!header) this.notFound();
            await tx.$queryRaw`SELECT "id"::text FROM "parties" WHERE "id" = ${header!.customerId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id"::text FROM "warehouses" WHERE "id" = ${header!.warehouseId}::uuid FOR UPDATE`;
            if (header!.settlementType === "IMMEDIATE") {
              if (!header!.cashAccountId)
                throw new ConflictException({
                  code: "CASH_ACCOUNT_REQUIRED",
                  detail: "现结销售必须选择收款账户。",
                });
              await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${header!.cashAccountId}::uuid FOR UPDATE`;
              await tx.$queryRaw`SELECT "id"::text FROM "cash_balances" WHERE "cash_account_id" = ${header!.cashAccountId}::uuid FOR UPDATE`;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "sales_documents" WHERE "id" = ${id}::uuid FOR UPDATE`;
            const document = await tx.salesDocument.findUnique({
              where: { id },
              include: { lines: true, customer: true },
            });
            if (!document) this.notFound();
            if (document!.status === "POSTED") {
              await tx.salesPostingRequest.create({
                data: { idempotencyKey, documentId: id },
              });
              return;
            }
            if (document!.status !== "SUBMITTED")
              this.conflict("只有已提交的销售出库单才能过账。");
            const postingEffects = salesPostingEffects(
              document!.settlementType,
            );

            if (postingEffects.createReceivable) {
              const openReceivables = await tx.receivableEntry.aggregate({
                where: {
                  customerId: document!.customerId,
                  status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
                },
                _sum: { outstandingAmount: true },
              });
              const currentReceivable =
                openReceivables._sum.outstandingAmount ?? new Prisma.Decimal(0);
              if (
                document!.customer.creditLimit.gt(0) &&
                currentReceivable
                  .add(document!.totalAmount)
                  .gt(document!.customer.creditLimit)
              )
                throw new ConflictException({
                  code: "CUSTOMER_CREDIT_LIMIT_EXCEEDED",
                  detail: "本次销售会超过客户信用额度，不能过账。",
                });
            }

            let totalCost = new Prisma.Decimal(0);
            for (const line of document!.lines) {
              const balance = await tx.inventoryBalance.findUnique({
                where: {
                  productId_warehouseId: {
                    productId: line.productId,
                    warehouseId: document!.warehouseId,
                  },
                },
              });
              if (!balance || balance.quantity.lt(line.quantity))
                throw new ConflictException({
                  code: "INVENTORY_INSUFFICIENT",
                  detail: "商品库存不足，销售出库未过账。",
                });
              const nextQuantity = balance.quantity.sub(line.quantity);
              const costAmount = nextQuantity.eq(0)
                ? balance.totalCost
                : calculateSalesCost(line.quantity, balance.averageCost);
              const rawNextTotal = balance.totalCost.sub(costAmount);
              const nextTotal =
                nextQuantity.eq(0) || rawNextTotal.lt(0)
                  ? new Prisma.Decimal(0)
                  : rawNextTotal;
              const grossProfit = calculateGrossProfit(
                line.lineAmount,
                costAmount,
              );
              totalCost = totalCost.add(costAmount);

              await tx.inventoryLedgerEntry.create({
                data: {
                  sourceDocumentId: id,
                  sourceDocumentLineId: line.id,
                  sourceDocumentType: "SALES_DISPATCH",
                  productId: line.productId,
                  warehouseId: document!.warehouseId,
                  quantityChange: line.quantity.negated(),
                  unitCost: balance.averageCost,
                  costAmount: costAmount.negated(),
                  businessDate: document!.businessDate,
                  postedById: actor.id,
                },
              });
              await tx.inventoryBalance.update({
                where: { id: balance.id },
                data: {
                  quantity: nextQuantity,
                  totalCost: nextTotal,
                  averageCost: nextQuantity.eq(0)
                    ? new Prisma.Decimal(0)
                    : balance.averageCost,
                  version: { increment: 1 },
                },
              });
              await tx.salesLine.update({
                where: { id: line.id },
                data: {
                  unitCost: balance.averageCost,
                  costAmount,
                  grossProfit,
                },
              });
            }

            if (
              postingEffects.createReceivable &&
              document!.totalAmount.gt(0)
            ) {
              await tx.receivableEntry.create({
                data: {
                  customerId: document!.customerId,
                  sourceDocumentId: id,
                  originalAmount: document!.totalAmount,
                  outstandingAmount: document!.totalAmount,
                  dueDate: document!.dueDate,
                  postedById: actor.id,
                },
              });
            }
            if (
              postingEffects.createCashInflow &&
              document!.totalAmount.gt(0)
            ) {
              if (!document!.cashAccountId)
                throw new ConflictException({
                  code: "CASH_ACCOUNT_REQUIRED",
                  detail: "现结销售必须选择收款账户。",
                });
              await tx.cashLedgerEntry.create({
                data: {
                  cashAccountId: document!.cashAccountId,
                  sourceDocumentType: "CASH_SALE",
                  sourceDocumentId: id,
                  amountChange: document!.totalAmount,
                  businessDate: document!.businessDate,
                  postedById: actor.id,
                },
              });
              const balance = await tx.cashBalance.updateMany({
                where: { cashAccountId: document!.cashAccountId },
                data: {
                  amount: { increment: document!.totalAmount },
                  version: { increment: 1 },
                },
              });
              if (balance.count !== 1)
                throw new ConflictException({
                  code: "CASH_BALANCE_UNAVAILABLE",
                  detail: "收款账户余额记录不可用，请检查资金账户。",
                });
            }
            const grossProfit = calculateGrossProfit(
              document!.totalAmount,
              totalCost,
            );
            await tx.salesDocument.update({
              where: { id },
              data: {
                status: "POSTED",
                totalCost,
                grossProfit,
                postedById: actor.id,
                postedAt: new Date(),
                version: { increment: 1 },
              },
            });
            await tx.salesPostingRequest.create({
              data: { idempotencyKey, documentId: id },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "sales.dispatch.post",
                entityType: "SalesDocument",
                entityId: id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber: document!.documentNumber,
                  lineCount: document!.lines.length,
                  totalAmount: document!.totalAmount.toString(),
                  totalCost: totalCost.toString(),
                  grossProfit: grossProfit.toString(),
                  settlementType: document!.settlementType,
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "sales.dispatch.posted",
                aggregateType: "SalesDocument",
                aggregateId: id,
                payload: {
                  documentNumber: document!.documentNumber,
                  customerId: document!.customerId,
                  warehouseId: document!.warehouseId,
                },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.get(id);
      } catch (error) {
        if (this.isRetryable(error) && attempt < 3) continue;
        this.mapConstraint(error);
        throw error;
      }
    }
    throw new ConflictException({
      code: "SALES_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时销售操作较多，请刷新库存后重试。",
    });
  }

  private async resolveCustomer(
    settlementType: "IMMEDIATE" | "CREDIT",
    customerId?: string,
  ) {
    if (settlementType === "CREDIT") {
      if (!customerId)
        throw new BadRequestException({
          code: "CREDIT_CUSTOMER_REQUIRED",
          detail: "只有登记客户后才能赊账，请选择欠款客户。",
        });
      const customer = await this.prisma.party.findFirst({
        where: {
          id: customerId,
          status: "ACTIVE",
          roles: { some: { type: "CUSTOMER" } },
        },
        select: { id: true, name: true },
      });
      if (!customer)
        throw new BadRequestException({
          code: "CUSTOMER_UNAVAILABLE",
          detail: "请选择启用中的客户。",
        });
      return customer;
    }

    const customer = await this.prisma.party.upsert({
      where: { code: SYSTEM_WALK_IN_CUSTOMER_CODE },
      update: { name: SYSTEM_WALK_IN_CUSTOMER_NAME, status: "ACTIVE" },
      create: {
        code: SYSTEM_WALK_IN_CUSTOMER_CODE,
        name: SYSTEM_WALK_IN_CUSTOMER_NAME,
        roles: { create: { type: "CUSTOMER" } },
      },
      select: { id: true, name: true },
    });
    await this.prisma.partyRole.upsert({
      where: {
        partyId_type: { partyId: customer.id, type: "CUSTOMER" },
      },
      update: {},
      create: { partyId: customer.id, type: "CUSTOMER" },
    });
    return customer;
  }

  private async resolveCashAccount(
    settlementType: "IMMEDIATE" | "CREDIT",
    cashAccountId?: string,
    actor?: AuthenticatedUser,
  ) {
    if (settlementType === "CREDIT") return null;
    if (cashAccountId) {
      const account = await this.prisma.cashAccount.findFirst({
        where: { id: cashAccountId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!account)
        throw new BadRequestException({
          code: "CASH_ACCOUNT_UNAVAILABLE",
          detail: "请选择启用中的收款账户。",
        });
      return account.id;
    }
    const existing = await this.prisma.cashAccount.findFirst({
      where: { code: "YC-CASH", status: "ACTIVE" },
      select: { id: true },
    });
    if (existing) return existing.id;
    if (!actor)
      throw new BadRequestException({
        code: "CASH_ACCOUNT_REQUIRED",
        detail: "现结销售必须选择收款账户。",
      });
    const account = await this.prisma.cashAccount.upsert({
      where: { code: "YC-CASH" },
      update: { status: "ACTIVE" },
      create: {
        code: "YC-CASH",
        name: "门店现金",
        type: "CASH",
        createdById: actor.id,
        balance: { create: { amount: 0 } },
      },
      select: { id: true },
    });
    return account.id;
  }

  private async validate(
    input: CreateSalesDocumentDto,
    customerId: string,
    cashAccountId: string | null,
  ) {
    if (
      input.settlementType === "CREDIT" &&
      (!input.dueDate ||
        this.date(input.dueDate) < this.date(input.businessDate))
    )
      throw new BadRequestException({
        code: "SALES_DUE_DATE_INVALID",
        detail: "赊账销售必须填写不早于销售日期的收款到期日。",
      });
    if (input.settlementType === "IMMEDIATE" && !cashAccountId)
      throw new BadRequestException({
        code: "CASH_ACCOUNT_REQUIRED",
        detail: "现结销售必须选择收款账户。",
      });
    const ids = input.lines.map((line) => line.productId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException({
        code: "SALES_PRODUCT_DUPLICATE",
        detail: "同一商品在一张销售出库单中只能出现一次。",
      });
    if (input.lines.some((line) => new Prisma.Decimal(line.quantity).lte(0)))
      throw new BadRequestException({
        code: "SALES_QUANTITY_INVALID",
        detail: "销售数量必须大于零。",
      });
    const [customer, warehouse, products] = await Promise.all([
      this.prisma.party.findFirst({
        where: {
          id: customerId,
          status: "ACTIVE",
          roles: { some: { type: "CUSTOMER" } },
        },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: input.warehouseId, status: "ACTIVE" },
      }),
      this.prisma.product.findMany({
        where: {
          id: { in: ids },
          status: "ACTIVE",
          type: { not: "SERVICE" },
        },
        select: { id: true, minimumSalePrice: true },
      }),
    ]);
    if (!customer)
      throw new BadRequestException({
        code: "CUSTOMER_UNAVAILABLE",
        detail: "请选择启用中的客户。",
      });
    if (!warehouse)
      throw new BadRequestException({
        code: "WAREHOUSE_UNAVAILABLE",
        detail: "请选择启用中的出库仓库。",
      });
    if (products.length !== ids.length)
      throw new BadRequestException({
        code: "PRODUCT_UNAVAILABLE",
        detail: "销售出库只能选择启用中的实物商品。",
      });
    const byId = new Map(products.map((product) => [product.id, product]));
    const belowMinimum = input.lines.some((line) => {
      const minimum = byId.get(line.productId)!.minimumSalePrice;
      return minimum.gt(0) && new Prisma.Decimal(line.unitPrice).lt(minimum);
    });
    if (belowMinimum)
      throw new BadRequestException({
        code: "SALE_PRICE_BELOW_MINIMUM",
        detail: "销售价格低于商品最低售价，当前版本不允许提交。",
      });
  }

  private async lineData(lines: SalesLineDto[]) {
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
      lineAmount: calculateSalesLineAmount(line.quantity, line.unitPrice),
    }));
  }

  private toView(item: DocumentRecord) {
    return {
      ...item,
      customer: {
        ...item.customer,
        name: item.customerNameSnapshot || item.customer.name,
      },
      businessDate: item.businessDate.toISOString().slice(0, 10),
      soldAt: item.soldAt.toISOString(),
      dueDate: item.dueDate.toISOString().slice(0, 10),
      totalAmount: item.totalAmount.toString(),
      totalCost: item.totalCost.toString(),
      grossProfit: item.grossProfit.toString(),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      receivableEntry: item.receivableEntry
        ? {
            ...item.receivableEntry,
            originalAmount: item.receivableEntry.originalAmount.toString(),
            outstandingAmount:
              item.receivableEntry.outstandingAmount.toString(),
            dueDate: item.receivableEntry.dueDate.toISOString().slice(0, 10),
            postedAt: item.receivableEntry.postedAt.toISOString(),
          }
        : null,
      reversal: item.reversal
        ? {
            ...item.reversal,
            businessDate: item.reversal.businessDate.toISOString().slice(0, 10),
            reversedAt: item.reversal.reversedAt.toISOString(),
            postedAt: item.reversal.postedAt.toISOString(),
            totalAmount: item.reversal.totalAmount.toString(),
            totalCost: item.reversal.totalCost.toString(),
          }
        : null,
      lines: item.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        lineAmount: line.lineAmount.toString(),
        unitCost: line.unitCost.toString(),
        costAmount: line.costAmount.toString(),
        grossProfit: line.grossProfit.toString(),
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "SALES_DOCUMENT_NOT_FOUND",
      detail: "销售出库单不存在。",
    });
  }

  private conflict(detail = "销售单状态或版本已经变化，请刷新后重试。"): never {
    throw new ConflictException({ code: "SALES_STATE_CONFLICT", detail });
  }

  private isRetryable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }

  private mapConstraint(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictException({
        code: "SALES_CONFLICT",
        detail: "销售单已经过账或并发处理，请刷新后核对。",
      });
  }
}
