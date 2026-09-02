import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { SalesService } from "../src/modules/sales/sales.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_sales_verify_"))
  throw new Error(
    "This verification script may only use an isolated sales verification database.",
  );

const prisma = new PrismaService();
const sales = new SalesService(prisma);

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "sales-verifier",
      displayName: "销售验证员",
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
    data: { code: "VERIFY", name: "验证仓", isDefault: true },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { code: "LS-M12-045" },
  });
  await prisma.inventoryBalance.create({
    data: {
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 10,
      totalCost: 10,
      averageCost: 1,
    },
  });
  const customer = await prisma.party.create({
    data: {
      code: "VERIFY-CUSTOMER",
      name: "验证欠款客户",
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
  const immediateSubmitted = await sales.submit(
    immediate.id,
    immediate.version,
    actor,
  );
  await sales.post(immediate.id, "verify-immediate-0001", actor);

  const credit = await sales.create(
    {
      settlementType: "CREDIT",
      customerId: customer.id,
      warehouseId: warehouse.id,
      businessDate: "2026-08-31",
      soldAt: "2026-08-31T03:13:46.000Z",
      dueDate: "2026-09-30",
      lines: [{ productId: product.id, quantity: "1", unitPrice: "30" }],
    },
    actor,
  );
  const creditSubmitted = await sales.submit(credit.id, credit.version, actor);
  await sales.post(credit.id, "verify-credit-0000001", actor);

  const [
    immediateReceivable,
    creditReceivable,
    cashInflow,
    cashBalance,
    savedImmediate,
  ] = await Promise.all([
    prisma.receivableEntry.findUnique({
      where: { sourceDocumentId: immediate.id },
    }),
    prisma.receivableEntry.findUnique({
      where: { sourceDocumentId: credit.id },
    }),
    prisma.cashLedgerEntry.findUnique({
      where: {
        sourceDocumentType_sourceDocumentId: {
          sourceDocumentType: "CASH_SALE",
          sourceDocumentId: immediate.id,
        },
      },
    }),
    prisma.cashBalance.findFirst({
      where: { cashAccount: { code: "YC-CASH" } },
    }),
    prisma.salesDocument.findUniqueOrThrow({ where: { id: immediate.id } }),
  ]);

  if (immediateReceivable)
    throw new Error("Immediate sale incorrectly created customer debt.");
  if (!creditReceivable || !creditReceivable.outstandingAmount.eq(30))
    throw new Error("Credit sale did not create the expected customer debt.");
  if (
    !cashInflow ||
    !cashInflow.amountChange.eq(20) ||
    !cashBalance?.amount.eq(20)
  )
    throw new Error("Immediate sale did not create the expected cash inflow.");
  if (savedImmediate.soldAt.toISOString() !== "2026-08-31T03:12:45.000Z")
    throw new Error("The second-level sale time was not preserved.");
  if (
    immediateSubmitted.settlementType !== "IMMEDIATE" ||
    creditSubmitted.settlementType !== "CREDIT"
  )
    throw new Error("Settlement type changed during submit.");

  console.log("sales settlement integration verification passed");
}

main().finally(() => prisma.$disconnect());
