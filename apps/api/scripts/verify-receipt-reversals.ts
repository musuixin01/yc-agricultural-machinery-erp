import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ReceiptReversalsService } from "../src/modules/receivables/receipt-reversals.service.js";
import { ReceivablesService } from "../src/modules/receivables/receivables.service.js";
import { SalesReversalsService } from "../src/modules/sales/sales-reversals.service.js";
import { SalesReturnsService } from "../src/modules/sales/sales-returns.service.js";
import { SalesService } from "../src/modules/sales/sales.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_receipt_reversal_verify"))
  throw new Error(
    "This verification script may only use an isolated receipt reversal verification database.",
  );

const prisma = new PrismaService();
const sales = new SalesService(prisma);
const salesReturns = new SalesReturnsService(prisma);
const salesReversals = new SalesReversalsService(prisma);
const receipts = new ReceivablesService(prisma);
const reversals = new ReceiptReversalsService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "receipt-reversal-verifier",
      displayName: "收款反核销验证员",
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
    data: { code: "RECEIPT-REV", name: "收款反核销验证仓", isDefault: true },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { code: "LS-M12-045" },
  });
  await prisma.inventoryBalance.create({
    data: {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 30,
      totalCost: 30,
      averageCost: 1,
    },
  });
  const customer = await prisma.party.create({
    data: {
      code: "RECEIPT-REV-CUSTOMER",
      name: "收款反核销验证客户",
      roles: { create: { type: "CUSTOMER" } },
    },
  });
  const cashAccount = await prisma.cashAccount.create({
    data: {
      code: "RECEIPT-REV-CASH",
      name: "反核销验证现金",
      type: "CASH",
      createdById: user.id,
      balance: { create: { amount: 0 } },
    },
  });

  const reversibleSale = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T03:00:00.000Z",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "50" }],
    },
    actor,
  );
  await sales.submit(reversibleSale.id, reversibleSale.version, actor);
  await sales.post(reversibleSale.id, "verify-receipt-rev-sale-01", actor);
  const firstEntry = await prisma.receivableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: reversibleSale.id },
  });
  const receipt = await receipts.postReceipt(
    {
      customerId: customer.id,
      cashAccountId: cashAccount.id,
      businessDate: "2026-08-31",
      allocations: [{ receivableEntryId: firstEntry.id, amount: "40" }],
    },
    "verify-receipt-to-reverse-01",
    actor,
  );
  const reversal = await reversals.post(
    receipt.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:00:00.000Z",
      reason: "核销错销售单",
    },
    "verify-receipt-reversal-001",
    actor,
  );
  const repeated = await reversals.post(
    receipt.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:00:00.000Z",
      reason: "核销错销售单",
    },
    "verify-receipt-reversal-001",
    actor,
  );
  if (reversal.id !== repeated.id)
    throw new Error("Receipt reversal idempotency returned a second record.");

  await salesReversals.post(
    reversibleSale.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T23:10:00.000Z",
      reason: "客户选错",
    },
    "verify-sale-after-receipt-rev",
    actor,
  );

  const returnedSale = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T06:00:00.000Z",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "10", unitPrice: "10" }],
    },
    actor,
  );
  await sales.submit(returnedSale.id, returnedSale.version, actor);
  await sales.post(returnedSale.id, "verify-returned-receipt-sale", actor);
  const secondEntry = await prisma.receivableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: returnedSale.id },
  });
  const downstreamReceipt = await receipts.postReceipt(
    {
      customerId: customer.id,
      cashAccountId: cashAccount.id,
      businessDate: "2026-08-31",
      allocations: [{ receivableEntryId: secondEntry.id, amount: "40" }],
    },
    "verify-receipt-before-return-1",
    actor,
  );
  await salesReturns.post(
    {
      sourceSalesDocumentId: returnedSale.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T07:00:00.000Z",
      reason: "真实退货",
      lines: [{ sourceSalesLineId: returnedSale.lines[0].id, quantity: "1" }],
    },
    "verify-return-after-receipt-01",
    actor,
  );
  let downstreamReturnBlocked = false;
  try {
    await reversals.post(
      downstreamReceipt.id,
      {
        businessDate: "2026-08-31",
        reversedAt: "2026-08-31T23:20:00.000Z",
        reason: "不应成功",
      },
      "verify-blocked-receipt-rev-1",
      actor,
    );
  } catch {
    downstreamReturnBlocked = true;
  }

  const [firstEntryAfter, secondEntryAfter, inventory, balance, reversalCount] =
    await Promise.all([
      prisma.receivableEntry.findUniqueOrThrow({
        where: { id: firstEntry.id },
      }),
      prisma.receivableEntry.findUniqueOrThrow({
        where: { id: secondEntry.id },
      }),
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.cashBalance.findUniqueOrThrow({
        where: { cashAccountId: cashAccount.id },
      }),
      prisma.customerReceiptReversal.count(),
    ]);
  if (
    firstEntryAfter.status !== "REVERSED" ||
    !firstEntryAfter.outstandingAmount.eq(0) ||
    !secondEntryAfter.outstandingAmount.eq(50) ||
    !inventory.quantity.eq(21) ||
    !balance.amount.eq(40) ||
    reversalCount !== 1 ||
    !downstreamReturnBlocked
  )
    throw new Error("Receipt reversal ledger invariants did not reconcile.");

  console.log("customer receipt reversal integration verification passed");
}

main().finally(() => prisma.$disconnect());
