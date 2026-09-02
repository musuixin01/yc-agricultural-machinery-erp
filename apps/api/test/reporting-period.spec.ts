import { describe, expect, it, vi } from "vitest";
import { ReportingService } from "../src/modules/reporting/reporting.service.js";

function service() {
  return new ReportingService({} as never) as unknown as {
    periodRange: (
      period: "TODAY" | "LAST_7_DAYS" | "THIS_MONTH",
      today: string,
    ) => { start: Date; end: Date };
  };
}

describe("reporting dashboard period range", () => {
  it("keeps today metrics and trend inside the selected day", () => {
    const range = service().periodRange("TODAY", "2026-09-02");
    expect(range.start.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("uses exactly seven calendar days for the seven-day selection", () => {
    const range = service().periodRange("LAST_7_DAYS", "2026-09-02");
    expect(range.start.toISOString()).toBe("2026-08-27T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("uses the complete current calendar month for the month selection", () => {
    const range = service().periodRange("THIS_MONTH", "2026-09-02");
    expect(range.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("passes the selected period boundaries into the trend query", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const reporting = new ReportingService({
      $queryRaw: queryRaw,
    } as never) as unknown as {
      salesTrend: (start: Date, end: Date) => Promise<unknown>;
    };
    const start = new Date("2026-09-01T00:00:00.000Z");
    const end = new Date("2026-10-01T00:00:00.000Z");

    await reporting.salesTrend(start, end);

    expect(queryRaw).toHaveBeenCalledOnce();
    const dates = queryRaw.mock.calls[0]
      .slice(1)
      .filter((value) => value instanceof Date);
    expect(dates).toEqual([start, end, start, end, start, end, start, end]);
  });
});
