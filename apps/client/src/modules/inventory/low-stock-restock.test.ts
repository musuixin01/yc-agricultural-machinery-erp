import { describe, it, expect } from "vitest";
import { inventoryApi } from "./inventory-api";
import { purchasingApi } from "../purchasing/purchasing-api";

describe("Low Stock Safety Alert & Intelligent Auto-Restock Flow", () => {
  it("should find low stock items below or equal to safety stock", async () => {
    const balances = await inventoryApi.balances();
    expect(balances.items).toBeDefined();

    const lowStockItems = balances.items.filter(
      (item) => Number(item.quantity) <= Number(item.product.safetyStock || 0),
    );

    expect(lowStockItems.length).toBeGreaterThan(0);
    const first = lowStockItems[0];
    expect(Number(first.quantity)).toBeLessThanOrEqual(
      Number(first.product.safetyStock),
    );
  });

  it("should create a draft purchase order directly from low stock alert items", async () => {
    const balances = await inventoryApi.balances();
    const lowStockItems = balances.items.filter(
      (item) => Number(item.quantity) <= Number(item.product.safetyStock || 0),
    );

    expect(lowStockItems.length).toBeGreaterThan(0);

    const testItem = lowStockItems[0];
    const safetyStock = Number(testItem.product.safetyStock || 10);
    const currentQty = Number(testItem.quantity);
    const suggestedQty = Math.max(1, safetyStock - currentQty);

    const suppliers = await purchasingApi.receipts();
    // Create restock purchase draft
    const newPurchase = await purchasingApi.create({
      supplierId: "s-shougang",
      warehouseId: testItem.warehouse.id,
      businessDate: "2026-09-02",
      dueDate: "2026-09-02",
      notes: "【自动化测试】安全库存预警一键采购补货",
      lines: [
        {
          productId: testItem.product.id,
          quantity: String(suggestedQty),
          unitPrice: testItem.averageCost || "20.00",
        },
      ],
    });

    expect(newPurchase.id).toBeDefined();
    expect(newPurchase.lines.length).toBe(1);
    expect(newPurchase.lines[0].product.id).toBe(testItem.product.id);
    expect(Number(newPurchase.lines[0].quantity)).toBe(suggestedQty);

    // Verify replenishment flow
    const updatedBalances = await inventoryApi.balances();
    const replenished = updatedBalances.items.find(
      (b) =>
        b.warehouse.id === testItem.warehouse.id &&
        b.product.id === testItem.product.id,
    );

    expect(replenished).toBeDefined();
    expect(Number(replenished!.quantity)).toBe(currentQty + suggestedQty);
    expect(Number(replenished!.quantity)).toBeGreaterThanOrEqual(safetyStock);
  });
});
