import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostSalesReturnDto } from "./dto/sales-return.dto.js";
import {
  calculateReturnSettlement,
  remainingReturnQuantity,
} from "./sales-return.rules.js";

const returnInclude = {
  sourceSalesDocument: {
    select: {
      id: true,
      documentNumber: true,
      settlementType: true,
      soldAt: true,
    },
  },
  customer: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.SalesReturnInclude;

type ReturnRecord = Prisma.SalesReturnGetPayload<{
  include: typeof returnInclude;
}>;

@Injectable()
export class SalesReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [items, totals] = await Promise.all([
      this.prisma.salesReturn.findMany({
        include: returnInclude,
        orderBy: { postedAt: "desc" },
        take: 200,
      }),
      this.prisma.salesReturn.aggregate({
        _sum: { totalAmount: true },
      }),
    ]);
    return {
      items: items.map((item) => this.toView(item)),
      summary: {
        totalAmount: (totals._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(
          4,
        ),
      },
    };
  }

  async post(
    input: PostSalesReturnDto,
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
        detail: "正式退货必须提供 12 到 100 位幂等键。",
      });
    const lineIds = input.lines.map((line) => line.sourceSalesLineId);
    if (new Set(lineIds).size !== lineIds.length)
      throw new BadRequestException({
        code: "SALES_RETURN_LINE_DUPLICATE",
        detail: "同一销售商品在一张退货单中只能出现一次。",
      });
    if (input.lines.some((line) => new Prisma.Decimal(line.quantity).lte(0)))
      throw new BadRequestException({
        code: "SALES_RETURN_QUANTITY_INVALID",
        detail: "退货数量必须大于零。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const returnId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.salesReturn.findUnique({
              where: { idempotencyKey },
              select: { id: true },
            });
            if (previous) return previous.id;

            await tx.$queryRaw`SELECT "id"::text FROM "sales_documents" WHERE "id" = ${input.sourceSalesDocumentId}::uuid FOR UPDATE`;
            const source = await tx.salesDocument.findUnique({
              where: { id: input.sourceSalesDocumentId },
              include: { lines: true, receivableEntry: true },
            });
            if (!source)
              throw new NotFoundException({
                code: "SALES_DOCUMENT_NOT_FOUND",
                detail: "原销售出库单不存在。",
              });
            if (source.status !== "POSTED")
              throw new ConflictException({
                code: "SALES_RETURN_SOURCE_NOT_POSTED",
                detail: "只有已过账的销售出库单才能退货。",
              });
            if (new Date(input.returnedAt) < source.soldAt)
              throw new BadRequestException({
                code: "SALES_RETURN_DATE_INVALID",
                detail: "退货时间不能早于原销售时间。",
              });

            const sourceLines = new Map(
              source.lines.map((line) => [line.id, line]),
            );
            if (lineIds.some((id) => !sourceLines.has(id)))
              throw new BadRequestException({
                code: "SALES_RETURN_LINE_INVALID",
                detail: "退货商品不属于所选原销售单。",
              });
            const alreadyReturned = await tx.salesReturnLine.groupBy({
              by: ["sourceSalesLineId"],
              where: { sourceSalesLineId: { in: lineIds } },
              _sum: { quantity: true },
            });
            const returnedByLine = new Map(
              alreadyReturned.map((item) => [
                item.sourceSalesLineId,
                item._sum.quantity ?? new Prisma.Decimal(0),
              ]),
            );
            const lines = input.lines.map((inputLine) => {
              const sourceLine = sourceLines.get(inputLine.sourceSalesLineId)!;
              const quantity = new Prisma.Decimal(inputLine.quantity);
              const remaining = remainingReturnQuantity(
                sourceLine.quantity,
                returnedByLine.get(sourceLine.id) ?? new Prisma.Decimal(0),
              );
              if (quantity.gt(remaining))
                throw new ConflictException({
                  code: "SALES_RETURN_QUANTITY_EXCEEDED",
                  detail: `${sourceLine.productNameSnapshot} 最多还可退 ${remaining.toString()} ${sourceLine.unitNameSnapshot}。`,
                });
              return {
                sourceLine,
                quantity,
                lineAmount: sourceLine.unitPrice
                  .mul(quantity)
                  .toDecimalPlaces(4),
                costAmount: sourceLine.unitCost
                  .mul(quantity)
                  .toDecimalPlaces(4),
              };
            });
            const totalAmount = lines.reduce(
              (sum, line) => sum.add(line.lineAmount),
              new Prisma.Decimal(0),
            );
            const totalCost = lines.reduce(
              (sum, line) => sum.add(line.costAmount),
              new Prisma.Decimal(0),
            );
            const outstanding =
              source.receivableEntry?.outstandingAmount ??
              new Prisma.Decimal(0);
            const { receivableReduction, refundAmount } =
              calculateReturnSettlement(
                source.settlementType,
                totalAmount,
                outstanding,
              );
            const cashAccountId = refundAmount.gt(0)
              ? (input.cashAccountId ?? source.cashAccountId)
              : null;
            if (refundAmount.gt(0) && !cashAccountId)
              throw new BadRequestException({
                code: "SALES_RETURN_REFUND_ACCOUNT_REQUIRED",
                detail: "本次退货需要退款，请选择退款账户。",
              });

            const productIds = [
              ...new Set(lines.map((line) => line.sourceLine.productId)),
            ].sort();
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "inventory_balances" WHERE "warehouse_id" = ${source.warehouseId}::uuid AND "product_id" IN (${Prisma.join(
                productIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "product_id" FOR UPDATE`,
            );
            if (cashAccountId) {
              await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${cashAccountId}::uuid FOR UPDATE`;
              const account = await tx.cashAccount.findFirst({
                where: { id: cashAccountId, status: "ACTIVE" },
                include: { balance: true },
              });
              if (!account?.balance)
                throw new BadRequestException({
                  code: "CASH_ACCOUNT_UNAVAILABLE",
                  detail: "请选择启用且余额可用的退款账户。",
                });
              if (account.balance.amount.lt(refundAmount))
                throw new ConflictException({
                  code: "CASH_BALANCE_INSUFFICIENT",
                  detail: "退款账户余额不足，不能完成退货退款。",
                });
            }
            if (receivableReduction.gt(0) && source.receivableEntry)
              await tx.$queryRaw`SELECT "id"::text FROM "receivable_entries" WHERE "id" = ${source.receivableEntry.id}::uuid FOR UPDATE`;

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('sales_return_number_seq') AS next
            `;
            const documentNumber = `XT-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const salesReturn = await tx.salesReturn.create({
              data: {
                documentNumber,
                idempotencyKey,
                sourceSalesDocumentId: source.id,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                returnedAt: new Date(input.returnedAt),
                customerId: source.customerId,
                customerNameSnapshot:
                  source.customerNameSnapshot ?? "原销售客户",
                warehouseId: source.warehouseId,
                cashAccountId,
                totalAmount,
                totalCost,
                receivableReduction,
                refundAmount,
                reason: input.reason.trim(),
                postedById: actor.id,
                lines: {
                  create: lines.map(
                    ({ sourceLine, quantity, lineAmount, costAmount }) => ({
                      sourceSalesLineId: sourceLine.id,
                      productId: sourceLine.productId,
                      productNameSnapshot: sourceLine.productNameSnapshot,
                      unitNameSnapshot: sourceLine.unitNameSnapshot,
                      quantity,
                      unitPrice: sourceLine.unitPrice,
                      lineAmount,
                      unitCost: sourceLine.unitCost,
                      costAmount,
                    }),
                  ),
                },
              },
            });

            for (const { sourceLine, quantity, costAmount } of lines) {
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
              ).add(quantity);
              const nextTotalCost = (
                balance?.totalCost ?? new Prisma.Decimal(0)
              ).add(costAmount);
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
              const returnLine = await tx.salesReturnLine.findFirstOrThrow({
                where: {
                  returnId: salesReturn.id,
                  sourceSalesLineId: sourceLine.id,
                },
              });
              await tx.inventoryLedgerEntry.create({
                data: {
                  sourceDocumentId: salesReturn.id,
                  sourceDocumentLineId: returnLine.id,
                  sourceDocumentType: "SALES_RETURN",
                  productId: sourceLine.productId,
                  warehouseId: source.warehouseId,
                  quantityChange: quantity,
                  unitCost: sourceLine.unitCost,
                  costAmount,
                  businessDate: salesReturn.businessDate,
                  postedById: actor.id,
                },
              });
            }
            if (receivableReduction.gt(0) && source.receivableEntry) {
              const nextOutstanding =
                source.receivableEntry.outstandingAmount.sub(
                  receivableReduction,
                );
              await tx.receivableEntry.update({
                where: { id: source.receivableEntry.id },
                data: {
                  outstandingAmount: nextOutstanding,
                  status: nextOutstanding.eq(0)
                    ? "SETTLED"
                    : "PARTIALLY_SETTLED",
                },
              });
            }
            if (refundAmount.gt(0) && cashAccountId) {
              await tx.cashLedgerEntry.create({
                data: {
                  cashAccountId,
                  sourceDocumentType: "SALES_RETURN_REFUND",
                  sourceDocumentId: salesReturn.id,
                  amountChange: refundAmount.negated(),
                  businessDate: salesReturn.businessDate,
                  postedById: actor.id,
                },
              });
              await tx.cashBalance.update({
                where: { cashAccountId },
                data: {
                  amount: { decrement: refundAmount },
                  version: { increment: 1 },
                },
              });
            }
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "sales.return.post",
                entityType: "SalesReturn",
                entityId: salesReturn.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  sourceDocumentNumber: source.documentNumber,
                  totalAmount: totalAmount.toString(),
                  receivableReduction: receivableReduction.toString(),
                  refundAmount: refundAmount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "sales.return.posted",
                aggregateType: "SalesReturn",
                aggregateId: salesReturn.id,
                payload: {
                  documentNumber,
                  sourceSalesDocumentId: source.id,
                  customerId: source.customerId,
                },
              },
            });
            return salesReturn.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        const item = await this.prisma.salesReturn.findUniqueOrThrow({
          where: { id: returnId },
          include: returnInclude,
        });
        return this.toView(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.salesReturn.findUnique({
            where: { idempotencyKey },
            include: returnInclude,
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
      code: "SALES_RETURN_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时退货操作较多，请刷新后重试。",
    });
  }

  private toView(item: ReturnRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      returnedAt: item.returnedAt.toISOString(),
      postedAt: item.postedAt.toISOString(),
      totalAmount: item.totalAmount.toString(),
      totalCost: item.totalCost.toString(),
      receivableReduction: item.receivableReduction.toString(),
      refundAmount: item.refundAmount.toString(),
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
