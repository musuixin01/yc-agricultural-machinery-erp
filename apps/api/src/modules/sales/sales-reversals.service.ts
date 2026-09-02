import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostSalesReversalDto } from "./dto/sales-reversal.dto.js";

const reversalInclude = {
  sourceSalesDocument: {
    select: {
      id: true,
      documentNumber: true,
      settlementType: true,
      soldAt: true,
    },
  },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.SalesReversalInclude;

type ReversalRecord = Prisma.SalesReversalGetPayload<{
  include: typeof reversalInclude;
}>;

@Injectable()
export class SalesReversalsService {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    sourceSalesDocumentId: string,
    input: PostSalesReversalDto,
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
        detail: "正式冲销必须提供 12 到 100 位幂等键。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const reversalId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.salesReversal.findUnique({
              where: { idempotencyKey },
              select: { id: true },
            });
            if (previous) return previous.id;

            await tx.$queryRaw`SELECT "id"::text FROM "sales_documents" WHERE "id" = ${sourceSalesDocumentId}::uuid FOR UPDATE`;
            const source = await tx.salesDocument.findUnique({
              where: { id: sourceSalesDocumentId },
              include: { lines: true, receivableEntry: true },
            });
            if (!source)
              throw new NotFoundException({
                code: "SALES_DOCUMENT_NOT_FOUND",
                detail: "原销售出库单不存在。",
              });
            if (source.status !== "POSTED")
              throw new ConflictException({
                code: "SALES_REVERSAL_SOURCE_NOT_POSTED",
                detail: "只有尚未冲销的已过账销售单才能冲销。",
              });
            if (
              input.businessDate <
              source.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "SALES_REVERSAL_DATE_INVALID",
                detail: "冲销业务日期不能早于原销售业务日期。",
              });
            if (new Date(input.reversedAt) < source.soldAt)
              throw new BadRequestException({
                code: "SALES_REVERSAL_TIME_INVALID",
                detail: "冲销时间不能早于原销售时间。",
              });

            const returnCount = await tx.salesReturn.count({
              where: { sourceSalesDocumentId: source.id },
            });
            if (returnCount > 0)
              throw new ConflictException({
                code: "SALES_REVERSAL_HAS_RETURNS",
                detail:
                  "该销售单已经发生退货，不能整单冲销。请继续使用退货流程处理。",
              });

            if (source.settlementType === "CREDIT") {
              if (!source.receivableEntry)
                throw new ConflictException({
                  code: "SALES_REVERSAL_RECEIVABLE_MISSING",
                  detail: "原赊账销售缺少客户欠款记录，不能冲销。",
                });
              await tx.$queryRaw`SELECT "id"::text FROM "receivable_entries" WHERE "id" = ${source.receivableEntry.id}::uuid FOR UPDATE`;
              const receivable = await tx.receivableEntry.findUniqueOrThrow({
                where: { id: source.receivableEntry.id },
              });
              const allocationCount = await tx.receiptAllocation.count({
                where: {
                  receivableEntryId: receivable.id,
                  customerReceipt: { reversal: { is: null } },
                },
              });
              if (
                allocationCount > 0 ||
                !receivable.outstandingAmount.eq(receivable.originalAmount)
              )
                throw new ConflictException({
                  code: "SALES_REVERSAL_HAS_RECEIPTS",
                  detail:
                    "该赊账销售已经收到客户付款，需先完成收款反核销后才能冲销。",
                });
            }

            const productIds = [
              ...new Set(source.lines.map((line) => line.productId)),
            ].sort();
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "inventory_balances" WHERE "warehouse_id" = ${source.warehouseId}::uuid AND "product_id" IN (${Prisma.join(
                productIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "product_id" FOR UPDATE`,
            );

            if (
              source.settlementType === "IMMEDIATE" &&
              source.totalAmount.gt(0)
            ) {
              if (!source.cashAccountId)
                throw new ConflictException({
                  code: "SALES_REVERSAL_CASH_ACCOUNT_MISSING",
                  detail: "原现结销售缺少收款账户，不能冲销。",
                });
              await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${source.cashAccountId}::uuid FOR UPDATE`;
              const balance = await tx.cashBalance.findUnique({
                where: { cashAccountId: source.cashAccountId },
              });
              if (!balance || balance.amount.lt(source.totalAmount))
                throw new ConflictException({
                  code: "CASH_BALANCE_INSUFFICIENT",
                  detail: "原收款账户余额不足，不能冲销并退回全部销售款。",
                });
            }

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('sales_reversal_number_seq') AS next
            `;
            const documentNumber = `CX-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const reversal = await tx.salesReversal.create({
              data: {
                documentNumber,
                idempotencyKey,
                sourceSalesDocumentId: source.id,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                reversedAt: new Date(input.reversedAt),
                totalAmount: source.totalAmount,
                totalCost: source.totalCost,
                reason: input.reason.trim(),
                postedById: actor.id,
                lines: {
                  create: source.lines.map((line) => ({
                    sourceSalesLineId: line.id,
                    productId: line.productId,
                    productNameSnapshot: line.productNameSnapshot,
                    unitNameSnapshot: line.unitNameSnapshot,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    lineAmount: line.lineAmount,
                    unitCost: line.unitCost,
                    costAmount: line.costAmount,
                  })),
                },
              },
              include: { lines: true },
            });

            const reversalLines = new Map(
              reversal.lines.map((line) => [line.sourceSalesLineId, line]),
            );
            for (const sourceLine of source.lines) {
              const balance = await tx.inventoryBalance.findUnique({
                where: {
                  productId_warehouseId: {
                    productId: sourceLine.productId,
                    warehouseId: source.warehouseId,
                  },
                },
              });
              const nextQuantity = (
                balance?.quantity ?? new Prisma.Decimal(0)
              ).add(sourceLine.quantity);
              const nextTotalCost = (
                balance?.totalCost ?? new Prisma.Decimal(0)
              ).add(sourceLine.costAmount);
              const averageCost = nextTotalCost
                .div(nextQuantity)
                .toDecimalPlaces(4);
              if (balance)
                await tx.inventoryBalance.update({
                  where: { id: balance.id },
                  data: {
                    quantity: nextQuantity,
                    totalCost: nextTotalCost,
                    averageCost,
                    version: { increment: 1 },
                  },
                });
              else
                await tx.inventoryBalance.create({
                  data: {
                    productId: sourceLine.productId,
                    warehouseId: source.warehouseId,
                    quantity: nextQuantity,
                    totalCost: nextTotalCost,
                    averageCost,
                  },
                });
              await tx.inventoryLedgerEntry.create({
                data: {
                  sourceDocumentId: reversal.id,
                  sourceDocumentLineId: reversalLines.get(sourceLine.id)!.id,
                  sourceDocumentType: "SALES_REVERSAL",
                  productId: sourceLine.productId,
                  warehouseId: source.warehouseId,
                  quantityChange: sourceLine.quantity,
                  unitCost: sourceLine.unitCost,
                  costAmount: sourceLine.costAmount,
                  businessDate: reversal.businessDate,
                  postedById: actor.id,
                },
              });
            }

            if (source.settlementType === "CREDIT" && source.receivableEntry) {
              await tx.receivableEntry.update({
                where: { id: source.receivableEntry.id },
                data: { outstandingAmount: 0, status: "REVERSED" },
              });
            } else if (
              source.settlementType === "IMMEDIATE" &&
              source.totalAmount.gt(0) &&
              source.cashAccountId
            ) {
              await tx.cashLedgerEntry.create({
                data: {
                  cashAccountId: source.cashAccountId,
                  sourceDocumentType: "SALES_REVERSAL",
                  sourceDocumentId: reversal.id,
                  amountChange: source.totalAmount.negated(),
                  businessDate: reversal.businessDate,
                  postedById: actor.id,
                },
              });
              await tx.cashBalance.update({
                where: { cashAccountId: source.cashAccountId },
                data: {
                  amount: { decrement: source.totalAmount },
                  version: { increment: 1 },
                },
              });
            }

            await tx.salesDocument.update({
              where: { id: source.id },
              data: { status: "REVERSED", version: { increment: 1 } },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "sales.reversal.post",
                entityType: "SalesReversal",
                entityId: reversal.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  sourceDocumentNumber: source.documentNumber,
                  totalAmount: source.totalAmount.toString(),
                  reason: input.reason.trim(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "sales.reversal.posted",
                aggregateType: "SalesReversal",
                aggregateId: reversal.id,
                payload: {
                  documentNumber,
                  sourceSalesDocumentId: source.id,
                },
              },
            });
            return reversal.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        const item = await this.prisma.salesReversal.findUniqueOrThrow({
          where: { id: reversalId },
          include: reversalInclude,
        });
        return this.toView(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.salesReversal.findUnique({
            where: { idempotencyKey },
            include: reversalInclude,
          });
          if (previous) return this.toView(previous);
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 3
        )
          continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: "SALES_REVERSAL_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时冲销操作较多，请刷新后重试。",
    });
  }

  private toView(item: ReversalRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      reversedAt: item.reversedAt.toISOString(),
      postedAt: item.postedAt.toISOString(),
      totalAmount: item.totalAmount.toString(),
      totalCost: item.totalCost.toString(),
      sourceSalesDocument: {
        ...item.sourceSalesDocument,
        soldAt: item.sourceSalesDocument.soldAt.toISOString(),
      },
      lines: item.lines.map((line) => ({
        ...line,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        lineAmount: line.lineAmount.toString(),
        unitCost: line.unitCost.toString(),
        costAmount: line.costAmount.toString(),
        createdAt: line.createdAt.toISOString(),
      })),
    };
  }
}
