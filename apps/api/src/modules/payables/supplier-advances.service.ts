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
  PostSupplierAdvanceApplicationDto,
  PostSupplierAdvanceDto,
} from "./dto/supplier-advances.dto.js";
import { nextPayableStatus, sumAllocations } from "./payables.rules.js";

const advanceInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  balance: true,
  applications: {
    include: {
      postedBy: { select: { id: true, displayName: true } },
      lines: {
        include: {
          payableEntry: {
            include: {
              sourceDocument: { select: { documentNumber: true } },
            },
          },
        },
      },
    },
    orderBy: { postedAt: "desc" as const },
  },
} satisfies Prisma.SupplierAdvancePaymentInclude;

type AdvanceRecord = Prisma.SupplierAdvancePaymentGetPayload<{
  include: typeof advanceInclude;
}>;

@Injectable()
export class SupplierAdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.supplierAdvancePayment.findMany({
      include: advanceInclude,
      orderBy: { postedAt: "desc" },
    });
    return {
      items: items.map((item) => this.toView(item)),
      summary: {
        originalAmount: items
          .reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0))
          .toString(),
        availableAmount: items
          .reduce(
            (sum, item) =>
              sum.add(item.balance?.availableAmount ?? new Prisma.Decimal(0)),
            new Prisma.Decimal(0),
          )
          .toString(),
      },
    };
  }

  async postAdvance(
    input: PostSupplierAdvanceDto,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0))
      throw new BadRequestException({
        code: "SUPPLIER_ADVANCE_AMOUNT_INVALID",
        detail: "供应商预付款金额必须大于零。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const id = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.supplierAdvancePayment.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (!this.sameAdvanceInput(previous, input, amount))
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一笔供应商预付款。",
                });
              return previous.id;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${input.cashAccountId}::uuid FOR UPDATE`;
            const [supplier, account] = await Promise.all([
              tx.party.findFirst({
                where: {
                  id: input.supplierId,
                  status: "ACTIVE",
                  roles: { some: { type: "SUPPLIER" } },
                },
              }),
              tx.cashAccount.findFirst({
                where: { id: input.cashAccountId, status: "ACTIVE" },
                include: { balance: true },
              }),
            ]);
            if (!supplier)
              throw new BadRequestException({
                code: "SUPPLIER_UNAVAILABLE",
                detail: "请选择启用中的供应商。",
              });
            if (!account?.balance || account.balance.amount.lt(amount))
              throw new ConflictException({
                code: "CASH_BALANCE_INSUFFICIENT",
                detail: "付款账户余额不足，不能登记供应商预付款。",
              });
            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('supplier_advance_number_seq') AS next
            `;
            const documentNumber = `YFK-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const advance = await tx.supplierAdvancePayment.create({
              data: {
                documentNumber,
                idempotencyKey,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                supplierId: input.supplierId,
                cashAccountId: input.cashAccountId,
                amount,
                notes: input.notes?.trim() || null,
                postedById: actor.id,
                balance: { create: { availableAmount: amount } },
              },
            });
            await tx.cashLedgerEntry.create({
              data: {
                cashAccountId: input.cashAccountId,
                sourceDocumentType: "SUPPLIER_ADVANCE_PAYMENT",
                sourceDocumentId: advance.id,
                amountChange: amount.negated(),
                businessDate: advance.businessDate,
                postedById: actor.id,
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: input.cashAccountId },
              data: {
                amount: { decrement: amount },
                version: { increment: 1 },
              },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "payables.supplier.advance.post",
                entityType: "SupplierAdvancePayment",
                entityId: advance.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  supplierId: input.supplierId,
                  amount: amount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "payables.supplier.advance.posted",
                aggregateType: "SupplierAdvancePayment",
                aggregateId: advance.id,
                payload: {
                  documentNumber,
                  supplierId: input.supplierId,
                  cashAccountId: input.cashAccountId,
                },
              },
            });
            return advance.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.getAdvance(id);
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        const previous = await this.prisma.supplierAdvancePayment.findUnique({
          where: { idempotencyKey },
          include: advanceInclude,
        });
        if (previous) {
          if (!this.sameAdvanceInput(previous, input, amount))
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一笔供应商预付款。",
            });
          return this.toView(previous);
        }
        throw error;
      }
    }
    this.concurrencyError();
  }

  async apply(
    advancePaymentId: string,
    input: PostSupplierAdvanceApplicationDto,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const payableIds = input.allocations.map((item) => item.payableEntryId);
    if (new Set(payableIds).size !== payableIds.length)
      throw new BadRequestException({
        code: "ADVANCE_APPLICATION_DUPLICATE",
        detail: "同一笔供应商欠款只能抵扣一次。",
      });
    if (
      input.allocations.some((item) => new Prisma.Decimal(item.amount).lte(0))
    )
      throw new BadRequestException({
        code: "ADVANCE_APPLICATION_AMOUNT_INVALID",
        detail: "预付款抵扣金额必须大于零。",
      });
    const total = sumAllocations(input.allocations.map((item) => item.amount));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const applicationId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.supplierAdvanceApplication.findUnique({
              where: { idempotencyKey },
              include: { lines: true },
            });
            if (previous) {
              if (!this.sameApplicationInput(previous, advancePaymentId, input))
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一笔预付款抵扣。",
                });
              return previous.id;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "supplier_advance_payments" WHERE "id" = ${advancePaymentId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id"::text FROM "supplier_advance_balances" WHERE "advance_payment_id" = ${advancePaymentId}::uuid FOR UPDATE`;
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "payable_entries" WHERE "id" IN (${Prisma.join(
                [...payableIds].sort().map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const [advance, payables] = await Promise.all([
              tx.supplierAdvancePayment.findUnique({
                where: { id: advancePaymentId },
                include: { balance: true },
              }),
              tx.payableEntry.findMany({
                where: { id: { in: payableIds } },
              }),
            ]);
            if (!advance?.balance)
              throw new NotFoundException({
                code: "SUPPLIER_ADVANCE_NOT_FOUND",
                detail: "供应商预付款不存在。",
              });
            if (
              input.businessDate <
              advance.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "ADVANCE_APPLICATION_DATE_INVALID",
                detail: "抵扣日期不能早于预付款业务日期。",
              });
            if (advance.balance.availableAmount.lt(total))
              throw new ConflictException({
                code: "SUPPLIER_ADVANCE_INSUFFICIENT",
                detail: "供应商预付款可用余额不足。",
              });
            if (
              payables.length !== payableIds.length ||
              payables.some((entry) => entry.supplierId !== advance.supplierId)
            )
              throw new BadRequestException({
                code: "ADVANCE_APPLICATION_PAYABLE_MISMATCH",
                detail: "只能抵扣同一供应商的有效采购欠款。",
              });
            const requested = new Map(
              input.allocations.map((item) => [
                item.payableEntryId,
                new Prisma.Decimal(item.amount),
              ]),
            );
            if (
              payables.some((entry) =>
                requested.get(entry.id)!.gt(entry.outstandingAmount),
              )
            )
              throw new ConflictException({
                code: "ADVANCE_APPLICATION_OVER_PAYABLE",
                detail: "预付款抵扣金额不能超过供应商欠款未结金额。",
              });

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('supplier_advance_application_number_seq') AS next
            `;
            const documentNumber = `YFKHX-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const application = await tx.supplierAdvanceApplication.create({
              data: {
                documentNumber,
                idempotencyKey,
                advancePaymentId,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                amount: total,
                postedById: actor.id,
                lines: {
                  create: input.allocations.map((item) => ({
                    payableEntryId: item.payableEntryId,
                    amount: new Prisma.Decimal(item.amount),
                  })),
                },
              },
            });
            await tx.supplierAdvanceApplicationPosting.create({
              data: { applicationId: application.id },
            });
            await tx.supplierAdvanceBalance.update({
              where: { advancePaymentId },
              data: {
                availableAmount: { decrement: total },
                version: { increment: 1 },
              },
            });
            for (const payable of payables) {
              const outstanding = payable.outstandingAmount.sub(
                requested.get(payable.id)!,
              );
              await tx.payableEntry.update({
                where: { id: payable.id },
                data: {
                  outstandingAmount: outstanding,
                  status: nextPayableStatus(outstanding),
                },
              });
            }
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "payables.supplier.advance.apply",
                entityType: "SupplierAdvanceApplication",
                entityId: application.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  advanceDocumentNumber: advance.documentNumber,
                  amount: total.toString(),
                  allocationCount: input.allocations.length,
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "payables.supplier.advance.applied",
                aggregateType: "SupplierAdvanceApplication",
                aggregateId: application.id,
                payload: {
                  documentNumber,
                  advancePaymentId,
                  supplierId: advance.supplierId,
                },
              },
            });
            return application.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.prisma.supplierAdvanceApplication.findUniqueOrThrow({
          where: { id: applicationId },
          include: { lines: true },
        });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        const previous =
          await this.prisma.supplierAdvanceApplication.findUnique({
            where: { idempotencyKey },
            include: { lines: true },
          });
        if (previous) {
          if (!this.sameApplicationInput(previous, advancePaymentId, input))
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一笔预付款抵扣。",
            });
          return previous;
        }
        throw error;
      }
    }
    this.concurrencyError();
  }

  private async getAdvance(id: string) {
    const item = await this.prisma.supplierAdvancePayment.findUniqueOrThrow({
      where: { id },
      include: advanceInclude,
    });
    return this.toView(item);
  }

  private toView(item: AdvanceRecord) {
    return {
      ...item,
      amount: item.amount.toString(),
      businessDate: item.businessDate.toISOString().slice(0, 10),
      postedAt: item.postedAt.toISOString(),
      balance: item.balance
        ? {
            ...item.balance,
            availableAmount: item.balance.availableAmount.toString(),
            updatedAt: item.balance.updatedAt.toISOString(),
          }
        : null,
      applications: item.applications.map((application) => ({
        ...application,
        amount: application.amount.toString(),
        businessDate: application.businessDate.toISOString().slice(0, 10),
        postedAt: application.postedAt.toISOString(),
        lines: application.lines.map((line) => ({
          ...line,
          amount: line.amount.toString(),
          createdAt: line.createdAt.toISOString(),
          payableEntry: {
            ...line.payableEntry,
            originalAmount: line.payableEntry.originalAmount.toString(),
            outstandingAmount: line.payableEntry.outstandingAmount.toString(),
            dueDate: line.payableEntry.dueDate.toISOString().slice(0, 10),
            postedAt: line.payableEntry.postedAt.toISOString(),
          },
        })),
      })),
    };
  }

  private requireIdempotencyKey(value: string) {
    if (!value || value.length < 12 || value.length > 100)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "正式供应商预付款操作必须提供 12 到 100 位幂等键。",
      });
  }

  private sameAdvanceInput(
    previous: {
      supplierId: string;
      cashAccountId: string;
      businessDate: Date;
      amount: Prisma.Decimal;
      notes: string | null;
    },
    input: PostSupplierAdvanceDto,
    amount: Prisma.Decimal,
  ) {
    return (
      previous.supplierId === input.supplierId &&
      previous.cashAccountId === input.cashAccountId &&
      previous.businessDate.toISOString().slice(0, 10) === input.businessDate &&
      previous.amount.eq(amount) &&
      previous.notes === (input.notes?.trim() || null)
    );
  }

  private sameApplicationInput(
    previous: {
      advancePaymentId: string;
      businessDate: Date;
      lines: { payableEntryId: string; amount: Prisma.Decimal }[];
    },
    advancePaymentId: string,
    input: PostSupplierAdvanceApplicationDto,
  ) {
    if (
      previous.advancePaymentId !== advancePaymentId ||
      previous.businessDate.toISOString().slice(0, 10) !== input.businessDate ||
      previous.lines.length !== input.allocations.length
    )
      return false;
    const requested = new Map(
      input.allocations.map((item) => [
        item.payableEntryId,
        new Prisma.Decimal(item.amount),
      ]),
    );
    return previous.lines.every((line) =>
      line.amount.eq(requested.get(line.payableEntryId) ?? -1),
    );
  }

  private retryable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }

  private concurrencyError(): never {
    throw new ConflictException({
      code: "SUPPLIER_ADVANCE_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时处理预付款的操作较多，请刷新后重试。",
    });
  }
}
