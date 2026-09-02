import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ReportingService } from "../src/modules/reporting/reporting.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_dashboard_verify"))
  throw new Error(
    "This verification script may only use an isolated dashboard verification database.",
  );

const prisma = new PrismaService();
const reporting = new ReportingService(prisma);
const day = new Date("2026-09-01T00:00:00.000Z");

async function main() {
  const user = await prisma.user.create({
    data: {
      username: "dashboard-verifier",
      displayName: "经营看板验证员",
      passwordHash: "not-used-in-isolated-verification",
    },
  });
  const [unit, category, warehouse, customer, supplier, cashAccount] =
    await Promise.all([
      prisma.unit.create({ data: { code: "DASH-U", name: "件" } }),
      prisma.productCategory.create({
        data: { code: "DASH-C", name: "看板验证商品" },
      }),
      prisma.warehouse.create({
        data: {
          code: "DASH-W",
          name: "看板验证仓",
        },
      }),
      prisma.party.create({
        data: {
          code: "DASH-CUSTOMER",
          name: "逾期客户",
          roles: { create: { type: "CUSTOMER" } },
        },
      }),
      prisma.party.create({
        data: {
          code: "DASH-SUPPLIER",
          name: "测试供应商",
          roles: { create: { type: "SUPPLIER" } },
        },
      }),
      prisma.cashAccount.create({
        data: {
          code: "DASH-CASH",
          name: "看板验证资金",
          type: "CASH",
          createdById: user.id,
          balance: { create: { amount: 500 } },
        },
      }),
    ]);

  const product = await prisma.product.create({
    data: {
      code: "DASH-P",
      name: "低库存滤芯",
      type: "PART",
      categoryId: category.id,
      baseUnitId: unit.id,
      safetyStock: 5,
      inventoryBalances: {
        create: {
          warehouseId: warehouse.id,
          quantity: 2,
          totalCost: 20,
          averageCost: 10,
        },
      },
    },
  });
  const sale = await prisma.salesDocument.create({
    data: {
      documentNumber: "XS-DASH-001",
      settlementType: "CREDIT",
      businessDate: day,
      soldAt: new Date("2026-09-01T02:00:00.000Z"),
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      warehouseId: warehouse.id,
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
      totalAmount: 100,
      totalCost: 70,
      grossProfit: 30,
      createdById: user.id,
      lines: {
        create: {
          productId: product.id,
          productNameSnapshot: product.name,
          unitNameSnapshot: unit.name,
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
          unitCost: 70,
          costAmount: 70,
          grossProfit: 30,
        },
      },
    },
    include: { lines: true },
  });
  await prisma.salesDocument.update({
    where: { id: sale.id },
    data: {
      status: "POSTED",
      submittedById: user.id,
      submittedAt: new Date(),
      postedById: user.id,
      postedAt: new Date(),
    },
  });
  const reversedSale = await prisma.salesDocument.create({
    data: {
      documentNumber: "XS-DASH-002",
      settlementType: "IMMEDIATE",
      businessDate: day,
      soldAt: new Date("2026-09-01T03:00:00.000Z"),
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      warehouseId: warehouse.id,
      cashAccountId: cashAccount.id,
      dueDate: day,
      totalAmount: 10,
      totalCost: 6,
      grossProfit: 4,
      createdById: user.id,
      lines: {
        create: {
          productId: product.id,
          productNameSnapshot: product.name,
          unitNameSnapshot: unit.name,
          quantity: 1,
          unitPrice: 10,
          lineAmount: 10,
          unitCost: 6,
          costAmount: 6,
          grossProfit: 4,
        },
      },
    },
    include: { lines: true },
  });
  await prisma.salesDocument.update({
    where: { id: reversedSale.id },
    data: {
      status: "POSTED",
      submittedById: user.id,
      submittedAt: new Date(),
      postedById: user.id,
      postedAt: new Date(),
    },
  });
  await prisma.salesReturn.create({
    data: {
      documentNumber: "XSTH-DASH-001",
      idempotencyKey: "dashboard-return-001",
      sourceSalesDocumentId: sale.id,
      businessDate: day,
      returnedAt: new Date("2026-09-01T04:00:00.000Z"),
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      warehouseId: warehouse.id,
      cashAccountId: cashAccount.id,
      totalAmount: 20,
      totalCost: 5,
      receivableReduction: 0,
      refundAmount: 20,
      reason: "看板口径验证",
      postedById: user.id,
      lines: {
        create: {
          sourceSalesLineId: sale.lines[0].id,
          productId: product.id,
          productNameSnapshot: product.name,
          unitNameSnapshot: unit.name,
          quantity: 0.2,
          unitPrice: 100,
          lineAmount: 20,
          unitCost: 25,
          costAmount: 5,
        },
      },
    },
  });
  await prisma.salesReversal.create({
    data: {
      documentNumber: "XSCX-DASH-001",
      idempotencyKey: "dashboard-reversal-001",
      sourceSalesDocumentId: reversedSale.id,
      businessDate: day,
      reversedAt: new Date("2026-09-01T05:00:00.000Z"),
      totalAmount: 10,
      totalCost: 6,
      reason: "看板冲销口径验证",
      postedById: user.id,
      lines: {
        create: {
          sourceSalesLineId: reversedSale.lines[0].id,
          productId: product.id,
          productNameSnapshot: product.name,
          unitNameSnapshot: unit.name,
          quantity: 1,
          unitPrice: 10,
          lineAmount: 10,
          unitCost: 6,
          costAmount: 6,
        },
      },
    },
  });
  await prisma.salesDocument.update({
    where: { id: reversedSale.id },
    data: { status: "REVERSED" },
  });
  await prisma.receivableEntry.create({
    data: {
      customerId: customer.id,
      sourceDocumentId: sale.id,
      originalAmount: 100,
      outstandingAmount: 60,
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
      status: "PARTIALLY_SETTLED",
      postedById: user.id,
    },
  });
  const purchase = await prisma.purchaseDocument.create({
    data: {
      documentNumber: "CG-DASH-001",
      status: "POSTED",
      businessDate: day,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      dueDate: new Date("2026-08-25T00:00:00.000Z"),
      totalAmount: 40,
      createdById: user.id,
      submittedById: user.id,
      submittedAt: new Date(),
      postedById: user.id,
      postedAt: new Date(),
    },
  });
  await prisma.payableEntry.create({
    data: {
      supplierId: supplier.id,
      sourceDocumentId: purchase.id,
      originalAmount: 40,
      outstandingAmount: 40,
      dueDate: new Date("2026-08-25T00:00:00.000Z"),
      postedById: user.id,
    },
  });

  const view = await reporting.dashboard(
    "TODAY",
    new Date("2026-09-01T14:30:00.000Z"),
  );
  if (
    view.sales.gross !== "110" ||
    view.sales.returns !== "20" ||
    view.sales.reversals !== "10" ||
    view.sales.net !== "80" ||
    view.sales.grossProfit !== "15" ||
    view.receivables.outstanding !== "60" ||
    view.receivables.overdueAmount !== "60" ||
    view.payables.outstanding !== "40" ||
    view.inventory.lowStockProductCount !== 1 ||
    view.cash.balance !== "500" ||
    view.trend.length !== 1
  )
    throw new Error(
      `Dashboard aggregates did not reconcile: ${JSON.stringify(view)}`,
    );

  const transferAccount = await prisma.cashAccount.create({
    data: {
      code: "DASH-BANK",
      name: "看板转账账户",
      type: "BANK",
      createdById: user.id,
      balance: { create: { amount: 100 } },
    },
  });
  await prisma.cashBalance.update({
    where: { cashAccountId: cashAccount.id },
    data: { amount: { decrement: 100 } },
  });
  await prisma.cashBalance.update({
    where: { cashAccountId: transferAccount.id },
    data: { amount: { increment: 100 } },
  });
  const afterTransfer = await reporting.dashboard(
    "TODAY",
    new Date("2026-09-01T14:30:00.000Z"),
  );
  if (afterTransfer.cash.balance !== "600")
    throw new Error(
      "Cash total changed after account-to-account transfer simulation.",
    );

  console.log("dashboard integration verification passed");
}

main().finally(() => prisma.$disconnect());
