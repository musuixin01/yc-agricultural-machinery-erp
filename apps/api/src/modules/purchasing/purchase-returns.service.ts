import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostPurchaseReturnDto } from "./dto/purchase-return.dto.js";
import {
  calculatePurchaseReturnSettlement,
  remainingPurchaseReturnQuantity,
} from "./purchasing.rules.js";

const returnInclude = {
  sourcePurchaseDocument: {
    select: { id: true, documentNumber: true, businessDate: true },
  },
  supplier: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  lines: {
    include: { product: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PurchaseReturnInclude;

type ReturnRecord = Prisma.PurchaseReturnGetPayload<{
  include: typeof returnInclude;
}>;

@Injectable()
export class PurchaseReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.purchaseReturn.findMany({
      include: returnInclude,
      orderBy: { postedAt: "desc" },
    });
    return {
      items: items.map((item) => this.toView(item)),
      summary: {
        totalAmount: items
          .reduce(
            (sum, item) => sum.add(item.totalAmount),
            new Prisma.Decimal(0),
          )
          .toString(),
        payableReduction: items
          .reduce(
            (sum, item) => sum.add(item.payableReduction),
            new Prisma.Decimal(0),
          )
          .toString(),
        refundAmount: items
          .reduce(
            (sum, item) => sum.add(item.refundAmount),
            new Prisma.Decimal(0),
          )
          .toString(),
      },
    };
  }

  async post(
    input: PostPurchaseReturnDto,
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
        detail: "正式采购退货必须提供 12 到 100 位幂等键。",
      });
    if (input.reason.trim().length < 2)
      throw new BadRequestException({
        code: "PURCHASE_RETURN_REASON_REQUIRED",
        detail: "请填写至少 2 个字的真实退货原因。",
      });
    const lineIds = input.lines.map((line) => line.sourcePurchaseLineId);
    if (new Set(lineIds).size !== lineIds.length)
      throw new BadRequestException({
        code: "PURCHASE_RETURN_LINE_DUPLICATE",
        detail: "同一采购商品在一张退货单中只能出现一次。",
      });
    if (input.lines.some((line) => new Prisma.Decimal(line.quantity).lte(0)))
      throw new BadRequestException({
        code: "PURCHASE_RETURN_QUANTITY_INVALID",
        detail: "退货数量必须大于零。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const returnId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.purchaseReturn.findUnique({
              where: { idempotencyKey },
              select: { id: true, sourcePurchaseDocumentId: true },
            });
            if (previous) {
              if (
                previous.sourcePurchaseDocumentId !==
                input.sourcePurchaseDocumentId
              )
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一张采购退货单。",
                });
              return previous.id;
            }

            await tx.$queryRaw`SELECT "id"::text FROM "purchase_documents" WHERE "id" = ${input.sourcePurchaseDocumentId}::uuid FOR UPDATE`;
            const source = await tx.purchaseDocument.findUnique({
              where: { id: input.sourcePurchaseDocumentId },
              include: { lines: true, payableEntry: true },
            });
            if (!source)
              throw new NotFoundException({
                code: "PURCHASE_DOCUMENT_NOT_FOUND",
                detail: "原采购入库单不存在。",
              });
            if (source.status !== "POSTED" || !source.postedAt)
              throw new ConflictException({
                code: "PURCHASE_RETURN_SOURCE_NOT_POSTED",
                detail: "只有已过账采购入库单才能办理退货。",
              });
            if (!source.payableEntry)
              throw new ConflictException({
                code: "PURCHASE_RETURN_PAYABLE_MISSING",
                detail: "原采购没有对应应付记录，不能办理正式退货。",
              });
            if (
              input.businessDate <
              source.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "PURCHASE_RETURN_DATE_INVALID",
                detail: "退货业务日期不能早于原采购业务日期。",
              });
            if (new Date(input.returnedAt) < source.postedAt)
              throw new BadRequestException({
                code: "PURCHASE_RETURN_TIME_INVALID",
                detail: "退货时间不能早于原采购入账时间。",
              });

            const sourceLines = new Map(
              source.lines.map((line) => [line.id, line]),
            );
            if (lineIds.some((id) => !sourceLines.has(id)))
              throw new BadRequestException({
                code: "PURCHASE_RETURN_LINE_MISMATCH",
                detail: "退货商品必须来自所选原采购单。",
              });
            const alreadyReturned = await tx.purchaseReturnLine.groupBy({
              by: ["sourcePurchaseLineId"],
              where: { sourcePurchaseLineId: { in: lineIds } },
              _sum: { quantity: true },
            });
            const returnedByLine = new Map(
              alreadyReturned.map((item) => [
                item.sourcePurchaseLineId,
                item._sum.quantity ?? new Prisma.Decimal(0),
              ]),
            );
            const requestedLines = input.lines.map((inputLine) => {
              const sourceLine = sourceLines.get(
                inputLine.sourcePurchaseLineId,
              )!;
              const quantity = new Prisma.Decimal(inputLine.quantity);
              const remaining = remainingPurchaseReturnQuantity(
                sourceLine.quantity,
                returnedByLine.get(sourceLine.id) ?? new Prisma.Decimal(0),
              );
              if (quantity.gt(remaining))
                throw new ConflictException({
                  code: "PURCHASE_RETURN_QUANTITY_EXCEEDED",
                  detail: `${sourceLine.productNameSnapshot} 最多还可退 ${remaining.toString()} ${sourceLine.unitNameSnapshot}。`,
                });
              return { sourceLine, quantity };
            });

            const productIds = [
              ...new Set(
                requestedLines.map((line) => line.sourceLine.productId),
              ),
            ].sort();
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "inventory_balances" WHERE "warehouse_id" = ${source.warehouseId}::uuid AND "product_id" IN (${Prisma.join(
                productIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "product_id" FOR UPDATE`,
            );
            if (input.cashAccountId) {
              await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${input.cashAccountId}::uuid FOR UPDATE`;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "payable_entries" WHERE "id" = ${source.payableEntry.id}::uuid FOR UPDATE`;

            const [balances, payable, account] = await Promise.all([
              tx.inventoryBalance.findMany({
                where: {
                  warehouseId: source.warehouseId,
                  productId: { in: productIds },
                },
              }),
              tx.payableEntry.findUniqueOrThrow({
                where: { id: source.payableEntry.id },
              }),
              input.cashAccountId
                ? tx.cashAccount.findFirst({
                    where: { id: input.cashAccountId, status: "ACTIVE" },
                    include: { balance: true },
                  })
                : null,
            ]);
            const balanceByProduct = new Map(
              balances.map((balance) => [balance.productId, balance]),
            );
            const lines = requestedLines.map(({ sourceLine, quantity }) => {
              const balance = balanceByProduct.get(sourceLine.productId);
              if (!balance || balance.quantity.lt(quantity))
                throw new ConflictException({
                  code: "PURCHASE_RETURN_STOCK_INSUFFICIENT",
                  detail: `${sourceLine.productNameSnapshot} 当前库存不足，不能退回 ${quantity.toString()} ${sourceLine.unitNameSnapshot}。`,
                });
              const unitCost = balance.averageCost;
              const costAmount = quantity.eq(balance.quantity)
                ? balance.totalCost
                : unitCost.mul(quantity).toDecimalPlaces(4);
              return {
                sourceLine,
                balance,
                quantity,
                unitCost,
                costAmount,
                lineAmount: sourceLine.unitPrice
                  .mul(quantity)
                  .toDecimalPlaces(4),
              };
            });
            const totalAmount = lines.reduce(
              (sum, line) => sum.add(line.lineAmount),
              new Prisma.Decimal(0),
            );
            const inventoryCost = lines.reduce(
              (sum, line) => sum.add(line.costAmount),
              new Prisma.Decimal(0),
            );
            const { payableReduction, refundAmount } =
              calculatePurchaseReturnSettlement(
                totalAmount,
                payable.outstandingAmount,
              );
            if (refundAmount.gt(0) && !input.cashAccountId)
              throw new BadRequestException({
                code: "PURCHASE_RETURN_REFUND_ACCOUNT_REQUIRED",
                detail: "本次供应商需要实际退款，请选择收款账户。",
              });
            if (refundAmount.gt(0) && !account?.balance)
              throw new BadRequestException({
                code: "CASH_ACCOUNT_UNAVAILABLE",
                detail: "请选择启用中的供应商退款收款账户。",
              });

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('purchase_return_number_seq') AS next
            `;
            const documentNumber = `CT-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const purchaseReturn = await tx.purchaseReturn.create({
              data: {
                documentNumber,
                idempotencyKey,
                sourcePurchaseDocumentId: source.id,
                payableEntryId: payable.id,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                returnedAt: new Date(input.returnedAt),
                supplierId: source.supplierId,
                warehouseId: source.warehouseId,
                cashAccountId: refundAmount.gt(0) ? input.cashAccountId : null,
                totalAmount,
                inventoryCost,
                payableReduction,
                refundAmount,
                reason: input.reason.trim(),
                postedById: actor.id,
                lines: {
                  create: lines.map((line) => ({
                    sourcePurchaseLineId: line.sourceLine.id,
                    productId: line.sourceLine.productId,
                    productNameSnapshot: line.sourceLine.productNameSnapshot,
                    unitNameSnapshot: line.sourceLine.unitNameSnapshot,
                    quantity: line.quantity,
                    unitPrice: line.sourceLine.unitPrice,
                    lineAmount: line.lineAmount,
                    unitCost: line.unitCost,
                    costAmount: line.costAmount,
                  })),
                },
              },
            });

            const returnLines = await tx.purchaseReturnLine.findMany({
              where: { returnId: purchaseReturn.id },
            });
            const returnLineBySource = new Map(
              returnLines.map((line) => [line.sourcePurchaseLineId, line]),
            );
            for (const line of lines) {
              const nextQuantity = line.balance.quantity.sub(line.quantity);
              const nextTotalCost = line.balance.totalCost.sub(line.costAmount);
              if (nextQuantity.lt(0) || nextTotalCost.lt(0))
                throw new ConflictException({
                  code: "PURCHASE_RETURN_INVENTORY_INVALID",
                  detail: `${line.sourceLine.productNameSnapshot} 的库存成本不足，不能完成退货。`,
                });
              await tx.inventoryBalance.update({
                where: { id: line.balance.id },
                data: {
                  quantity: nextQuantity,
                  totalCost: nextQuantity.eq(0)
                    ? new Prisma.Decimal(0)
                    : nextTotalCost,
                  averageCost: nextQuantity.eq(0)
                    ? new Prisma.Decimal(0)
                    : nextTotalCost.div(nextQuantity).toDecimalPlaces(4),
                  version: { increment: 1 },
                },
              });
              const returnLine = returnLineBySource.get(line.sourceLine.id)!;
              await tx.inventoryLedgerEntry.create({
                data: {
                  sourceDocumentId: purchaseReturn.id,
                  sourceDocumentLineId: returnLine.id,
                  sourceDocumentType: "PURCHASE_RETURN",
                  productId: line.sourceLine.productId,
                  warehouseId: source.warehouseId,
                  quantityChange: line.quantity.negated(),
                  unitCost: line.unitCost,
                  costAmount: line.costAmount.negated(),
                  businessDate: purchaseReturn.businessDate,
                  postedById: actor.id,
                },
              });
            }
            if (payableReduction.gt(0)) {
              const outstanding =
                payable.outstandingAmount.sub(payableReduction);
              await tx.payableEntry.update({
                where: { id: payable.id },
                data: {
                  outstandingAmount: outstanding,
                  status: outstanding.eq(0) ? "SETTLED" : "PARTIALLY_SETTLED",
                },
              });
            }
            if (refundAmount.gt(0) && input.cashAccountId) {
              await tx.cashLedgerEntry.create({
                data: {
                  cashAccountId: input.cashAccountId,
                  sourceDocumentType: "PURCHASE_RETURN_REFUND",
                  sourceDocumentId: purchaseReturn.id,
                  amountChange: refundAmount,
                  businessDate: purchaseReturn.businessDate,
                  postedById: actor.id,
                },
              });
              await tx.cashBalance.update({
                where: { cashAccountId: input.cashAccountId },
                data: {
                  amount: { increment: refundAmount },
                  version: { increment: 1 },
                },
              });
            }
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "purchasing.return.post",
                entityType: "PurchaseReturn",
                entityId: purchaseReturn.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  sourceDocumentNumber: source.documentNumber,
                  totalAmount: totalAmount.toString(),
                  payableReduction: payableReduction.toString(),
                  refundAmount: refundAmount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "purchasing.return.posted",
                aggregateType: "PurchaseReturn",
                aggregateId: purchaseReturn.id,
                payload: {
                  documentNumber,
                  sourcePurchaseDocumentId: source.id,
                  supplierId: source.supplierId,
                },
              },
            });
            return purchaseReturn.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        const item = await this.prisma.purchaseReturn.findUniqueOrThrow({
          where: { id: returnId },
          include: returnInclude,
        });
        return this.toView(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.purchaseReturn.findUnique({
            where: { idempotencyKey },
            include: returnInclude,
          });
          if (
            previous &&
            previous.sourcePurchaseDocumentId === input.sourcePurchaseDocumentId
          )
            return this.toView(previous);
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
      code: "PURCHASE_RETURN_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时采购退货操作较多，请刷新后重试。",
    });
  }

  private toView(item: ReturnRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      returnedAt: item.returnedAt.toISOString(),
      postedAt: item.postedAt.toISOString(),
      totalAmount: item.totalAmount.toString(),
      inventoryCost: item.inventoryCost.toString(),
      payableReduction: item.payableReduction.toString(),
      refundAmount: item.refundAmount.toString(),
      sourcePurchaseDocument: {
        ...item.sourcePurchaseDocument,
        businessDate: item.sourcePurchaseDocument.businessDate
          .toISOString()
          .slice(0, 10),
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
