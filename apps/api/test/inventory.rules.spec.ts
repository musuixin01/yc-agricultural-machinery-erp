import { describe, expect, it } from "vitest";
import {
  calculateLineAmount,
  calculateInventoryDamageCost,
  calculateStocktakeCost,
  calculateStocktakeVariance,
  canEstablishInitialStock,
  canInventoryTransition,
} from "../src/modules/inventory/inventory.rules.js";

describe("inventory ledger rules", () => {
  it("only allows the explicit document workflow", () => {
    expect(canInventoryTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canInventoryTransition("SUBMITTED", "POSTED")).toBe(true);
    expect(canInventoryTransition("POSTED", "DRAFT")).toBe(false);
    expect(canInventoryTransition("POSTED", "CANCELLED")).toBe(false);
  });

  it("calculates money as decimal and rounds half up to four places", () => {
    expect(calculateLineAmount("3", "0.1").toString()).toBe("0.3");
    expect(calculateLineAmount("1.234567", "8.7654").toString()).toBe(
      "10.8215",
    );
  });

  it("only establishes stock for a positive first quantity", () => {
    expect(canEstablishInitialStock(0, "5")).toBe(true);
    expect(canEstablishInitialStock(1, "5")).toBe(false);
    expect(canEstablishInitialStock(0, "0")).toBe(false);
  });

  it("derives stocktake variance from the count instead of accepting it", () => {
    expect(calculateStocktakeVariance("10", "12.5").toString()).toBe("2.5");
    expect(calculateStocktakeVariance("10", "8").toString()).toBe("-2");
  });

  it("keeps stocktake cost changes reconcilable to the resulting balance", () => {
    const result = calculateStocktakeCost("8", "3.3333", "33.3330");
    expect(result.nextTotalCost.toString()).toBe("26.6664");
    expect(result.costChange.toString()).toBe("-6.6666");
  });

  it("uses average cost for a partial damage issue", () => {
    expect(calculateInventoryDamageCost("3", "10", "50", "5").toString()).toBe(
      "15",
    );
  });

  it("uses the exact remaining total cost for a full damage issue", () => {
    expect(
      calculateInventoryDamageCost("3", "3", "9.9999", "3.3333").toString(),
    ).toBe("9.9999");
  });
});
