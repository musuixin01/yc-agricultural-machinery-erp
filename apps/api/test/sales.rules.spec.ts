import { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import {
  calculateGrossProfit,
  calculateSalesCost,
  calculateSalesLineAmount,
  salesPostingEffects,
} from "../src/modules/sales/sales.rules.js";

describe("sales amount and cost rules", () => {
  it("calculates sales amounts with decimal arithmetic", () => {
    expect(calculateSalesLineAmount("3.5", "8.7654").toString()).toBe(
      "30.6789",
    );
  });

  it("freezes outbound cost with four-place rounding", () => {
    expect(
      calculateSalesCost(
        new Prisma.Decimal("3"),
        new Prisma.Decimal("13.3333"),
      ).toString(),
    ).toBe("39.9999");
  });

  it("calculates gross profit without JavaScript floating point", () => {
    expect(
      calculateGrossProfit(
        new Prisma.Decimal("59.99"),
        new Prisma.Decimal("39.9999"),
      ).toString(),
    ).toBe("19.9901");
  });

  it("posts an immediate sale to cash without creating customer debt", () => {
    expect(salesPostingEffects("IMMEDIATE")).toEqual({
      createCashInflow: true,
      createReceivable: false,
    });
  });

  it("posts a credit sale to customer debt without recording cash received", () => {
    expect(salesPostingEffects("CREDIT")).toEqual({
      createCashInflow: false,
      createReceivable: true,
    });
  });
});
