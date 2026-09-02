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
  CreateCashAccountDto,
  CreateSupplierPaymentDto,
  PaymentAllocationDto,
  UpdateSupplierPaymentDto,
} from "./dto/payables.dto.js";
import { nextPayableStatus, sumAllocations } from "./payables.rules.js";

const paymentInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  cashAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  createdBy: { select: { id: true, displayName: true } },
  submittedBy: { select: { id: true, displayName: true } },
  postedBy: { select: { id: true, displayName: true } },
  reversal: {
    select: {
      id: true,
      documentNumber: true,
      businessDate: true,
      reversedAt: true,
      amount: true,
      reason: true,
      postedAt: true,
    },
  },
  allocations: {
    include: {
      payableEntry: {
        include: {
          sourceDocument: { select: { documentNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.SupplierPaymentInclude;

type PaymentRecord = Prisma.SupplierPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PayablesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts() {
    const items = await this.prisma.cashAccount.findMany({
      include: { balance: true },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return {
      items: items.map((item) => ({
        ...item,
        balance: item.balance?.amount.toString() ?? "0",
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async createAccount(input: CreateCashAccountDto, actor: AuthenticatedUser) {
    const opening = new Prisma.Decimal(input.openingBalance);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.cashAccount.create({
          data: {
            code: input.code,
            name: input.name,
            type: input.type,
            notes: input.notes?.trim() || null,
            createdById: actor.id,
            balance: { create: { amount: opening } },
          },
          include: { balance: true },
        });
        if (opening.gt(0)) {
          await tx.cashLedgerEntry.create({
            data: {
              cashAccountId: account.id,
              sourceDocumentType: "CASH_OPENING",
              sourceDocumentId: account.id,
              amountChange: opening,
              businessDate: new Date(),
              postedById: actor.id,
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "cash.account.create",
            entityType: "CashAccount",
            entityId: account.id,
            result: "SUCCESS",
            metadata: {
              code: account.code,
              openingBalance: opening.toString(),
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: "cash.account.created",
            aggregateType: "CashAccount",
            aggregateId: account.id,
            payload: { code: account.code },
          },
        });
        return {
          ...account,
          balance: account.balance?.amount.toString() ?? "0",
        };
      });
    } catch (error) {
      this.mapConstraint(error);
      throw error;
    }
  }

  async listPayables(supplierId?: string) {
    const items = await this.prisma.payableEntry.findMany({
      where: { supplierId, status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        sourceDocument: {
          select: { documentNumber: true, businessDate: true },
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

  async listPayments() {
    const items = await this.prisma.supplierPayment.findMany({
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async getPayment(id: string) {
    const item = await this.prisma.supplierPayment.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!item) this.notFound();
    return this.toView(item!);
  }

  async createPayment(
    input: CreateSupplierPaymentDto,
    actor: AuthenticatedUser,
  ) {
    await this.validatePayment(input);
    const amount = sumAllocations(input.allocations.map((item) => item.amount));
    const sequence = await this.prisma.$queryRaw<[{ next: bigint }]>`
      SELECT nextval('supplier_payment_number_seq') AS next
    `;
    const number = `FK-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
    const item = await this.prisma.supplierPayment.create({
      data: {
        documentNumber: number,
        supplierId: input.supplierId,
        cashAccountId: input.cashAccountId,
        businessDate: this.date(input.businessDate),
        amount,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        allocations: {
          create: input.allocations.map((allocation) => ({
            payableEntryId: allocation.payableEntryId,
            amount: new Prisma.Decimal(allocation.amount),
          })),
        },
      },
      include: paymentInclude,
    });
    return this.toView(item);
  }

  async updatePayment(id: string, input: UpdateSupplierPaymentDto) {
    await this.validatePayment(input);
    const amount = sumAllocations(input.allocations.map((item) => item.amount));
    const item = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.supplierPayment.updateMany({
        where: { id, status: "DRAFT", version: input.version },
        data: {
          supplierId: input.supplierId,
          cashAccountId: input.cashAccountId,
          businessDate: this.date(input.businessDate),
          amount,
          notes: input.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return null;
      await tx.paymentAllocation.deleteMany({
        where: { supplierPaymentId: id },
      });
      await tx.paymentAllocation.createMany({
        data: input.allocations.map((allocation) => ({
          supplierPaymentId: id,
          payableEntryId: allocation.payableEntryId,
          amount: new Prisma.Decimal(allocation.amount),
        })),
      });
      return tx.supplierPayment.findUnique({
        where: { id },
        include: paymentInclude,
      });
    });
    if (!item) this.conflict();
    return this.toView(item!);
  }

  async submitPayment(id: string, version: number, actor: AuthenticatedUser) {
    const changed = await this.prisma.supplierPayment.updateMany({
      where: { id, status: "DRAFT", version, allocations: { some: {} } },
      data: {
        status: "SUBMITTED",
        submittedById: actor.id,
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) this.conflict();
    return this.getPayment(id);
  }

  async postPayment(
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
        detail: "正式付款必须提供 12 到 100 位幂等键。",
      });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.paymentPostingRequest.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (previous.supplierPaymentId !== id)
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  detail: "该幂等键已用于另一张付款单。",
                });
              return;
            }
            const header = await tx.supplierPayment.findUnique({
              where: { id },
              select: { cashAccountId: true },
            });
            if (!header) this.notFound();
            await tx.$queryRaw`SELECT "id"::text FROM "cash_accounts" WHERE "id" = ${header!.cashAccountId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id"::text FROM "supplier_payments" WHERE "id" = ${id}::uuid FOR UPDATE`;
            const payment = await tx.supplierPayment.findUnique({
              where: { id },
              include: { allocations: true },
            });
            if (!payment) this.notFound();
            if (payment!.status === "POSTED") {
              await tx.paymentPostingRequest.create({
                data: { idempotencyKey, supplierPaymentId: id },
              });
              return;
            }
            if (payment!.status !== "SUBMITTED")
              this.conflict("只有已提交的付款单才能过账。");
            const allocationIds = [...payment!.allocations]
              .map((item) => item.payableEntryId)
              .sort();
            if (allocationIds.length)
              await tx.$queryRaw(
                Prisma.sql`SELECT "id"::text FROM "payable_entries" WHERE "id" IN (${Prisma.join(
                  allocationIds.map((item) => Prisma.sql`${item}::uuid`),
                )}) ORDER BY "id" FOR UPDATE`,
              );
            const balance = await tx.cashBalance.findUnique({
              where: { cashAccountId: payment!.cashAccountId },
            });
            if (!balance || balance.amount.lt(payment!.amount))
              throw new ConflictException({
                code: "CASH_BALANCE_INSUFFICIENT",
                detail: "所选资金账户余额不足，不能付款。",
              });
            for (const allocation of payment!.allocations) {
              const payable = await tx.payableEntry.findUnique({
                where: { id: allocation.payableEntryId },
              });
              if (!payable || payable.supplierId !== payment!.supplierId)
                throw new ConflictException({
                  code: "PAYABLE_SUPPLIER_MISMATCH",
                  detail: "核销项不属于该供应商。",
                });
              if (payable.outstandingAmount.lt(allocation.amount))
                throw new ConflictException({
                  code: "PAYABLE_OVER_ALLOCATION",
                  detail: "核销金额超过应付未结金额。",
                });
              const outstanding = payable.outstandingAmount.sub(
                allocation.amount,
              );
              await tx.payableEntry.update({
                where: { id: payable.id },
                data: {
                  outstandingAmount: outstanding,
                  status: nextPayableStatus(outstanding),
                },
              });
            }
            await tx.cashLedgerEntry.create({
              data: {
                cashAccountId: payment!.cashAccountId,
                sourceDocumentType: "SUPPLIER_PAYMENT",
                sourceDocumentId: id,
                amountChange: payment!.amount.negated(),
                businessDate: payment!.businessDate,
                postedById: actor.id,
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: payment!.cashAccountId },
              data: {
                amount: { decrement: payment!.amount },
                version: { increment: 1 },
              },
            });
            await tx.supplierPayment.update({
              where: { id },
              data: {
                status: "POSTED",
                postedById: actor.id,
                postedAt: new Date(),
                version: { increment: 1 },
              },
            });
            await tx.paymentPostingRequest.create({
              data: { idempotencyKey, supplierPaymentId: id },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "payables.payment.post",
                entityType: "SupplierPayment",
                entityId: id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber: payment!.documentNumber,
                  amount: payment!.amount.toString(),
                  allocationCount: payment!.allocations.length,
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "payables.payment.posted",
                aggregateType: "SupplierPayment",
                aggregateId: id,
                payload: {
                  documentNumber: payment!.documentNumber,
                  supplierId: payment!.supplierId,
                  cashAccountId: payment!.cashAccountId,
                },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.getPayment(id);
      } catch (error) {
        if (this.isRetryable(error) && attempt < 3) continue;
        this.mapConstraint(error);
        throw error;
      }
    }
    throw new ConflictException({
      code: "PAYMENT_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时付款操作较多，请刷新后重试。",
    });
  }

  private async validatePayment(input: CreateSupplierPaymentDto) {
    const ids = input.allocations.map((item) => item.payableEntryId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException({
        code: "PAYMENT_ALLOCATION_DUPLICATE",
        detail: "同一应付只能在付款单中分配一次。",
      });
    if (
      input.allocations.some((item) => new Prisma.Decimal(item.amount).lte(0))
    )
      throw new BadRequestException({
        code: "PAYMENT_AMOUNT_INVALID",
        detail: "核销金额必须大于零。",
      });
    const [supplier, account, payables] = await Promise.all([
      this.prisma.party.findFirst({
        where: {
          id: input.supplierId,
          status: "ACTIVE",
          roles: { some: { type: "SUPPLIER" } },
        },
      }),
      this.prisma.cashAccount.findFirst({
        where: { id: input.cashAccountId, status: "ACTIVE" },
      }),
      this.prisma.payableEntry.findMany({
        where: { id: { in: ids }, supplierId: input.supplierId },
        select: { id: true, outstandingAmount: true },
      }),
    ]);
    if (!supplier)
      throw new BadRequestException({
        code: "SUPPLIER_UNAVAILABLE",
        detail: "请选择启用中的供应商。",
      });
    if (!account)
      throw new BadRequestException({
        code: "CASH_ACCOUNT_UNAVAILABLE",
        detail: "请选择启用中的资金账户。",
      });
    if (payables.length !== ids.length)
      throw new BadRequestException({
        code: "PAYABLE_UNAVAILABLE",
        detail: "应付不存在、已结清或不属于所选供应商。",
      });
    const requested = new Map(
      input.allocations.map((item) => [
        item.payableEntryId,
        new Prisma.Decimal(item.amount),
      ]),
    );
    if (
      payables.some((item) =>
        requested.get(item.id)!.gt(item.outstandingAmount),
      )
    )
      throw new BadRequestException({
        code: "PAYABLE_OVER_ALLOCATION",
        detail: "核销金额不能超过应付未结金额。",
      });
  }

  private toView(item: PaymentRecord) {
    return {
      ...item,
      businessDate: item.businessDate.toISOString().slice(0, 10),
      amount: item.amount.toString(),
      submittedAt: item.submittedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      reversal: item.reversal
        ? {
            ...item.reversal,
            businessDate: item.reversal.businessDate.toISOString().slice(0, 10),
            reversedAt: item.reversal.reversedAt.toISOString(),
            amount: item.reversal.amount.toString(),
            postedAt: item.reversal.postedAt.toISOString(),
          }
        : null,
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

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "SUPPLIER_PAYMENT_NOT_FOUND",
      detail: "供应商付款单不存在。",
    });
  }

  private conflict(detail = "付款单状态或版本已经变化，请刷新后重试。"): never {
    throw new ConflictException({ code: "PAYMENT_STATE_CONFLICT", detail });
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
        code: "PAYMENT_CONFLICT",
        detail: "资金账户或付款单已经存在或已处理，请刷新后核对。",
      });
  }
}
