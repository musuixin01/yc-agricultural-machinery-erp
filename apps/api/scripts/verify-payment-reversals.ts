import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PayablesService } from "../src/modules/payables/payables.service.js";
import { PaymentReversalsService } from "../src/modules/payables/payment-reversals.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_payment_reversal_verify"))
  throw new Error(
    "This verification script may only use an isolated payment reversal verification database.",
  );

const prisma = new PrismaService();
const payables = new PayablesService(prisma);
const reversals = new PaymentReversalsService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "payment-reversal-verifier",
      displayName: "付款反核销验证员",
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
  const supplier = await prisma.party.create({
    data: {
      code: "PAYMENT-REV-SUPPLIER",
      name: "付款反核销验证供应商",
      roles: { create: { type: "SUPPLIER" } },
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "PAYMENT-REV", name: "付款反核销验证仓" },
  });
  const account = await prisma.cashAccount.create({
    data: {
      code: "PAYMENT-REV-CASH",
      name: "付款反核销验证现金",
      type: "CASH",
      createdById: user.id,
      balance: { create: { amount: 1000 } },
    },
  });
  await prisma.cashLedgerEntry.create({
    data: {
      cashAccountId: account.id,
      sourceDocumentType: "CASH_OPENING",
      sourceDocumentId: account.id,
      amountChange: 1000,
      businessDate: new Date("2026-08-31T00:00:00.000Z"),
      postedById: user.id,
    },
  });
  const purchase = await prisma.purchaseDocument.create({
    data: {
      documentNumber: "CGRK-PAYMENT-REV-001",
      status: "POSTED",
      businessDate: new Date("2026-08-31T00:00:00.000Z"),
      dueDate: new Date("2026-09-30T00:00:00.000Z"),
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      totalAmount: 100,
      createdById: user.id,
      postedById: user.id,
      postedAt: new Date("2026-08-31T01:00:00.000Z"),
    },
  });
  const payable = await prisma.payableEntry.create({
    data: {
      supplierId: supplier.id,
      sourceDocumentId: purchase.id,
      originalAmount: 100,
      outstandingAmount: 100,
      dueDate: new Date("2026-09-30T00:00:00.000Z"),
      postedById: user.id,
    },
  });

  async function postPayment(amount: string, suffix: string) {
    const payment = await payables.createPayment(
      {
        supplierId: supplier.id,
        cashAccountId: account.id,
        businessDate: "2026-08-31",
        allocations: [{ payableEntryId: payable.id, amount }],
      },
      actor,
    );
    await payables.submitPayment(payment.id, payment.version, actor);
    return payables.postPayment(
      payment.id,
      `verify-payment-post-${suffix}`,
      actor,
    );
  }

  const firstPayment = await postPayment("40", "first-01");
  const secondPayment = await postPayment("20", "second-01");
  const firstReversal = await reversals.post(
    firstPayment.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:00:00.000Z",
      reason: "核销错采购单",
    },
    "verify-payment-reversal-first-01",
    actor,
  );
  const repeated = await reversals.post(
    firstPayment.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:00:00.000Z",
      reason: "核销错采购单",
    },
    "verify-payment-reversal-first-01",
    actor,
  );
  if (firstReversal.id !== repeated.id)
    throw new Error("Payment reversal idempotency returned a second record.");

  const partiallyRestored = await prisma.payableEntry.findUniqueOrThrow({
    where: { id: payable.id },
  });
  if (
    partiallyRestored.status !== "PARTIALLY_SETTLED" ||
    !partiallyRestored.outstandingAmount.eq(80)
  )
    throw new Error("Earlier payment reversal did not restore partial debt.");

  await reversals.post(
    secondPayment.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:10:00.000Z",
      reason: "付款账户选错",
    },
    "verify-payment-reversal-second-01",
    actor,
  );

  let reversalAllocationImmutable = false;
  try {
    await prisma.supplierPaymentReversalAllocation.update({
      where: {
        sourcePaymentAllocationId: firstPayment.allocations[0].id,
      },
      data: { amount: new Prisma.Decimal("1") },
    });
  } catch {
    reversalAllocationImmutable = true;
  }
  let reversedPaymentImmutable = false;
  try {
    await prisma.supplierPayment.update({
      where: { id: firstPayment.id },
      data: { notes: "不应允许修改" },
    });
  } catch {
    reversedPaymentImmutable = true;
  }

  const [entry, balance, ledger, paymentRows, reversalCount] =
    await Promise.all([
      prisma.payableEntry.findUniqueOrThrow({ where: { id: payable.id } }),
      prisma.cashBalance.findUniqueOrThrow({
        where: { cashAccountId: account.id },
      }),
      prisma.cashLedgerEntry.findMany({
        where: { cashAccountId: account.id },
      }),
      prisma.supplierPayment.findMany({
        where: { id: { in: [firstPayment.id, secondPayment.id] } },
      }),
      prisma.supplierPaymentReversal.count(),
    ]);
  const ledgerBalance = ledger.reduce(
    (sum, item) => sum.add(item.amountChange),
    new Prisma.Decimal(0),
  );
  if (
    entry.status !== "OPEN" ||
    !entry.outstandingAmount.eq(100) ||
    !balance.amount.eq(1000) ||
    !ledgerBalance.eq(balance.amount) ||
    paymentRows.some((payment) => payment.status !== "REVERSED") ||
    reversalCount !== 2 ||
    !reversalAllocationImmutable ||
    !reversedPaymentImmutable
  )
    throw new Error("Payment reversal ledger invariants did not reconcile.");

  console.log("supplier payment reversal integration verification passed");
}

main().finally(() => prisma.$disconnect());
