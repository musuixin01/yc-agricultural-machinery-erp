import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostSupplierPaymentReversalDto } from "./dto/payables.dto.js";
import { restoredPayableStatus } from "./payables.rules.js";

const reversalInclude = {
  sourceSupplierPayment: {
    select: {
      id: true,
      documentNumber: true,
      businessDate: true,
      postedAt: true,
    },
  },
  supplier: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  allocations: {
    include: {
      payableEntry: {
        include: {
          sourceDocument: { select: { id: true, documentNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.SupplierPaymentReversalInclude;

type ReversalRecord = Prisma.SupplierPaymentReversalGetPayload<{
  include: typeof reversalInclude;
}>;

@Injectable()
export class PaymentReversalsService {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    sourceSupplierPaymentId: string,
    input: PostSupplierPaymentReversalDto,
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
        detail: "正式付款反核销必须提供 12 到 100 位幂等键。",
      });
    if (input.reason.trim().length < 2)
      throw new BadRequestException({
        code: "PAYMENT_REVERSAL_REASON_REQUIRED",
        detail: "请填写至少 2 个字的付款反核销原因。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const reversalId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.supplierPaymentReversal.findUnique({
              where: { idempotencyKey },
              select: { id: true, sourceSupplierPaymentId: true },
            });
            if (previous) {
              if (previous.sourceSupplierPaymentId !== sourceSupplierPaymentId)
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一张付款反核销单。",
                });
              return previous.id;
            }

            await tx.$queryRaw`SELECT "id"::text FROM "supplier_payments" WHERE "id" = ${sourceSupplierPaymentId}::uuid FOR UPDATE`;
            const source = await tx.supplierPayment.findUnique({
              where: { id: sourceSupplierPaymentId },
              include: {
                reversal: true,
                allocations: { include: { payableEntry: true } },
              },
            });
            if (!source)
              throw new NotFoundException({
                code: "SUPPLIER_PAYMENT_NOT_FOUND",
                detail: "原供应商付款单不存在。",
              });
            if (source.reversal)
              throw new ConflictException({
                code: "SUPPLIER_PAYMENT_ALREADY_REVERSED",
                detail: `该付款已由 ${source.reversal.documentNumber} 完成反核销。`,
              });
            if (source.status !== "POSTED" || !source.postedAt)
              throw new ConflictException({
                code: "SUPPLIER_PAYMENT_NOT_POSTED",
                detail: "只有已过账且未反核销的供应商付款才能反核销。",
              });
            if (
              input.businessDate <
              source.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "PAYMENT_REVERSAL_DATE_INVALID",
                detail: "反核销业务日期不能早于原付款业务日期。",
              });
            if (new Date(input.reversedAt) < source.postedAt)
              throw new BadRequestException({
                code: "PAYMENT_REVERSAL_TIME_INVALID",
                detail: "反核销时间不能早于原付款入账时间。",
              });

            const payableIds = [
              ...new Set(
                source.allocations.map(
                  (allocation) => allocation.payableEntryId,
                ),
              ),
            ].sort();
            if (!payableIds.length)
              throw new ConflictException({
                code: "PAYMENT_REVERSAL_ALLOCATIONS_MISSING",
                detail: "原付款没有核销明细，不能反核销。",
              });
            const purchaseDocumentIds = [
              ...new Set(
                source.allocations.map(
                  (allocation) => allocation.payableEntry.sourceDocumentId,
                ),
              ),
            ].sort();
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "purchase_documents" WHERE "id" IN (${Prisma.join(
                purchaseDocumentIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const downstreamReturnCount = await tx.purchaseReturn.count({
              where: {
                sourcePurchaseDocumentId: { in: purchaseDocumentIds },
              },
            });
            if (downstreamReturnCount > 0)
              throw new ConflictException({
                code: "PAYMENT_REVERSAL_HAS_PURCHASE_RETURN",
                detail:
                  "相关采购单已发生退货，退货结算依赖这笔付款，暂不能直接反核销。",
              });
            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${source.cashAccountId}::uuid FOR UPDATE`;
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "payable_entries" WHERE "id" IN (${Prisma.join(
                payableIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const entries = await tx.payableEntry.findMany({
              where: { id: { in: payableIds } },
            });
            const entryById = new Map(
              entries.map((entry) => [entry.id, entry]),
            );
            for (const allocation of source.allocations) {
              const entry = entryById.get(allocation.payableEntryId);
              if (!entry || entry.status === "REVERSED")
                throw new ConflictException({
                  code: "PAYABLE_UNAVAILABLE_FOR_REVERSAL",
                  detail: "相关供应商欠款状态已变化，不能反核销。",
                });
              if (
                entry.outstandingAmount
                  .add(allocation.amount)
                  .gt(entry.originalAmount)
              )
                throw new ConflictException({
                  code: "PAYABLE_RESTORE_EXCEEDED",
                  detail: "恢复后的供应商欠款会超过原欠金额，不能反核销。",
                });
            }

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('supplier_payment_reversal_number_seq') AS next
            `;
            const documentNumber = `FKCX-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const reversal = await tx.supplierPaymentReversal.create({
              data: {
                documentNumber,
                idempotencyKey,
                sourceSupplierPaymentId: source.id,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                reversedAt: new Date(input.reversedAt),
                supplierId: source.supplierId,
                cashAccountId: source.cashAccountId,
                amount: source.amount,
                reason: input.reason.trim(),
                postedById: actor.id,
                allocations: {
                  create: source.allocations.map((allocation) => ({
                    sourcePaymentAllocationId: allocation.id,
                    payableEntryId: allocation.payableEntryId,
                    amount: allocation.amount,
                  })),
                },
              },
            });

            for (const allocation of source.allocations) {
              const entry = entryById.get(allocation.payableEntryId)!;
              const outstanding = entry.outstandingAmount.add(
                allocation.amount,
              );
              await tx.payableEntry.update({
                where: { id: entry.id },
                data: {
                  outstandingAmount: outstanding,
                  status: restoredPayableStatus(
                    outstanding,
                    entry.originalAmount,
                  ),
                },
              });
            }
            await tx.cashLedgerEntry.create({
              data: {
                cashAccountId: source.cashAccountId,
                sourceDocumentType: "SUPPLIER_PAYMENT_REVERSAL",
                sourceDocumentId: reversal.id,
                amountChange: source.amount,
                businessDate: reversal.businessDate,
                postedById: actor.id,
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: source.cashAccountId },
              data: {
                amount: { increment: source.amount },
                version: { increment: 1 },
              },
            });
            await tx.supplierPayment.update({
              where: { id: source.id },
              data: { status: "REVERSED", version: { increment: 1 } },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "payables.payment.reversal.post",
                entityType: "SupplierPaymentReversal",
                entityId: reversal.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  sourceDocumentNumber: source.documentNumber,
                  supplierId: source.supplierId,
                  amount: source.amount.toString(),
                  reason: input.reason.trim(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "payables.payment.reversal.posted",
                aggregateType: "SupplierPaymentReversal",
                aggregateId: reversal.id,
                payload: {
                  documentNumber,
                  sourceSupplierPaymentId: source.id,
                  supplierId: source.supplierId,
                  cashAccountId: source.cashAccountId,
                },
              },
            });
            return reversal.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        const item =
          await this.prisma.supplierPaymentReversal.findUniqueOrThrow({
            where: { id: reversalId },
            include: reversalInclude,
          });
        return this.toView(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.supplierPaymentReversal.findUnique(
            {
              where: { idempotencyKey },
              include: reversalInclude,
            },
          );
          if (
            previous &&
            previous.sourceSupplierPaymentId === sourceSupplierPaymentId
          )
            return this.toView(previous);
          const sourceReversal =
            await this.prisma.supplierPaymentReversal.findUnique({
              where: { sourceSupplierPaymentId },
              select: { documentNumber: true },
            });
          if (sourceReversal)
            throw new ConflictException({
              code: "SUPPLIER_PAYMENT_ALREADY_REVERSED",
              detail: `该付款已由 ${sourceReversal.documentNumber} 完成反核销。`,
            });
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
      code: "PAYMENT_REVERSAL_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时付款反核销操作较多，请刷新后重试。",
    });
  }

  private toView(item: ReversalRecord) {
    return {
      ...item,
      amount: item.amount.toString(),
      businessDate: item.businessDate.toISOString().slice(0, 10),
      reversedAt: item.reversedAt.toISOString(),
      postedAt: item.postedAt.toISOString(),
      sourceSupplierPayment: {
        ...item.sourceSupplierPayment,
        businessDate: item.sourceSupplierPayment.businessDate
          .toISOString()
          .slice(0, 10),
        postedAt: item.sourceSupplierPayment.postedAt?.toISOString() ?? null,
      },
      allocations: item.allocations.map((allocation) => ({
        ...allocation,
        amount: allocation.amount.toString(),
        createdAt: allocation.createdAt.toISOString(),
        payableEntry: {
          ...allocation.payableEntry,
          originalAmount: allocation.payableEntry.originalAmount.toString(),
          outstandingAmount:
            allocation.payableEntry.outstandingAmount.toString(),
          dueDate: allocation.payableEntry.dueDate.toISOString().slice(0, 10),
          postedAt: allocation.payableEntry.postedAt.toISOString(),
        },
      })),
    };
  }
}
