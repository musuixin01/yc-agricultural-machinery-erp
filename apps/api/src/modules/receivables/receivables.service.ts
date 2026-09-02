import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostCustomerReceiptDto } from "./dto/receivables.dto.js";
import {
  nextReceivableStatus,
  sumReceiptAllocations,
} from "./receivables.rules.js";

const receiptInclude = {
  customer: { select: { id: true, code: true, name: true } },
  cashAccount: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, displayName: true } },
  reversal: {
    include: { postedBy: { select: { id: true, displayName: true } } },
  },
  allocations: {
    include: {
      receivableEntry: {
        include: {
          sourceDocument: {
            select: { documentNumber: true, soldAt: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CustomerReceiptInclude;

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntries(customerId?: string) {
    const items = await this.prisma.receivableEntry.findMany({
      where: {
        customerId,
        status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            contacts: {
              where: { isPrimary: true },
              select: { phone: true },
              take: 1,
            },
          },
        },
        sourceDocument: {
          select: { documentNumber: true, soldAt: true },
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
        customer: {
          id: item.customer.id,
          code: item.customer.code,
          name: item.customer.name,
          phone: item.customer.contacts[0]?.phone ?? null,
        },
        sourceDocument: {
          documentNumber: item.sourceDocument.documentNumber,
          soldAt: item.sourceDocument.soldAt.toISOString(),
        },
      })),
    };
  }

  async listReceipts() {
    const items = await this.prisma.customerReceipt.findMany({
      include: receiptInclude,
      orderBy: { postedAt: "desc" },
      take: 100,
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async postReceipt(
    input: PostCustomerReceiptDto,
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
        detail: "正式收款必须提供 12 到 100 位幂等键。",
      });
    }
    const ids = input.allocations.map((item) => item.receivableEntryId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: "RECEIPT_ALLOCATION_DUPLICATE",
        detail: "同一笔客户欠款只能核销一次。",
      });
    }
    const amount = sumReceiptAllocations(
      input.allocations.map((item) => item.amount),
    );
    if (
      amount.lte(0) ||
      input.allocations.some((item) => new Prisma.Decimal(item.amount).lte(0))
    ) {
      throw new BadRequestException({
        code: "RECEIPT_AMOUNT_INVALID",
        detail: "收款及核销金额必须大于零。",
      });
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const receiptId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.customerReceipt.findUnique({
              where: { idempotencyKey },
              select: { id: true },
            });
            if (previous) return previous.id;

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
              }),
            ]);
            if (!customer)
              throw new BadRequestException({
                code: "CUSTOMER_UNAVAILABLE",
                detail: "请选择启用中的欠款客户。",
              });
            if (!account)
              throw new BadRequestException({
                code: "CASH_ACCOUNT_UNAVAILABLE",
                detail: "请选择启用中的收款账户。",
              });

            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${input.cashAccountId}::uuid FOR UPDATE`;
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "receivable_entries" WHERE "id" IN (${Prisma.join(
                [...ids].sort().map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const entries = await tx.receivableEntry.findMany({
              where: { id: { in: ids } },
            });
            if (
              entries.length !== ids.length ||
              entries.some((entry) => entry.customerId !== input.customerId)
            ) {
              throw new ConflictException({
                code: "RECEIVABLE_CUSTOMER_MISMATCH",
                detail: "欠款不存在、已变化或不属于所选客户。",
              });
            }
            const allocations = new Map(
              input.allocations.map((item) => [
                item.receivableEntryId,
                new Prisma.Decimal(item.amount),
              ]),
            );
            for (const entry of entries) {
              const allocated = allocations.get(entry.id)!;
              if (entry.outstandingAmount.lt(allocated)) {
                throw new ConflictException({
                  code: "RECEIVABLE_OVER_ALLOCATION",
                  detail: "收款金额超过客户当前未结欠款。",
                });
              }
            }

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('customer_receipt_number_seq') AS next
            `;
            const documentNumber = `SK-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const receipt = await tx.customerReceipt.create({
              data: {
                documentNumber,
                idempotencyKey,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                customerId: input.customerId,
                cashAccountId: input.cashAccountId,
                amount,
                notes: input.notes?.trim() || null,
                postedById: actor.id,
                allocations: {
                  create: input.allocations.map((allocation) => ({
                    receivableEntryId: allocation.receivableEntryId,
                    amount: new Prisma.Decimal(allocation.amount),
                  })),
                },
              },
            });
            for (const entry of entries) {
              const outstanding = entry.outstandingAmount.sub(
                allocations.get(entry.id)!,
              );
              await tx.receivableEntry.update({
                where: { id: entry.id },
                data: {
                  outstandingAmount: outstanding,
                  status: nextReceivableStatus(outstanding),
                },
              });
            }
            await tx.cashLedgerEntry.create({
              data: {
                cashAccountId: input.cashAccountId,
                sourceDocumentType: "CUSTOMER_RECEIPT",
                sourceDocumentId: receipt.id,
                amountChange: amount,
                businessDate: receipt.businessDate,
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
                action: "receivables.receipt.post",
                entityType: "CustomerReceipt",
                entityId: receipt.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  customerId: input.customerId,
                  amount: amount.toString(),
                  allocationCount: input.allocations.length,
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "receivables.receipt.posted",
                aggregateType: "CustomerReceipt",
                aggregateId: receipt.id,
                payload: {
                  documentNumber,
                  customerId: input.customerId,
                  cashAccountId: input.cashAccountId,
                },
              },
            });
            return receipt.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        const receipt = await this.prisma.customerReceipt.findUniqueOrThrow({
          where: { id: receiptId },
          include: receiptInclude,
        });
        return this.toView(receipt);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const previous = await this.prisma.customerReceipt.findUnique({
            where: { idempotencyKey },
            include: receiptInclude,
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
      code: "RECEIPT_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时收款操作较多，请刷新后重试。",
    });
  }

  private toView(
    item: Prisma.CustomerReceiptGetPayload<{ include: typeof receiptInclude }>,
  ) {
    return {
      ...item,
      amount: item.amount.toString(),
      businessDate: item.businessDate.toISOString().slice(0, 10),
      postedAt: item.postedAt.toISOString(),
      reversal: item.reversal
        ? {
            ...item.reversal,
            amount: item.reversal.amount.toString(),
            businessDate: item.reversal.businessDate.toISOString().slice(0, 10),
            reversedAt: item.reversal.reversedAt.toISOString(),
            postedAt: item.reversal.postedAt.toISOString(),
          }
        : null,
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
          sourceDocument: {
            ...allocation.receivableEntry.sourceDocument,
            soldAt:
              allocation.receivableEntry.sourceDocument.soldAt.toISOString(),
          },
        },
      })),
    };
  }
}
