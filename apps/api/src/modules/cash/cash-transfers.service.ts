import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostCashTransferDto } from "./dto/cash-transfers.dto.js";

const transferInclude = {
  fromCashAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  toCashAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  postedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.CashTransferInclude;

type TransferRecord = Prisma.CashTransferGetPayload<{
  include: typeof transferInclude;
}>;

@Injectable()
export class CashTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.cashTransfer.findMany({
      include: transferInclude,
      orderBy: [{ businessDate: "desc" }, { postedAt: "desc" }],
    });
    return { items: items.map((item) => this.toView(item)) };
  }

  async post(
    input: PostCashTransferDto,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    if (input.fromCashAccountId === input.toCashAccountId)
      throw new BadRequestException({
        code: "CASH_TRANSFER_SAME_ACCOUNT",
        detail: "转出账户和转入账户不能相同。",
      });
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0))
      throw new BadRequestException({
        code: "CASH_TRANSFER_AMOUNT_INVALID",
        detail: "转账金额必须大于零。",
      });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const transferId = await this.prisma.$transaction(
          async (tx) => {
            const previous = await tx.cashTransfer.findUnique({
              where: { idempotencyKey },
            });
            if (previous) {
              if (!this.sameInput(previous, input, amount))
                this.idempotencyConflict();
              return previous.id;
            }

            const accountIds = [
              input.fromCashAccountId,
              input.toCashAccountId,
            ].sort();
            await tx.$queryRaw(
              Prisma.sql`SELECT "id"::text FROM "cash_accounts" WHERE "id" IN (${Prisma.join(
                accountIds.map((id) => Prisma.sql`${id}::uuid`),
              )}) ORDER BY "id" FOR UPDATE`,
            );
            const accounts = await tx.cashAccount.findMany({
              where: { id: { in: accountIds }, status: "ACTIVE" },
              include: { balance: true },
            });
            if (accounts.length !== 2 || accounts.some((item) => !item.balance))
              throw new BadRequestException({
                code: "CASH_TRANSFER_ACCOUNT_UNAVAILABLE",
                detail: "请选择两个启用且已建立余额的资金账户。",
              });
            const from = accounts.find(
              (item) => item.id === input.fromCashAccountId,
            )!;
            if (from.balance!.amount.lt(amount))
              throw new ConflictException({
                code: "CASH_TRANSFER_INSUFFICIENT_FUNDS",
                detail: "转出账户余额不足。",
              });

            const sequence = await tx.$queryRaw<[{ next: bigint }]>`
              SELECT nextval('cash_transfer_number_seq') AS next
            `;
            const documentNumber = `ZZ-${new Date(input.businessDate).getUTCFullYear()}-${String(sequence[0].next).padStart(6, "0")}`;
            const transfer = await tx.cashTransfer.create({
              data: {
                documentNumber,
                idempotencyKey,
                businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
                fromCashAccountId: input.fromCashAccountId,
                toCashAccountId: input.toCashAccountId,
                amount,
                notes: input.notes?.trim() || null,
                postedById: actor.id,
              },
            });
            await tx.cashLedgerEntry.createMany({
              data: [
                {
                  cashAccountId: input.fromCashAccountId,
                  sourceDocumentType: "CASH_ACCOUNT_TRANSFER_OUT",
                  sourceDocumentId: transfer.id,
                  amountChange: amount.negated(),
                  businessDate: transfer.businessDate,
                  postedById: actor.id,
                },
                {
                  cashAccountId: input.toCashAccountId,
                  sourceDocumentType: "CASH_ACCOUNT_TRANSFER_IN",
                  sourceDocumentId: transfer.id,
                  amountChange: amount,
                  businessDate: transfer.businessDate,
                  postedById: actor.id,
                },
              ],
            });
            await tx.cashBalance.update({
              where: { cashAccountId: input.fromCashAccountId },
              data: {
                amount: { decrement: amount },
                version: { increment: 1 },
              },
            });
            await tx.cashBalance.update({
              where: { cashAccountId: input.toCashAccountId },
              data: {
                amount: { increment: amount },
                version: { increment: 1 },
              },
            });
            await tx.auditEvent.create({
              data: {
                actorUserId: actor.id,
                action: "cash.transfer.post",
                entityType: "CashTransfer",
                entityId: transfer.id,
                result: "SUCCESS",
                ipAddress,
                metadata: {
                  documentNumber,
                  fromCashAccountId: input.fromCashAccountId,
                  toCashAccountId: input.toCashAccountId,
                  amount: amount.toString(),
                },
              },
            });
            await tx.outboxEvent.create({
              data: {
                eventType: "cash.transfer.posted",
                aggregateType: "CashTransfer",
                aggregateId: transfer.id,
                payload: {
                  documentNumber,
                  fromCashAccountId: input.fromCashAccountId,
                  toCashAccountId: input.toCashAccountId,
                },
              },
            });
            return transfer.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.get(transferId);
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        const previous = await this.prisma.cashTransfer.findUnique({
          where: { idempotencyKey },
          include: transferInclude,
        });
        if (previous) {
          if (!this.sameInput(previous, input, amount))
            this.idempotencyConflict();
          return this.toView(previous);
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: "CASH_TRANSFER_CONCURRENCY_RETRY_EXHAUSTED",
      detail: "同时处理资金转账的操作较多，请刷新后重试。",
    });
  }

  private async get(id: string) {
    const item = await this.prisma.cashTransfer.findUniqueOrThrow({
      where: { id },
      include: transferInclude,
    });
    return this.toView(item);
  }

  private toView(item: TransferRecord) {
    return {
      ...item,
      amount: item.amount.toString(),
      businessDate: item.businessDate.toISOString().slice(0, 10),
      postedAt: item.postedAt.toISOString(),
    };
  }

  private sameInput(
    previous: {
      fromCashAccountId: string;
      toCashAccountId: string;
      businessDate: Date;
      amount: Prisma.Decimal;
      notes: string | null;
    },
    input: PostCashTransferDto,
    amount: Prisma.Decimal,
  ) {
    return (
      previous.fromCashAccountId === input.fromCashAccountId &&
      previous.toCashAccountId === input.toCashAccountId &&
      previous.businessDate.toISOString().slice(0, 10) === input.businessDate &&
      previous.amount.eq(amount) &&
      previous.notes === (input.notes?.trim() || null)
    );
  }

  private requireIdempotencyKey(value: string) {
    if (!value || value.length < 12 || value.length > 100)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        detail: "正式账户转账必须提供 12 到 100 位幂等键。",
      });
  }

  private idempotencyConflict(): never {
    throw new ConflictException({
      code: "IDEMPOTENCY_KEY_REUSED",
      detail: "该幂等键已用于另一笔账户转账。",
    });
  }

  private retryable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }
}
