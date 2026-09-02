import { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import {
  calculateLineAmount,
  calculateMovingAverage,
  calculatePurchaseReturnSettlement,
  remainingPurchaseReturnQuantity,
} from "../src/modules/purchasing/purchasing.rules.js";

describe("purchasing cost rules", () => {
  it("calculates receipt amounts with decimal arithmetic", () => {
    expect(calculateLineAmount("3.5", "8.7654").toString()).toBe("30.6789");
  });

  it("calculates moving weighted average without JavaScript floats", () => {
    expect(
      calculateMovingAverage(
        new Prisma.Decimal("10"),
        new Prisma.Decimal("100"),
        new Prisma.Decimal("5"),
        new Prisma.Decimal("100"),
      ).toString(),
    ).toBe("13.3333");
  });

  it("uses incoming cost when the previous balance is zero", () => {
    expect(
      calculateMovingAverage(
        new Prisma.Decimal("0"),
        new Prisma.Decimal("0"),
        new Prisma.Decimal("2"),
        new Prisma.Decimal("25"),
      ).toString(),
    ).toBe("12.5");
  });

  it("splits a purchase return between payable reduction and supplier refund", () => {
    const result = calculatePurchaseReturnSettlement(
      new Prisma.Decimal("80"),
      new Prisma.Decimal("30"),
    );
    expect(result.payableReduction.toString()).toBe("30");
    expect(result.refundAmount.toString()).toBe("50");
  });

  it("limits cumulative returns to the original purchase quantity", () => {
    expect(
      remainingPurchaseReturnQuantity(
        new Prisma.Decimal("10"),
        new Prisma.Decimal("4.5"),
      ).toString(),
    ).toBe("5.5");
  });
});
