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
  PostCustomerAdvanceApplicationDto,
  PostCustomerAdvanceDto,
} from "./dto/customer-advances.dto.js";
import {
  nextReceivableStatus,
  sumReceiptAllocations,
} from "./receivables.rules.js";

const advanceInclude = {
  customer: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  balance: true,
  applications: {
    include: {
      postedBy: { select: { id: true, displayName: true } },
      lines: {
        include: {
          receivableEntry: {
            include: {
              sourceDocument: { select: { documentNumber: true } },
            },
          },
        },
      },
    },
    orderBy: { postedAt: "desc" as const },
  },
} satisfies Prisma.CustomerAdvanceReceiptInclude;

type AdvanceRecord = Prisma.CustomerAdvanceReceiptGetPayload<{
  include: typeof advanceInclude;
}>;

@Injectable()
export class CustomerAdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.customerAdvanceReceipt.findMany({
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
    input: PostCustomerAdvanceDto,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0))
      throw new BadRequestException({
        code: "CUSTOMER_ADVANCE_AMOUNT_INVALID",
        detail: "客户预收款金额必须大于零。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const id = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.customerAdvanceReceipt.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (!this.sameAdvanceInput(previous, input, amount))
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一笔客户预收款。",
                });
              return previous.id;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${input.cashAccountId}::uuid FOR UPDATE`;
            const [customer, account] = await Promise.all([
              tx.party.findFirst({
                where: {
                  id: input.customerId,
                  status: "ACTIVE",
                  roles: { some: { type: "CUSTOMER" } },
                },
              }),
              tx.cashAccount.findFirst({
                where: { id: input.cashAccountId, status: "ACTIVE" },
                include: { balance: true },
              }),
            ]);
            if (!customer)
              throw new BadRequestException({
                code: "CUSTOMER_UNAVAILABLE",
                detail: "请选择启用中的客户。",
              });
            if (!account?.balance)
              throw new BadRequestException({
                code: "CASH_ACCOUNT_UNAVAILABLE",
                detail: "请选择启用且已建立余额的收款账户。",
              });
            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('customer_advance_number_seq') AS next
            `;
            const documentNumber = `YSK-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const advance = await tx.customerAdvanceReceipt.create({
              data: {
                documentNumber,
                idempotencyKey,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                customerId: input.customerId,
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
                sourceDocumentType: "CUSTOMER_ADVANCE_RECEIPT",
                sourceDocumentId: advance.id,
                amountChange: amount,
                businessDate: advance.businessDate,
                postedById: actor.id,
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: input.cashAccountId },
              data: {
                amount: { increment: amount },
                version: { increment: 1 },
              },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "receivables.customer.advance.post",
                entityType: "CustomerAdvanceReceipt",
                entityId: advance.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  customerId: input.customerId,
                  amount: amount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "receivables.customer.advance.posted",
                aggregateType: "CustomerAdvanceReceipt",
                aggregateId: advance.id,
                payload: {
                  documentNumber,
                  customerId: input.customerId,
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
        const previous = await this.prisma.customerAdvanceReceipt.findUnique({
          where: { idempotencyKey },
          include: advanceInclude,
        });
        if (previous) {
          if (!this.sameAdvanceInput(previous, input, amount))
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一笔客户预收款。",
            });
          return this.toView(previous);
        }
        throw error;
      }
    }
    this.concurrencyError();
  }

  async apply(
    advanceReceiptId: string,
    input: PostCustomerAdvanceApplicationDto,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const receivableIds = input.allocations.map(
      (item) => item.receivableEntryId,
    );
    if (new Set(receivableIds).size !== receivableIds.length)
      throw new BadRequestException({
        code: "ADVANCE_APPLICATION_DUPLICATE",
        detail: "同一笔客户欠款只能抵扣一次。",
      });
    if (
      input.allocations.some((item) => new Prisma.Decimal(item.amount).lte(0))
    )
      throw new BadRequestException({
        code: "ADVANCE_APPLICATION_AMOUNT_INVALID",
        detail: "预收款抵扣金额必须大于零。",
      });
    const total = sumReceiptAllocations(
      input.allocations.map((item) => item.amount),
    );

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const applicationId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.customerAdvanceApplication.findUnique({
              where: { idempotencyKey },
              include: { lines: true },
            });
            if (previous) {
              if (!this.sameApplicationInput(previous, advanceReceiptId, input))
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一笔预收款抵扣。",
                });
              return previous.id;
            }
            await tx.$queryRaw`SELECT "id"::text FROM "customer_advance_receipts" WHERE "id" = ${advanceReceiptId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id"::text FROM "customer_advance_balances" WHERE "advance_receipt_id" = ${advanceReceiptId}::uuid FOR UPDATE`;
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "receivable_entries" WHERE "id" IN (${Prisma.join(
                [...receivableIds].sort().map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const [advance, receivables] = await Promise.all([
              tx.customerAdvanceReceipt.findUnique({
                where: { id: advanceReceiptId },
                include: { balance: true },
              }),
              tx.receivableEntry.findMany({
                where: { id: { in: receivableIds } },
              }),
            ]);
            if (!advance?.balance)
              throw new NotFoundException({
                code: "CUSTOMER_ADVANCE_NOT_FOUND",
                detail: "客户预收款不存在。",
              });
            if (
              input.businessDate <
              advance.businessDate.toISOString().slice(0, 10)
            )
              throw new BadRequestException({
                code: "ADVANCE_APPLICATION_DATE_INVALID",
                detail: "抵扣日期不能早于预收款业务日期。",
              });
            if (advance.balance.availableAmount.lt(total))
              throw new ConflictException({
                code: "CUSTOMER_ADVANCE_INSUFFICIENT",
                detail: "客户预收款可用余额不足。",
              });
            if (
              receivables.length !== receivableIds.length ||
              receivables.some(
                (entry) => entry.customerId !== advance.customerId,
              )
            )
              throw new BadRequestException({
                code: "ADVANCE_APPLICATION_RECEIVABLE_MISMATCH",
                detail: "只能抵扣同一客户的有效销售欠款。",
              });
            const requested = new Map(
              input.allocations.map((item) => [
                item.receivableEntryId,
                new Prisma.Decimal(item.amount),
              ]),
            );
            if (
              receivables.some((entry) =>
                requested.get(entry.id)!.gt(entry.outstandingAmount),
              )
            )
              throw new ConflictException({
                code: "ADVANCE_APPLICATION_OVER_RECEIVABLE",
                detail: "预收款抵扣金额不能超过客户欠款未结金额。",
              });

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('customer_advance_application_number_seq') AS next
            `;
            const documentNumber = `YSKHX-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const application = await tx.customerAdvanceApplication.create({
              data: {
                documentNumber,
                idempotencyKey,
                advanceReceiptId,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                amount: total,
                postedById: actor.id,
                lines: {
                  create: input.allocations.map((item) => ({
                    receivableEntryId: item.receivableEntryId,
                    amount: new Prisma.Decimal(item.amount),
                  })),
                },
              },
            });
            await tx.customerAdvanceApplicationPosting.create({
              data: { applicationId: application.id },
            });
            await tx.customerAdvanceBalance.update({
              where: { advanceReceiptId },
              data: {
                availableAmount: { decrement: total },
                version: { increment: 1 },
              },
            });
            for (const receivable of receivables) {
              const outstanding = receivable.outstandingAmount.sub(
                requested.get(receivable.id)!,
              );
              await tx.receivableEntry.update({
                where: { id: receivable.id },
                data: {
                  outstandingAmount: outstanding,
                  status: nextReceivableStatus(outstanding),
                },
              });
            }
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "receivables.customer.advance.apply",
                entityType: "CustomerAdvanceApplication",
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
                eventType: "receivables.customer.advance.applied",
                aggregateType: "CustomerAdvanceApplication",
                aggregateId: application.id,
                payload: {
                  documentNumber,
                  advanceReceiptId,
                  customerId: advance.customerId,
                },
              },
            });
            return application.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.prisma.customerAdvanceApplication.findUniqueOrThrow({
          where: { id: applicationId },
          include: { lines: true },
        });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        const previous =
          await this.prisma.customerAdvanceApplication.findUnique({
            where: { idempotencyKey },
            include: { lines: true },
          });
        if (previous) {
          if (!this.sameApplicationInput(previous, advanceReceiptId, input))
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              detail: "该幂等键已用于另一笔预收款抵扣。",
            });
          return previous;
        }
        throw error;
      }
    }
    this.concurrencyError();
  }

  private async getAdvance(id: string) {
    const item = await this.prisma.customerAdvanceReceipt.findUniqueOrThrow({
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
          receivableEntry: {
            ...line.receivableEntry,
            originalAmount: line.receivableEntry.originalAmount.toString(),
            outstandingAmount:
              line.receivableEntry.outstandingAmount.toString(),
            dueDate: line.receivableEntry.dueDate.toISOString().slice(0, 10),
            postedAt: line.receivableEntry.postedAt.toISOString(),
          },
        })),
      })),
    };
  }

  private requireIdempotencyKey(value: string) {
    if (!value || value.length < 12 || value.length > 100)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "正式客户预收款操作必须提供 12 到 100 位幂等键。",
      });
  }

  private sameAdvanceInput(
    previous: {
      customerId: string;
      cashAccountId: string;
      businessDate: Date;
      amount: Prisma.Decimal;
      notes: string | null;
    },
    input: PostCustomerAdvanceDto,
    amount: Prisma.Decimal,
  ) {
    return (
      previous.customerId === input.customerId &&
      previous.cashAccountId === input.cashAccountId &&
      previous.businessDate.toISOString().slice(0, 10) === input.businessDate &&
      previous.amount.eq(amount) &&
      previous.notes === (input.notes?.trim() || null)
    );
  }

  private sameApplicationInput(
    previous: {
      advanceReceiptId: string;
      businessDate: Date;
      lines: { receivableEntryId: string; amount: Prisma.Decimal }[];
    },
    advanceReceiptId: string,
    input: PostCustomerAdvanceApplicationDto,
  ) {
    if (
      previous.advanceReceiptId !== advanceReceiptId ||
      previous.businessDate.toISOString().slice(0, 10) !== input.businessDate ||
      previous.lines.length !== input.allocations.length
    )
      return false;
    const requested = new Map(
      input.allocations.map((item) => [
        item.receivableEntryId,
        new Prisma.Decimal(item.amount),
      ]),
    );
    return previous.lines.every((line) =>
      line.amount.eq(requested.get(line.receivableEntryId) ?? -1),
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
      code: "CUSTOMER_ADVANCE_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时处理预收款的操作较多，请刷新后重试。",
    });
  }
}
