import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PayablesService } from "../src/modules/payables/payables.service.js";
import { SupplierAdvancesService } from "../src/modules/payables/supplier-advances.service.js";
import { PurchasingService } from "../src/modules/purchasing/purchasing.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_supplier_advance_verify"))
  throw new Error(
    "This verification script may only use an isolated supplier advance verification database.",
  );

const prisma = new PrismaService();
const payables = new PayablesService(prisma);
const advances = new SupplierAdvancesService(prisma);
const purchasing = new PurchasingService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "supplier-advance-verifier",
      displayName: "供应商预付款验证员",
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
      code: "SUPPLIER-ADVANCE-VERIFY",
      name: "供应商预付款验证供应商",
      roles: { create: { type: "SUPPLIER" } },
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "ADVANCE-VERIFY", name: "预付款验证仓" },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { code: "LS-M12-045" },
  });
  const account = await payables.createAccount(
    {
      code: "SUPPLIER-ADVANCE-CASH",
      name: "预付款验证现金",
      type: "CASH",
      openingBalance: "1000",
    },
    actor,
  );

  const advance = await advances.postAdvance(
    {
      supplierId: supplier.id,
      cashAccountId: account.id,
      businessDate: "2026-08-31",
      amount: "300",
      notes: "秋季备货预付款",
    },
    "verify-supplier-advance-post-01",
    actor,
  );
  const repeatedAdvance = await advances.postAdvance(
    {
      supplierId: supplier.id,
      cashAccountId: account.id,
      businessDate: "2026-08-31",
      amount: "300",
      notes: "秋季备货预付款",
    },
    "verify-supplier-advance-post-01",
    actor,
  );
  if (advance.id !== repeatedAdvance.id)
    throw new Error("Supplier advance idempotency created a second record.");
  let advanceKeyReuseBlocked = false;
  try {
    await advances.postAdvance(
      {
        supplierId: supplier.id,
        cashAccountId: account.id,
        businessDate: "2026-08-31",
        amount: "301",
      },
      "verify-supplier-advance-post-01",
      actor,
    );
  } catch {
    advanceKeyReuseBlocked = true;
  }

  const purchase = await purchasing.create(
    {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "10", unitPrice: "10" }],
    },
    actor,
  );
  await purchasing.submit(purchase.id, purchase.version, actor);
  const postedPurchase = await purchasing.post(
    purchase.id,
    "verify-supplier-advance-purchase-01",
    actor,
  );
  const payable = await prisma.payableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: postedPurchase.id },
  });

  const firstApplication = await advances.apply(
    advance.id,
    {
      businessDate: "2026-08-31",
      allocations: [{ payableEntryId: payable.id, amount: "60" }],
    },
    "verify-supplier-advance-apply-01",
    actor,
  );
  const repeatedApplication = await advances.apply(
    advance.id,
    {
      businessDate: "2026-08-31",
      allocations: [{ payableEntryId: payable.id, amount: "60" }],
    },
    "verify-supplier-advance-apply-01",
    actor,
  );
  if (firstApplication.id !== repeatedApplication.id)
    throw new Error("Advance application idempotency created a second record.");
  let applicationKeyReuseBlocked = false;
  try {
    await advances.apply(
      advance.id,
      {
        businessDate: "2026-08-31",
        allocations: [{ payableEntryId: payable.id, amount: "59" }],
      },
      "verify-supplier-advance-apply-01",
      actor,
    );
  } catch {
    applicationKeyReuseBlocked = true;
  }

  await advances.apply(
    advance.id,
    {
      businessDate: "2026-08-31",
      allocations: [{ payableEntryId: payable.id, amount: "40" }],
    },
    "verify-supplier-advance-apply-02",
    actor,
  );

  let overApplicationBlocked = false;
  try {
    await advances.apply(
      advance.id,
      {
        businessDate: "2026-08-31",
        allocations: [{ payableEntryId: payable.id, amount: "1" }],
      },
      "verify-supplier-advance-over-01",
      actor,
    );
  } catch {
    overApplicationBlocked = true;
  }
  let advanceImmutable = false;
  try {
    await prisma.supplierAdvancePayment.update({
      where: { id: advance.id },
      data: { notes: "不应允许修改" },
    });
  } catch {
    advanceImmutable = true;
  }
  let applicationLineImmutable = false;
  try {
    await prisma.supplierAdvanceApplicationLine.update({
      where: {
        applicationId_payableEntryId: {
          applicationId: firstApplication.id,
          payableEntryId: payable.id,
        },
      },
      data: { amount: 1 },
    });
  } catch {
    applicationLineImmutable = true;
  }

  const [entry, balance, cashBalance, cashLedger, applicationTotal, counts] =
    await Promise.all([
      prisma.payableEntry.findUniqueOrThrow({ where: { id: payable.id } }),
      prisma.supplierAdvanceBalance.findUniqueOrThrow({
        where: { advancePaymentId: advance.id },
      }),
      prisma.cashBalance.findUniqueOrThrow({
        where: { cashAccountId: account.id },
      }),
      prisma.cashLedgerEntry.findMany({
        where: { cashAccountId: account.id },
      }),
      prisma.supplierAdvanceApplication.aggregate({
        where: { advancePaymentId: advance.id },
        _sum: { amount: true },
      }),
      Promise.all([
        prisma.supplierAdvancePayment.count(),
        prisma.supplierAdvanceApplication.count(),
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
    !cashBalance.amount.eq(700) ||
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
    throw new Error("Supplier advance ledger invariants did not reconcile.");

  console.log("supplier advance integration verification passed");
}

main().finally(() => prisma.$disconnect());
