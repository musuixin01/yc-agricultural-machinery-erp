import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ReceivablesService } from "../src/modules/receivables/receivables.service.js";
import { SalesReversalsService } from "../src/modules/sales/sales-reversals.service.js";
import { SalesReturnsService } from "../src/modules/sales/sales-returns.service.js";
import { SalesService } from "../src/modules/sales/sales.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_sales_reversal_verify"))
  throw new Error(
    "This verification script may only use an isolated sales reversal verification database.",
  );

const prisma = new PrismaService();
const sales = new SalesService(prisma);
const reversals = new SalesReversalsService(prisma);
const returns = new SalesReturnsService(prisma);
const receivables = new ReceivablesService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "sales-reversal-verifier",
      displayName: "冲销验证员",
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
    data: { code: "REVERSAL-VERIFY", name: "冲销验证仓", isDefault: true },
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
      code: "REVERSAL-CUSTOMER",
      name: "冲销验证客户",
      roles: { create: { type: "CUSTOMER" } },
    },
  });

  const immediate = await sales.create(
    {
      settlementType: "IMMEDIATE",
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T03:00:00.000Z",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "10" }],
    },
    actor,
  );
  await sales.submit(immediate.id, immediate.version, actor);
  const postedImmediate = await sales.post(
    immediate.id,
    "verify-reversal-sale-0001",
    actor,
  );
  const cashAccountId = postedImmediate.cashAccount!.id;
  await reversals.post(
    immediate.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T04:00:00.000Z",
      reason: "重复开单",
    },
    "verify-immediate-reversal-01",
    actor,
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
  await sales.post(credit.id, "verify-reversal-credit-0001", actor);
  await reversals.post(
    credit.id,
    {
      businessDate: "2026-08-31",
      reversedAt: "2026-08-31T06:00:00.000Z",
      reason: "客户选错",
    },
    "verify-credit-reversal-0001",
    actor,
  );

  const returnedSale = await sales.create(
    {
      settlementType: "IMMEDIATE",
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T07:00:00.000Z",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "10" }],
    },
    actor,
  );
  await sales.submit(returnedSale.id, returnedSale.version, actor);
  await sales.post(returnedSale.id, "verify-returned-sale-000001", actor);
  await returns.post(
    {
      sourceSalesDocumentId: returnedSale.id,
      businessDate: "2026-08-31",
      returnedAt: "2026-08-31T08:00:00.000Z",
      cashAccountId,
      reason: "真实退货",
      lines: [{ sourceSalesLineId: returnedSale.lines[0].id, quantity: "1" }],
    },
    "verify-return-before-reverse-1",
    actor,
  );
  let returnedSaleBlocked = false;
  try {
    await reversals.post(
      returnedSale.id,
      {
        businessDate: "2026-08-31",
        reversedAt: "2026-08-31T09:00:00.000Z",
        reason: "不应成功",
      },
      "verify-returned-reversal-001",
      actor,
    );
  } catch {
    returnedSaleBlocked = true;
  }

  const receivedCredit = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T10:00:00.000Z",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "2", unitPrice: "30" }],
    },
    actor,
  );
  await sales.submit(receivedCredit.id, receivedCredit.version, actor);
  await sales.post(receivedCredit.id, "verify-received-credit-001", actor);
  const receivable = await prisma.receivableEntry.findUniqueOrThrow({
    where: { sourceDocumentId: receivedCredit.id },
  });
  await receivables.postReceipt(
    {
      customerId: customer.id,
      cashAccountId,
      businessDate: "2026-08-31",
      allocations: [{ receivableEntryId: receivable.id, amount: "10" }],
    },
    "verify-receipt-before-reversal",
    actor,
  );
  let receivedCreditBlocked = false;
  try {
    await reversals.post(
      receivedCredit.id,
      {
        businessDate: "2026-08-31",
        reversedAt: "2026-08-31T11:00:00.000Z",
        reason: "不应成功",
      },
      "verify-received-reversal-001",
      actor,
    );
  } catch {
    receivedCreditBlocked = true;
  }

  const [immediateState, creditEntry, inventory, cash, ledgerCount] =
    await Promise.all([
      prisma.salesDocument.findUniqueOrThrow({ where: { id: immediate.id } }),
      prisma.receivableEntry.findUniqueOrThrow({
        where: { sourceDocumentId: credit.id },
      }),
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.cashBalance.findUniqueOrThrow({ where: { cashAccountId } }),
      prisma.inventoryLedgerEntry.count({
        where: { sourceDocumentType: "SALES_REVERSAL" },
      }),
    ]);
  if (
    immediateState.status !== "REVERSED" ||
    creditEntry.status !== "REVERSED" ||
    !creditEntry.outstandingAmount.eq(0) ||
    !returnedSaleBlocked ||
    !receivedCreditBlocked ||
    !inventory.quantity.eq(27) ||
    !cash.amount.eq(20) ||
    ledgerCount !== 2
  )
    throw new Error("Sales reversal ledger invariants did not reconcile.");

  console.log("sales reversal integration verification passed");
}

main().finally(() => prisma.$disconnect());
