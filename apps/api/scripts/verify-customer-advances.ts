import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { CustomerAdvancesService } from "../src/modules/receivables/customer-advances.service.js";
import { SalesService } from "../src/modules/sales/sales.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_customer_advance_verify"))
  throw new Error(
    "This verification script may only use an isolated customer advance verification database.",
  );

const prisma = new PrismaService();
const advances = new CustomerAdvancesService(prisma);
const sales = new SalesService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "customer-advance-verifier",
      displayName: "客户预收款验证员",
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
  const customer = await prisma.party.create({
    data: {
      code: "CUSTOMER-ADVANCE-VERIFY",
      name: "客户预收款验证客户",
      roles: { create: { type: "CUSTOMER" } },
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "CUSTOMER-ADV", name: "预收款验证仓", isDefault: true },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { code: "LS-M12-045" },
  });
  await prisma.inventoryBalance.create({
    data: {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 20,
      totalCost: 20,
      averageCost: 1,
    },
  });
  const account = await prisma.cashAccount.create({
    data: {
      code: "CUSTOMER-ADVANCE-CASH",
      name: "预收款验证现金",
      type: "CASH",
      createdById: user.id,
      balance: { create: { amount: 0 } },
    },
  });

  const advance = await advances.postAdvance(
    {
      customerId: customer.id,
      cashAccountId: account.id,
      businessDate: "2026-09-01",
      amount: "300",
      notes: "订购农机预付订金",
    },
    "verify-customer-advance-post-01",
    actor,
  );
  const repeatedAdvance = await advances.postAdvance(
    {
      customerId: customer.id,
      cashAccountId: account.id,
      businessDate: "2026-09-01",
      amount: "300",
      notes: "订购农机预付订金",
    },
    "verify-customer-advance-post-01",
    actor,
  );
  if (advance.id !== repeatedAdvance.id)
    throw new Error("Customer advance idempotency created a second record.");
  let advanceKeyReuseBlocked = false;
  try {
    await advances.postAdvance(
      {
        customerId: customer.id,
        cashAccountId: account.id,
        businessDate: "2026-09-01",
        amount: "301",
      },
      "verify-customer-advance-post-01",
      actor,
    );
  } catch {
    advanceKeyReuseBlocked = true;
  }

  const sale = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-09-01",
      soldAt: "2026-09-01T03:00:00.000Z",
      dueDate: "2026-10-01",
      lines: [{ productId: product.id, quantity: "10", unitPrice: "10" }],
    },
    actor,
  );
  await sales.submit(sale.id, sale.version, actor);
  await sales.post(sale.id, "verify-customer-advance-sale-01", actor);
  const receivable = await prisma.receivableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: sale.id },
  });

  const firstApplication = await advances.apply(
    advance.id,
    {
      businessDate: "2026-09-01",
      allocations: [{ receivableEntryId: receivable.id, amount: "60" }],
    },
    "verify-customer-advance-apply-01",
    actor,
  );
  const repeatedApplication = await advances.apply(
    advance.id,
    {
      businessDate: "2026-09-01",
      allocations: [{ receivableEntryId: receivable.id, amount: "60" }],
    },
    "verify-customer-advance-apply-01",
    actor,
  );
  if (firstApplication.id !== repeatedApplication.id)
    throw new Error("Advance application idempotency created a second record.");
  let applicationKeyReuseBlocked = false;
  try {
    await advances.apply(
      advance.id,
      {
        businessDate: "2026-09-01",
        allocations: [{ receivableEntryId: receivable.id, amount: "59" }],
      },
      "verify-customer-advance-apply-01",
      actor,
    );
  } catch {
    applicationKeyReuseBlocked = true;
  }

  await advances.apply(
    advance.id,
    {
      businessDate: "2026-09-01",
      allocations: [{ receivableEntryId: receivable.id, amount: "40" }],
    },
    "verify-customer-advance-apply-02",
    actor,
  );
  let overApplicationBlocked = false;
  try {
    await advances.apply(
      advance.id,
      {
        businessDate: "2026-09-01",
        allocations: [{ receivableEntryId: receivable.id, amount: "1" }],
      },
      "verify-customer-advance-over-01",
      actor,
    );
  } catch {
    overApplicationBlocked = true;
  }
  let advanceImmutable = false;
  try {
    await prisma.customerAdvanceReceipt.update({
      where: { id: advance.id },
      data: { notes: "不应允许修改" },
    });
  } catch {
    advanceImmutable = true;
  }
  let applicationLineImmutable = false;
  try {
    await prisma.customerAdvanceApplicationLine.update({
      where: {
        applicationId_receivableEntryId: {
          applicationId: firstApplication.id,
          receivableEntryId: receivable.id,
        },
      },
      data: { amount: 1 },
    });
  } catch {
    applicationLineImmutable = true;
  }

  const [entry, balance, cashBalance, cashLedger, applicationTotal, counts] =
    await Promise.all([
      prisma.receivableEntry.findUniqueOrThrow({
        where: { id: receivable.id },
      }),
      prisma.customerAdvanceBalance.findUniqueOrThrow({
        where: { advanceReceiptId: advance.id },
      }),
      prisma.cashBalance.findUniqueOrThrow({
        where: { cashAccountId: account.id },
      }),
      prisma.cashLedgerEntry.findMany({
        where: { cashAccountId: account.id },
      }),
      prisma.customerAdvanceApplication.aggregate({
        where: { advanceReceiptId: advance.id },
        _sum: { amount: true },
      }),
      Promise.all([
        prisma.customerAdvanceReceipt.count(),
        prisma.customerAdvanceApplication.count(),
      ]),
    ]);
  const ledgerCash = cashLedger.reduce(
    (sum, item) => sum.add(item.amountChange),
    new Prisma.Decimal(0),
  );
  if (
    entry.status !== "SETTLED" ||
    !entry.outstandingAmount.eq(0) ||
    !balance.availableAmount.eq(200) ||
    !cashBalance.amount.eq(300) ||
    !ledgerCash.eq(cashBalance.amount) ||
    !applicationTotal._sum.amount?.eq(100) ||
    counts[0] !== 1 ||
    counts[1] !== 2 ||
    !advanceKeyReuseBlocked ||
    !applicationKeyReuseBlocked ||
    !overApplicationBlocked ||
    !advanceImmutable ||
    !applicationLineImmutable
  )
    throw new Error("Customer advance ledger invariants did not reconcile.");

  console.log("customer advance integration verification passed");
}

main().finally(() => prisma.$disconnect());
