import { describe, expect, it } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import {
  nextReceivableStatus,
  restoredReceivableStatus,
  sumReceiptAllocations,
} from "../src/modules/receivables/receivables.rules.js";

describe("receivable receipt rules", () => {
  it("sums receipt allocations without floating point loss", () => {
    expect(sumReceiptAllocations(["0.1", "0.2"]).toString()).toBe("0.3");
  });

  it("settles only when no outstanding amount remains", () => {
    expect(nextReceivableStatus(new Prisma.Decimal(0))).toBe("SETTLED");
    expect(nextReceivableStatus(new Prisma.Decimal("0.0001"))).toBe(
      "PARTIALLY_SETTLED",
    );
  });

  it("restores open or partially settled status after reversal", () => {
    expect(
      restoredReceivableStatus(
        new Prisma.Decimal(100),
        new Prisma.Decimal(100),
      ),
    ).toBe("OPEN");
    expect(
      restoredReceivableStatus(new Prisma.Decimal(60), new Prisma.Decimal(100)),
    ).toBe("PARTIALLY_SETTLED");
  });
});
