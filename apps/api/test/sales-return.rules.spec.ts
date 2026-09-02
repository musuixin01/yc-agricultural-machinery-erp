import { describe, expect, it } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import {
  calculateReturnSettlement,
  remainingReturnQuantity,
} from "../src/modules/sales/sales-return.rules.js";

describe("sales return rules", () => {
  it("refunds an immediate sale", () => {
    const result = calculateReturnSettlement(
      "IMMEDIATE",
      new Prisma.Decimal(100),
      new Prisma.Decimal(0),
    );
    expect(result.receivableReduction.toString()).toBe("0");
    expect(result.refundAmount.toString()).toBe("100");
  });

  it("reduces unpaid credit before issuing a refund", () => {
    const unpaid = calculateReturnSettlement(
      "CREDIT",
      new Prisma.Decimal(30),
      new Prisma.Decimal(60),
    );
    const partlyPaid = calculateReturnSettlement(
      "CREDIT",
      new Prisma.Decimal(80),
      new Prisma.Decimal(60),
    );
    expect(unpaid.receivableReduction.toString()).toBe("30");
    expect(unpaid.refundAmount.toString()).toBe("0");
    expect(partlyPaid.receivableReduction.toString()).toBe("60");
    expect(partlyPaid.refundAmount.toString()).toBe("20");
  });

  it("tracks the remaining returnable quantity", () => {
    expect(
      remainingReturnQuantity(
        new Prisma.Decimal("5"),
        new Prisma.Decimal("2.5"),
      ).toString(),
    ).toBe("2.5");
  });
});
