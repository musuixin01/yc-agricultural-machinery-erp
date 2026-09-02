import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PayablesService } from "../src/modules/payables/payables.service.js";
import { PaymentReversalsService } from "../src/modules/payables/payment-reversals.service.js";
import { PurchaseReturnsService } from "../src/modules/purchasing/purchase-returns.service.js";
import { PurchasingService } from "../src/modules/purchasing/purchasing.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_purchase_return_verify"))
  throw new Error(
    "This verification script may only use an isolated purchase return verification database.",
  );

const prisma = new PrismaService();
const purchasing = new PurchasingService(prisma);
const purchaseReturns = new PurchaseReturnsService(prisma);
const payables = new PayablesService(prisma);
const paymentReversals = new PaymentReversalsService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "purchase-return-verifier",
      displayName: "采购退货验证员",
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
      code: "PURCHASE-RETURN-SUPPLIER",
      name: "采购退货验证供应商",
      roles: { create: { type: "SUPPLIER" } },
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "PURCHASE-RETURN", name: "采购退货验证仓" },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { code: "LS-M12-045" },
  });
  const account = await payables.createAccount(
    {
      code: "PURCHASE-RETURN-CASH",
      name: "采购退货验证现金",
      type: "CASH",
      openingBalance: "1000",
    },
    actor,
  );

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
  const submitted = await purchasing.submit(
    purchase.id,
    purchase.version,
    actor,
  );
  const posted = await purchasing.post(
    purchase.id,
    "verify-purchase-return-source-01",
    actor,
  );
  const sourceLine = posted.lines[0];

  const firstReturn = await purchaseReturns.post(
    {
      sourcePurchaseDocumentId: posted.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T23:00:00.000Z",
      reason: "供应商发错型号",
      lines: [{ sourcePurchaseLineId: sourceLine.id, quantity: "3" }],
    },
    "verify-purchase-return-first-01",
    actor,
  );
  const repeated = await purchaseReturns.post(
    {
      sourcePurchaseDocumentId: posted.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T23:00:00.000Z",
      reason: "供应商发错型号",
      lines: [{ sourcePurchaseLineId: sourceLine.id, quantity: "3" }],
    },
    "verify-purchase-return-first-01",
    actor,
  );
  if (firstReturn.id !== repeated.id)
    throw new Error("Purchase return idempotency created a second record.");

  const payable = await prisma.payableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: posted.id },
  });
  const paymentDraft = await payables.createPayment(
    {
      supplierId: supplier.id,
      cashAccountId: account.id,
      businessDate: "2026-08-31",
      allocations: [{ payableEntryId: payable.id, amount: "40" }],
    },
    actor,
  );
  await payables.submitPayment(paymentDraft.id, paymentDraft.version, actor);
  const payment = await payables.postPayment(
    paymentDraft.id,
    "verify-purchase-return-payment-01",
    actor,
  );

  const secondReturn = await purchaseReturns.post(
    {
      sourcePurchaseDocumentId: posted.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T23:10:00.000Z",
      cashAccountId: account.id,
      reason: "商品质量问题",
      lines: [{ sourcePurchaseLineId: sourceLine.id, quantity: "4" }],
    },
    "verify-purchase-return-second-01",
    actor,
  );
  if (
    !new Prisma.Decimal(secondReturn.payableReduction).eq(30) ||
    !new Prisma.Decimal(secondReturn.refundAmount).eq(10)
  )
    throw new Error("Paid purchase return settlement split is incorrect.");

  let overReturnBlocked = false;
  try {
    await purchaseReturns.post(
      {
        sourcePurchaseDocumentId: posted.id,
        businessDate: "2026-08-31",
        returnedAt: "2026-08-31T23:20:00.000Z",
        reason: "不应成功",
        lines: [{ sourcePurchaseLineId: sourceLine.id, quantity: "4" }],
      },
      "verify-purchase-return-over-01",
      actor,
    );
  } catch {
    overReturnBlocked = true;
  }
  let paymentReversalBlocked = false;
  try {
    await paymentReversals.post(
      payment.id,
      {
        businessDate: "2026-08-31",
        reversedAt: "2026-08-31T23:30:00.000Z",
        reason: "不应成功",
      },
      "verify-payment-reversal-after-return",
      actor,
    );
  } catch {
    paymentReversalBlocked = true;
  }
  let returnLineImmutable = false;
  try {
    await prisma.purchaseReturnLine.update({
      where: {
        returnId_sourcePurchaseLineId: {
          returnId: firstReturn.id,
          sourcePurchaseLineId: sourceLine.id,
        },
      },
      data: { quantity: 1 },
    });
  } catch {
    returnLineImmutable = true;
  }

  const [entry, balance, inventoryLedger, cashBalance, cashLedger, count] =
    await Promise.all([
      prisma.payableEntry.findUniqueOrThrow({ where: { id: payable.id } }),
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.inventoryLedgerEntry.findMany({
        where: { productId: product.id, warehouseId: warehouse.id },
      }),
      prisma.cashBalance.findUniqueOrThrow({
        where: { cashAccountId: account.id },
      }),
      prisma.cashLedgerEntry.findMany({
        where: { cashAccountId: account.id },
      }),
      prisma.purchaseReturn.count(),
    ]);
  const ledgerQuantity = inventoryLedger.reduce(
    (sum, item) => sum.add(item.quantityChange),
    new Prisma.Decimal(0),
  );
  const ledgerCost = inventoryLedger.reduce(
    (sum, item) => sum.add(item.costAmount),
    new Prisma.Decimal(0),
  );
  const ledgerCash = cashLedger.reduce(
    (sum, item) => sum.add(item.amountChange),
    new Prisma.Decimal(0),
  );
  if (
    entry.status !== "SETTLED" ||
    !entry.outstandingAmount.eq(0) ||
    !balance.quantity.eq(3) ||
    !balance.totalCost.eq(30) ||
    !ledgerQuantity.eq(balance.quantity) ||
    !ledgerCost.eq(balance.totalCost) ||
    !cashBalance.amount.eq(970) ||
    !ledgerCash.eq(cashBalance.amount) ||
    count !== 2 ||
    !overReturnBlocked ||
    !paymentReversalBlocked ||
    !returnLineImmutable ||
    submitted.status !== "SUBMITTED"
  )
    throw new Error("Purchase return ledger invariants did not reconcile.");

  console.log("purchase return integration verification passed");
}

main().finally(() => prisma.$disconnect());
