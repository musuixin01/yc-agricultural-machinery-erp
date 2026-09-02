import { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import {
  nextPayableStatus,
  restoredPayableStatus,
  sumAllocations,
} from "../src/modules/payables/payables.rules.js";

describe("payable allocation rules", () => {
  it("sums allocations using decimal arithmetic", () => {
    expect(sumAllocations(["0.1", "0.2", "99.7"]).toString()).toBe("100");
  });

  it("settles only when outstanding is exactly zero", () => {
    expect(nextPayableStatus(new Prisma.Decimal("0"))).toBe("SETTLED");
    expect(nextPayableStatus(new Prisma.Decimal("0.0001"))).toBe(
      "PARTIALLY_SETTLED",
    );
  });

  it("restores open status only when the full original debt is outstanding", () => {
    expect(
      restoredPayableStatus(
        new Prisma.Decimal("100"),
        new Prisma.Decimal("100"),
      ),
    ).toBe("OPEN");
    expect(
      restoredPayableStatus(
        new Prisma.Decimal("60"),
        new Prisma.Decimal("100"),
      ),
    ).toBe("PARTIALLY_SETTLED");
  });
});
