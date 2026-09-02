import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { DashboardPeriod } from "./dto/dashboard-query.dto.js";

type TrendRow = {
  day: Date;
  salesGross: Prisma.Decimal;
  salesReturns: Prisma.Decimal;
  salesReversals: Prisma.Decimal;
  salesNet: Prisma.Decimal;
};

type StockSummaryRow = {
  lowStockCount: bigint;
  negativeStockCount: bigint;
};

type LowStockRow = {
  id: string;
  code: string;
  name: string;
  unitName: string;
  quantity: Prisma.Decimal;
  safetyStock: Prisma.Decimal;
};

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(period: DashboardPeriod = "TODAY", now = new Date()) {
    const today = this.chinaDate(now);
    const { start, end } = this.periodRange(period, today);
    const todayDate = this.utcDate(today);

    const [
      sales,
      returns,
      reversals,
      receivables,
      overdueReceivables,
      payables,
      overduePayables,
      cashAccounts,
      stockSummary,
      lowStockItems,
      overdueCustomers,
      recentSales,
      trend,
    ] = await Promise.all([
      this.prisma.salesDocument.aggregate({
        where: {
          status: { in: ["POSTED", "REVERSED"] },
          businessDate: { gte: start, lt: end },
        },
        _sum: { totalAmount: true, grossProfit: true },
        _count: { id: true },
      }),
      this.prisma.salesReturn.aggregate({
        where: { businessDate: { gte: start, lt: end } },
        _sum: { totalAmount: true, totalCost: true },
        _count: { id: true },
      }),
      this.prisma.salesReversal.aggregate({
        where: { businessDate: { gte: start, lt: end } },
        _sum: { totalAmount: true, totalCost: true },
        _count: { id: true },
      }),
      this.prisma.receivableEntry.aggregate({
        where: { status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        _sum: { outstandingAmount: true },
        _count: { id: true },
      }),
      this.prisma.receivableEntry.aggregate({
        where: {
          status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
          dueDate: { lt: todayDate },
        },
        _sum: { outstandingAmount: true },
        _count: { id: true },
      }),
      this.prisma.payableEntry.aggregate({
        where: { status: { in: ["OPEN", "PARTIALLY_SETTLED"] } },
        _sum: { outstandingAmount: true },
        _count: { id: true },
      }),
      this.prisma.payableEntry.aggregate({
        where: {
          status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
          dueDate: { lt: todayDate },
        },
        _sum: { outstandingAmount: true },
        _count: { id: true },
      }),
      this.prisma.cashAccount.findMany({
        where: { status: "ACTIVE" },
        select: { balance: { select: { amount: true } } },
      }),
      this.stockSummary(),
      this.lowStockItems(),
      this.prisma.receivableEntry.findMany({
        where: {
          status: { in: ["OPEN", "PARTIALLY_SETTLED"] },
          dueDate: { lt: todayDate },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              contacts: {
                where: { isPrimary: true },
                select: { phone: true },
                take: 1,
              },
            },
          },
          sourceDocument: { select: { documentNumber: true } },
        },
        orderBy: [{ dueDate: "asc" }, { outstandingAmount: "desc" }],
        take: 5,
      }),
      this.prisma.salesDocument.findMany({
        where: { status: { in: ["POSTED", "REVERSED"] } },
        select: {
          id: true,
          documentNumber: true,
          status: true,
          settlementType: true,
          customerNameSnapshot: true,
          totalAmount: true,
          soldAt: true,
        },
        orderBy: { soldAt: "desc" },
        take: 5,
      }),
      this.salesTrend(start, end),
    ]);

    const salesGross = sales._sum.totalAmount ?? new Prisma.Decimal(0);
    const salesReturns = returns._sum.totalAmount ?? new Prisma.Decimal(0);
    const salesReversals = reversals._sum.totalAmount ?? new Prisma.Decimal(0);
    const salesNet = salesGross.sub(salesReturns).sub(salesReversals);
    const salesGrossProfit = sales._sum.grossProfit ?? new Prisma.Decimal(0);
    const returnedProfit = salesReturns.sub(
      returns._sum.totalCost ?? new Prisma.Decimal(0),
    );
    const reversedProfit = salesReversals.sub(
      reversals._sum.totalCost ?? new Prisma.Decimal(0),
    );
    const cashTotal = cashAccounts.reduce(
      (sum, item) => sum.add(item.balance?.amount ?? 0),
      new Prisma.Decimal(0),
    );

    return {
      period,
      periodStart: start.toISOString().slice(0, 10),
      periodEndExclusive: end.toISOString().slice(0, 10),
      timezone: "Asia/Shanghai",
      generatedAt: now.toISOString(),
      sales: {
        gross: salesGross.toString(),
        returns: salesReturns.toString(),
        reversals: salesReversals.toString(),
        net: salesNet.toString(),
        grossProfit: salesGrossProfit
          .sub(returnedProfit)
          .sub(reversedProfit)
          .toString(),
        postedCount: sales._count.id,
        returnCount: returns._count.id,
        reversalCount: reversals._count.id,
      },
      receivables: {
        outstanding: (
          receivables._sum.outstandingAmount ?? new Prisma.Decimal(0)
        ).toString(),
        count: receivables._count.id,
        overdueAmount: (
          overdueReceivables._sum.outstandingAmount ?? new Prisma.Decimal(0)
        ).toString(),
        overdueCount: overdueReceivables._count.id,
      },
      payables: {
        outstanding: (
          payables._sum.outstandingAmount ?? new Prisma.Decimal(0)
        ).toString(),
        count: payables._count.id,
        overdueAmount: (
          overduePayables._sum.outstandingAmount ?? new Prisma.Decimal(0)
        ).toString(),
        overdueCount: overduePayables._count.id,
      },
      inventory: {
        lowStockProductCount: Number(stockSummary.lowStockCount),
        negativeStockProductCount: Number(stockSummary.negativeStockCount),
        items: lowStockItems.map((item) => ({
          ...item,
          quantity: item.quantity.toString(),
          safetyStock: item.safetyStock.toString(),
        })),
      },
      cash: {
        balance: cashTotal.toString(),
        accountCount: cashAccounts.length,
      },
      overdueCustomers: overdueCustomers.map((item) => ({
        id: item.id,
        customerId: item.customer.id,
        customerName: item.customer.name,
        phone: item.customer.contacts[0]?.phone ?? null,
        documentNumber: item.sourceDocument.documentNumber,
        outstandingAmount: item.outstandingAmount.toString(),
        dueDate: item.dueDate.toISOString().slice(0, 10),
        overdueDays: Math.max(
          1,
          Math.floor(
            (todayDate.getTime() - item.dueDate.getTime()) / 86_400_000,
          ),
        ),
      })),
      recentSales: recentSales.map((item) => ({
        ...item,
        totalAmount: item.totalAmount.toString(),
        soldAt: item.soldAt.toISOString(),
      })),
      trend: trend.map((item) => ({
        date: item.day.toISOString().slice(0, 10),
        salesGross: item.salesGross.toString(),
        salesReturns: item.salesReturns.toString(),
        salesReversals: item.salesReversals.toString(),
        salesNet: item.salesNet.toString(),
      })),
    };
  }

  private async stockSummary() {
    const rows = await this.prisma.$queryRaw<StockSummaryRow[]>`
      WITH product_stock AS (
        SELECT p."id", p."safety_stock",
          COALESCE(SUM(ib."quantity") FILTER (WHERE w."status" = 'ACTIVE'), 0) AS quantity
        FROM "products" p
        LEFT JOIN "inventory_balances" ib ON ib."product_id" = p."id"
        LEFT JOIN "warehouses" w ON w."id" = ib."warehouse_id"
        WHERE p."status" = 'ACTIVE' AND p."type" <> 'SERVICE'
        GROUP BY p."id", p."safety_stock"
      )
      SELECT
        COUNT(*) FILTER (WHERE quantity <= "safety_stock") AS "lowStockCount",
        COUNT(*) FILTER (WHERE quantity < 0) AS "negativeStockCount"
      FROM product_stock
    `;
    return rows[0] ?? { lowStockCount: 0n, negativeStockCount: 0n };
  }

  private async lowStockItems() {
    return this.prisma.$queryRaw<LowStockRow[]>`
      SELECT p."id", p."code", p."name", u."name" AS "unitName",
        COALESCE(SUM(ib."quantity") FILTER (WHERE w."status" = 'ACTIVE'), 0) AS "quantity",
        p."safety_stock" AS "safetyStock"
      FROM "products" p
      JOIN "units" u ON u."id" = p."base_unit_id"
      LEFT JOIN "inventory_balances" ib ON ib."product_id" = p."id"
      LEFT JOIN "warehouses" w ON w."id" = ib."warehouse_id"
      WHERE p."status" = 'ACTIVE' AND p."type" <> 'SERVICE'
      GROUP BY p."id", p."code", p."name", u."name", p."safety_stock"
      HAVING COALESCE(SUM(ib."quantity") FILTER (WHERE w."status" = 'ACTIVE'), 0) <= p."safety_stock"
      ORDER BY
        CASE WHEN COALESCE(SUM(ib."quantity") FILTER (WHERE w."status" = 'ACTIVE'), 0) < 0 THEN 0
             WHEN COALESCE(SUM(ib."quantity") FILTER (WHERE w."status" = 'ACTIVE'), 0) = 0 THEN 1
             ELSE 2 END,
        p."name"
      LIMIT 5
    `;
  }

  private async salesTrend(start: Date, end: Date) {
    return this.prisma.$queryRaw<TrendRow[]>`
      WITH days AS (
        SELECT generate_series(${start}::date, (${end}::date - 1), interval '1 day')::date AS day
      ), sales AS (
        SELECT "business_date" AS day, SUM("total_amount") AS amount
        FROM "sales_documents"
        WHERE "status" IN ('POSTED', 'REVERSED')
          AND "business_date" >= ${start}::date AND "business_date" < ${end}::date
        GROUP BY "business_date"
      ), returns AS (
        SELECT "business_date" AS day, SUM("total_amount") AS amount
        FROM "sales_returns"
        WHERE "business_date" >= ${start}::date AND "business_date" < ${end}::date
        GROUP BY "business_date"
      ), reversals AS (
        SELECT "business_date" AS day, SUM("total_amount") AS amount
        FROM "sales_reversals"
        WHERE "business_date" >= ${start}::date AND "business_date" < ${end}::date
        GROUP BY "business_date"
      )
      SELECT d.day,
        COALESCE(s.amount, 0) AS "salesGross",
        COALESCE(r.amount, 0) AS "salesReturns",
        COALESCE(v.amount, 0) AS "salesReversals",
        COALESCE(s.amount, 0) - COALESCE(r.amount, 0) - COALESCE(v.amount, 0) AS "salesNet"
      FROM days d
      LEFT JOIN sales s ON s.day = d.day
      LEFT JOIN returns r ON r.day = d.day
      LEFT JOIN reversals v ON v.day = d.day
      ORDER BY d.day
    `;
  }

  private periodRange(period: DashboardPeriod, today: string) {
    const todayDate = this.utcDate(today);
    if (period === "LAST_7_DAYS")
      return {
        start: this.addDays(todayDate, -6),
        end: this.addDays(todayDate, 1),
      };
    if (period === "THIS_MONTH") {
      const [year, month] = today.split("-").map(Number);
      return {
        start: new Date(Date.UTC(year, month - 1, 1)),
        end: new Date(Date.UTC(year, month, 1)),
      };
    }
    return { start: todayDate, end: this.addDays(todayDate, 1) };
  }

  private chinaDate(value: Date) {
    return new Date(value.getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  private utcDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private addDays(value: Date, days: number) {
    return new Date(value.getTime() + days * 86_400_000);
  }
}
