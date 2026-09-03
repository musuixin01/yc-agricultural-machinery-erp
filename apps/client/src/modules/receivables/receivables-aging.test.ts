import { describe, it, expect } from "vitest";
import {
  analyzeReceivablesAging,
  buildDunningNotice,
  classifyAgingBucket,
  calculateDaysBetween,
  calculateMonthsBetween,
  DEFAULT_AGING_CONFIG_DAYS,
  DEFAULT_AGING_CONFIG_MONTHS,
} from "./receivables-aging";
import type { ReceivableEntry } from "./receivables-api";

describe("Receivables Aging & Dunning Center", () => {
  it("should calculate days and months between dates accurately", () => {
    expect(calculateDaysBetween("2026-08-01", "2026-08-31")).toBe(30);
    expect(calculateDaysBetween("2026-09-02", "2026-09-02")).toBe(0);
    expect(calculateDaysBetween("2026-09-10", "2026-09-02")).toBe(0);

    expect(calculateMonthsBetween("2026-08-02", "2026-09-02")).toBe(1);
    expect(calculateMonthsBetween("2026-06-02", "2026-09-02")).toBe(3);
    expect(calculateMonthsBetween("2026-01-02", "2026-09-02")).toBe(8);
  });

  it("should classify aging buckets accurately based on default days intervals", () => {
    // Default: 30, 60, 90
    expect(classifyAgingBucket(0, DEFAULT_AGING_CONFIG_DAYS)).toBe(1);
    expect(classifyAgingBucket(15, DEFAULT_AGING_CONFIG_DAYS)).toBe(1);
    expect(classifyAgingBucket(30, DEFAULT_AGING_CONFIG_DAYS)).toBe(1);
    expect(classifyAgingBucket(31, DEFAULT_AGING_CONFIG_DAYS)).toBe(2);
    expect(classifyAgingBucket(60, DEFAULT_AGING_CONFIG_DAYS)).toBe(2);
    expect(classifyAgingBucket(61, DEFAULT_AGING_CONFIG_DAYS)).toBe(3);
    expect(classifyAgingBucket(90, DEFAULT_AGING_CONFIG_DAYS)).toBe(3);
    expect(classifyAgingBucket(91, DEFAULT_AGING_CONFIG_DAYS)).toBe(4);
  });

  it("should classify aging buckets accurately based on default month intervals", () => {
    // Default months: 1, 3, 6
    expect(classifyAgingBucket(0.5, DEFAULT_AGING_CONFIG_MONTHS)).toBe(1);
    expect(classifyAgingBucket(1, DEFAULT_AGING_CONFIG_MONTHS)).toBe(1);
    expect(classifyAgingBucket(2, DEFAULT_AGING_CONFIG_MONTHS)).toBe(2);
    expect(classifyAgingBucket(3, DEFAULT_AGING_CONFIG_MONTHS)).toBe(2);
    expect(classifyAgingBucket(5, DEFAULT_AGING_CONFIG_MONTHS)).toBe(3);
    expect(classifyAgingBucket(6, DEFAULT_AGING_CONFIG_MONTHS)).toBe(3);
    expect(classifyAgingBucket(7, DEFAULT_AGING_CONFIG_MONTHS)).toBe(4);
    expect(classifyAgingBucket(12, DEFAULT_AGING_CONFIG_MONTHS)).toBe(4);
  });

  it("should aggregate customer receivables with Month mode and correct tier labels", () => {
    const mockEntries: ReceivableEntry[] = [
      {
        id: "r-1",
        customer: {
          id: "c-1",
          code: "KH-001",
          name: "绿野农机合作社",
          phone: "13800001111",
        },
        sourceDocument: {
          documentNumber: "XS-20260801-001",
          soldAt: "2026-08-01",
        },
        originalAmount: "10000.00",
        outstandingAmount: "10000.00",
        dueDate: "2026-08-15", // ~0.6 months overdue (< 1 month)
        status: "OPEN",
      },
      {
        id: "r-2",
        customer: {
          id: "c-1",
          code: "KH-001",
          name: "绿野农机合作社",
          phone: "13800001111",
        },
        sourceDocument: {
          documentNumber: "XS-20260701-002",
          soldAt: "2026-07-01",
        },
        originalAmount: "5000.00",
        outstandingAmount: "5000.00",
        dueDate: "2026-07-02", // ~2 months overdue (1-3 months)
        status: "PARTIALLY_SETTLED",
      },
      {
        id: "r-3",
        customer: {
          id: "c-2",
          code: "KH-002",
          name: "金禾种业农资部",
          phone: "13900002222",
        },
        sourceDocument: {
          documentNumber: "XS-20260101-003",
          soldAt: "2026-01-01",
        },
        originalAmount: "20000.00",
        outstandingAmount: "20000.00",
        dueDate: "2026-01-15", // ~7.6 months overdue (> 6 months)
        status: "OPEN",
      },
    ];

    const monthOverview = analyzeReceivablesAging(
      mockEntries,
      "2026-09-02",
      DEFAULT_AGING_CONFIG_MONTHS,
    );

    expect(monthOverview.tierLabels.t1).toBe("0-1个月");
    expect(monthOverview.tierLabels.t2).toBe("1-3个月");
    expect(monthOverview.tierLabels.t3).toBe("3-6个月");
    expect(monthOverview.tierLabels.t4).toBe("6个月以上");

    expect(monthOverview.totalOutstanding).toBe(35000);
    expect(monthOverview.totalOverdue).toBe(35000);
    expect(monthOverview.bucketTotals.bucket1).toBe(10000);
    expect(monthOverview.bucketTotals.bucket2).toBe(5000);
    expect(monthOverview.bucketTotals.bucket4).toBe(20000);

    const c2 = monthOverview.customerSummaries.find(
      (c) => c.customerId === "c-2",
    );
    expect(c2).toBeDefined();
    expect(c2?.riskLevel).toBe("CRITICAL");
    expect(c2?.maxOverdueMonths).toBeGreaterThan(6);
  });

  it("should generate dunning notices with custom tone, month-aware duration and bank details", () => {
    const mockEntries: ReceivableEntry[] = [
      {
        id: "r-1",
        customer: {
          id: "c-1",
          code: "KH-001",
          name: "绿野农机合作社",
          phone: "13800001111",
        },
        sourceDocument: {
          documentNumber: "XS-20260501-001",
          soldAt: "2026-05-01",
        },
        originalAmount: "10000.00",
        outstandingAmount: "10000.00",
        dueDate: "2026-05-15", // ~3.6 months overdue
        status: "OPEN",
      },
    ];

    const overview = analyzeReceivablesAging(
      mockEntries,
      "2026-09-02",
      DEFAULT_AGING_CONFIG_MONTHS,
    );
    const summary = overview.customerSummaries[0];

    const formalNotice = buildDunningNotice(
      summary,
      null,
      "FORMAL",
      "2026-09-02",
    );
    expect(formalNotice.letterTitle).toContain("正式催款");
    expect(formalNotice.totalDue).toBe(10000);
    expect(formalNotice.bankAccount).toBeDefined();
    expect(formalNotice.letterBody.some((p) => p.includes("个月"))).toBe(true);

    const urgentNotice = buildDunningNotice(
      summary,
      null,
      "URGENT",
      "2026-09-02",
    );
    expect(urgentNotice.letterTitle).toContain("法务催收警告函");
    expect(urgentNotice.warningNote).toContain("人民法院");
  });
});
