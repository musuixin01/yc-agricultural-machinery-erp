import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostCustomerReceiptReversalDto } from "./dto/receivables.dto.js";
import { restoredReceivableStatus } from "./receivables.rules.js";

const reversalInclude = {
  sourceCustomerReceipt: {
    select: {
      id: true,
      documentNumber: true,
      businessDate: true,
      postedAt: true,
    },
  },
  customer: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  allocations: {
    include: {
      receivableEntry: {
        include: {
          sourceDocument: { select: { id: true, documentNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.CustomerReceiptReversalInclude;

type ReversalRecord = Prisma.CustomerReceiptReversalGetPayload<{
  include: typeof reversalInclude;
}>;

@Injectable()
export class ReceiptReversalsService {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    sourceCustomerReceiptId: string,
    input: PostCustomerReceiptReversalDto,
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
        detail: "正式收款反核销必须提供 12 到 100 位幂等键。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const reversalId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.customerReceiptReversal.findUnique({
              where: { idempotencyKey },
              select: { id: true },
            });
            if (previous) return previous.id;

            await tx.$queryRaw`SELECT "id"::text FROM "customer_receipts" WHERE "id" = ${sourceCustomerReceiptId}::uuid FOR UPDATE`;
            const source = await tx.customerReceipt.findUnique({
              where: { id: sourceCustomerReceiptId },
              include: {
                reversal: true,
                allocations: { include: { receivableEntry: true } },
              },
            });
            if (!source)
              throw new NotFoundException({
                code: "CUSTOMER_RECEIPT_NOT_FOUND",
                detail: "原客户收款单不存在。",
              });
            if (source.reversal)
              throw new ConflictException({
                code: "CUSTOMER_RECEIPT_ALREADY_REVERSED",
                detail: `该收款已由 ${source.reversal.documentNumber} 完成反核销。`,
              });
            if (
              input.businessDate <
              source.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "RECEIPT_REVERSAL_DATE_INVALID",
                detail: "反核销业务日期不能早于原收款业务日期。",
              });
            if (new Date(input.reversedAt) < source.postedAt)
              throw new BadRequestException({
                code: "RECEIPT_REVERSAL_TIME_INVALID",
                detail: "反核销时间不能早于原收款入账时间。",
              });

            const sourceSalesDocumentIds = [
              ...new Set(
                source.allocations.map(
                  (allocation) => allocation.receivableEntry.sourceDocumentId,
                ),
              ),
            ];
            const downstreamReturnCount = await tx.salesReturn.count({
              where: {
                sourceSalesDocumentId: { in: sourceSalesDocumentIds },
              },
            });
            if (downstreamReturnCount > 0)
              throw new ConflictException({
                code: "RECEIPT_REVERSAL_HAS_SALES_RETURN",
                detail:
                  "相关销售单已发生退货，退货结算依赖这笔收款，暂不能直接反核销。",
              });

            const receivableIds = [
              ...new Set(
                source.allocations.map(
                  (allocation) => allocation.receivableEntryId,
                ),
              ),
            ].sort();
            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${source.cashAccountId}::uuid FOR UPDATE`;
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "receivable_entries" WHERE "id" IN (${Prisma.join(
                receivableIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const [cashBalance, entries] = await Promise.all([
              tx.cashBalance.findUnique({
                where: { cashAccountId: source.cashAccountId },
              }),
              tx.receivableEntry.findMany({
                where: { id: { in: receivableIds } },
              }),
            ]);
            if (!cashBalance || cashBalance.amount.lt(source.amount))
              throw new ConflictException({
                code: "CASH_BALANCE_INSUFFICIENT",
                detail: "原收款账户余额不足，不能撤销这笔客户收款。",
              });
            const entryById = new Map(
              entries.map((entry) => [entry.id, entry]),
            );
            for (const allocation of source.allocations) {
              const entry = entryById.get(allocation.receivableEntryId);
              if (!entry || entry.status === "REVERSED")
                throw new ConflictException({
                  code: "RECEIVABLE_UNAVAILABLE_FOR_REVERSAL",
                  detail: "相关客户欠款状态已变化，不能反核销。",
                });
              if (
                entry.outstandingAmount
                  .add(allocation.amount)
                  .gt(entry.originalAmount)
              )
                throw new ConflictException({
                  code: "RECEIVABLE_RESTORE_EXCEEDED",
                  detail: "恢复后的客户欠款会超过原欠金额，不能反核销。",
                });
            }

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('customer_receipt_reversal_number_seq') AS next
            `;
            const documentNumber = `SKCX-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const reversal = await tx.customerReceiptReversal.create({
              data: {
                documentNumber,
                idempotencyKey,
                sourceCustomerReceiptId: source.id,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                reversedAt: new Date(input.reversedAt),
                customerId: source.customerId,
                cashAccountId: source.cashAccountId,
                amount: source.amount,
                reason: input.reason.trim(),
                postedById: actor.id,
                allocations: {
                  create: source.allocations.map((allocation) => ({
                    sourceReceiptAllocationId: allocation.id,
                    receivableEntryId: allocation.receivableEntryId,
                    amount: allocation.amount,
                  })),
                },
              },
            });

            for (const allocation of source.allocations) {
              const entry = entryById.get(allocation.receivableEntryId)!;
              const outstanding = entry.outstandingAmount.add(
                allocation.amount,
              );
              await tx.receivableEntry.update({
                where: { id: entry.id },
                data: {
                  outstandingAmount: outstanding,
                  status: restoredReceivableStatus(
                    outstanding,
                    entry.originalAmount,
                  ),
                },
              });
            }
            await tx.cashLedgerEntry.create({
              data: {
                cashAccountId: source.cashAccountId,
                sourceDocumentType: "CUSTOMER_RECEIPT_REVERSAL",
                sourceDocumentId: reversal.id,
                amountChange: source.amount.negated(),
                businessDate: reversal.businessDate,
                postedById: actor.id,
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: source.cashAccountId },
              data: {
                amount: { decrement: source.amount },
                version: { increment: 1 },
              },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "receivables.receipt.reversal.post",
                entityType: "CustomerReceiptReversal",
                entityId: reversal.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  sourceDocumentNumber: source.documentNumber,
                  customerId: source.customerId,
                  amount: source.amount.toString(),
                  reason: input.reason.trim(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "receivables.receipt.reversal.posted",
                aggregateType: "CustomerReceiptReversal",
                aggregateId: reversal.id,
                payload: {
                  documentNumber,
                  sourceCustomerReceiptId: source.id,
                  customerId: source.customerId,
                  cashAccountId: source.cashAccountId,
                },
              },
            });
            return reversal.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        const item =
          await this.prisma.customerReceiptReversal.findUniqueOrThrow({
            where: { id: reversalId },
            include: reversalInclude,
          });
        return this.toView(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.customerReceiptReversal.findUnique(
            {
              where: { idempotencyKey },
              include: reversalInclude,
            },
          );
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
      code: "RECEIPT_REVERSAL_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时反核销操作较多，请刷新后重试。",
    });
  }

  private toView(item: ReversalRecord) {
    return {
      ...item,
      amount: item.amount.toString(),
      businessDate: item.businessDate.toISOString().slice(0, 10),
      reversedAt: item.reversedAt.toISOString(),
      postedAt: item.postedAt.toISOString(),
      sourceCustomerReceipt: {
        ...item.sourceCustomerReceipt,
        businessDate: item.sourceCustomerReceipt.businessDate
          .toISOString()
          .slice(0, 10),
        postedAt: item.sourceCustomerReceipt.postedAt.toISOString(),
      },
      allocations: item.allocations.map((allocation) => ({
        ...allocation,
        amount: allocation.amount.toString(),
        createdAt: allocation.createdAt.toISOString(),
        receivableEntry: {
          ...allocation.receivableEntry,
          originalAmount: allocation.receivableEntry.originalAmount.toString(),
          outstandingAmount:
            allocation.receivableEntry.outstandingAmount.toString(),
          dueDate: allocation.receivableEntry.dueDate
            .toISOString()
            .slice(0, 10),
          postedAt: allocation.receivableEntry.postedAt.toISOString(),
        },
      })),
    };
  }
}
