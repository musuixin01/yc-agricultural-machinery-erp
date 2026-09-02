import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ReceivablesService } from "../src/modules/receivables/receivables.service.js";
import { SalesReturnsService } from "../src/modules/sales/sales-returns.service.js";
import { SalesService } from "../src/modules/sales/sales.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_sales_return_verify"))
  throw new Error(
    "This verification script may only use an isolated sales return verification database.",
  );

const prisma = new PrismaService();
const sales = new SalesService(prisma);
const returns = new SalesReturnsService(prisma);
const receivables = new ReceivablesService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "sales-return-verifier",
      displayName: "退货验证员",
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
  const warehouse = await prisma.warehouse.create({
    data: { code: "RETURN-VERIFY", name: "退货验证仓", isDefault: true },
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
  const customer = await prisma.party.create({
    data: {
      code: "RETURN-CUSTOMER",
      name: "退货验证客户",
      roles: { create: { type: "CUSTOMER" } },
    },
  });

  const immediate = await sales.create(
    {
      settlementType: "IMMEDIATE",
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T03:12:45.000Z",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "10" }],
    },
    actor,
  );
  await sales.submit(immediate.id, immediate.version, actor);
  const postedImmediate = await sales.post(
    immediate.id,
    "verify-return-sale-0001",
    actor,
  );
  const cashAccountId = postedImmediate.cashAccount!.id;
  const immediateReturn = await returns.post(
    {
      sourceSalesDocumentId: immediate.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T04:00:00.000Z",
      cashAccountId,
      reason: "型号不合适",
      lines: [{ sourceSalesLineId: immediate.lines[0].id, quantity: "1" }],
    },
    "verify-immediate-return-0001",
    actor,
  );
  if (immediateReturn.refundAmount !== "10")
    throw new Error(
      "Immediate return did not refund the original sale amount.",
    );

  const credit = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T05:00:00.000Z",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "30" }],
    },
    actor,
  );
  await sales.submit(credit.id, credit.version, actor);
  await sales.post(credit.id, "verify-return-credit-sale-01", actor);
  const firstCreditReturn = await returns.post(
    {
      sourceSalesDocumentId: credit.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T06:00:00.000Z",
      reason: "退回一件完好商品",
      lines: [{ sourceSalesLineId: credit.lines[0].id, quantity: "1" }],
    },
    "verify-credit-return-000001",
    actor,
  );
  if (
    firstCreditReturn.receivableReduction !== "30" ||
    firstCreditReturn.refundAmount !== "0"
  )
    throw new Error("Unpaid credit return did not reduce customer debt first.");

  const entry = await prisma.receivableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: credit.id },
  });
  await receivables.postReceipt(
    {
      customerId: customer.id,
      cashAccountId,
      businessDate: "2026-08-31",
      allocations: [{ receivableEntryId: entry.id, amount: "20" }],
    },
    "verify-return-receipt-0001",
    actor,
  );
  const secondCreditReturn = await returns.post(
    {
      sourceSalesDocumentId: credit.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T07:00:00.000Z",
      cashAccountId,
      reason: "退回剩余完好商品",
      lines: [{ sourceSalesLineId: credit.lines[0].id, quantity: "1" }],
    },
    "verify-credit-return-000002",
    actor,
  );
  if (
    secondCreditReturn.receivableReduction !== "10" ||
    secondCreditReturn.refundAmount !== "20"
  )
    throw new Error(
      "Paid credit return did not split debt reduction and refund.",
    );

  let overReturnRejected = false;
  try {
    await returns.post(
      {
        sourceSalesDocumentId: credit.id,
        businessDate: "2026-08-31",
        returnedAt: "2026-08-31T08:00:00.000Z",
        cashAccountId,
        reason: "故意超退验证",
        lines: [{ sourceSalesLineId: credit.lines[0].id, quantity: "1" }],
      },
      "verify-credit-overreturn-001",
      actor,
    );
  } catch {
    overReturnRejected = true;
  }
  const [balance, cashBalance, finalEntry, returnLedgerCount] =
    await Promise.all([
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.cashBalance.findUniqueOrThrow({ where: { cashAccountId } }),
      prisma.receivableEntry.findUniqueOrThrow({ where: { id: entry.id } }),
      prisma.inventoryLedgerEntry.count({
        where: { sourceDocumentType: "SALES_RETURN" },
      }),
    ]);
  if (
    !overReturnRejected ||
    !balance.quantity.eq(19) ||
    !cashBalance.amount.eq(10) ||
    !finalEntry.outstandingAmount.eq(0) ||
    returnLedgerCount !== 3
  )
    throw new Error("Sales return ledger invariants did not reconcile.");

  console.log("sales return integration verification passed");
}

main().finally(() => prisma.$disconnect());
