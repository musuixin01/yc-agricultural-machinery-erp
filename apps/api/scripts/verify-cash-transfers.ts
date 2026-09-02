import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { CashTransfersService } from "../src/modules/cash/cash-transfers.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_cash_transfer_verify"))
  throw new Error(
    "This verification script may only use an isolated cash transfer verification database.",
  );

const prisma = new PrismaService();
const transfers = new CashTransfersService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "cash-transfer-verifier",
      displayName: "账户转账验证员",
      passwordHash: "not-used-in-isolated-verification",
    },
  });
  const actor = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: [],
    permissions: [],
    sessionId: "isolated-verification",
  };
  const from = await prisma.cashAccount.create({
    data: {
      code: "TRANSFER-FROM",
      name: "转账验证现金",
      type: "CASH",
      createdById: user.id,
      balance: { create: { amount: 100 } },
    },
  });
  const to = await prisma.cashAccount.create({
    data: {
      code: "TRANSFER-TO",
      name: "转账验证银行卡",
      type: "BANK",
      createdById: user.id,
      balance: { create: { amount: 20 } },
    },
  });

  const input = {
    fromCashAccountId: from.id,
    toCashAccountId: to.id,
    businessDate: "2026-09-01",
    amount: "30",
    notes: "现金存入银行卡",
  };
  const transfer = await transfers.post(
    input,
    "verify-cash-transfer-01",
    actor,
  );
  const repeated = await transfers.post(
    input,
    "verify-cash-transfer-01",
    actor,
  );
  if (transfer.id !== repeated.id)
    throw new Error("Cash transfer idempotency created a second record.");

  let keyReuseBlocked = false;
  try {
    await transfers.post(
      { ...input, amount: "31" },
      "verify-cash-transfer-01",
      actor,
    );
  } catch {
    keyReuseBlocked = true;
  }
  let sameAccountBlocked = false;
  try {
    await transfers.post(
      { ...input, toCashAccountId: from.id },
      "verify-cash-transfer-same-account",
      actor,
    );
  } catch {
    sameAccountBlocked = true;
  }
  let insufficientBlocked = false;
  try {
    await transfers.post(
      { ...input, amount: "1000" },
      "verify-cash-transfer-insufficient",
      actor,
    );
  } catch {
    insufficientBlocked = true;
  }
  let transferImmutable = false;
  try {
    await prisma.cashTransfer.update({
      where: { id: transfer.id },
      data: { notes: "不应允许修改" },
    });
  } catch {
    transferImmutable = true;
  }

  const [fromBalance, toBalance, ledger, counts] = await Promise.all([
    prisma.cashBalance.findUniqueOrThrow({
      where: { cashAccountId: from.id },
    }),
    prisma.cashBalance.findUniqueOrThrow({ where: { cashAccountId: to.id } }),
    prisma.cashLedgerEntry.findMany({
      where: { sourceDocumentId: transfer.id },
      orderBy: { sourceDocumentType: "asc" },
    }),
    Promise.all([
      prisma.cashTransfer.count(),
      prisma.auditEvent.count({ where: { action: "cash.transfer.post" } }),
      prisma.outboxEvent.count({
        where: { eventType: "cash.transfer.posted" },
      }),
    ]),
  ]);
  const ledgerNet = ledger.reduce(
    (sum, item) => sum.add(item.amountChange),
    new Prisma.Decimal(0),
  );
  if (
    !fromBalance.amount.eq(70) ||
    !toBalance.amount.eq(50) ||
    ledger.length !== 2 ||
    !ledgerNet.eq(0) ||
    counts.some((count) => count !== 1) ||
    !keyReuseBlocked ||
    !sameAccountBlocked ||
    !insufficientBlocked ||
    !transferImmutable
  )
    throw new Error("Cash transfer ledger invariants did not reconcile.");

  console.log("cash transfer integration verification passed");
}

main().finally(() => prisma.$disconnect());
