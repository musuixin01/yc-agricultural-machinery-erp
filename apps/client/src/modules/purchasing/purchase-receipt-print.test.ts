import { describe, it, expect } from "vitest";
import {
  buildPurchaseReceiptPrintModel,
  convertNumberToChineseMoney,
} from "./purchase-receipt-print";
import type { PurchaseReceipt } from "./purchasing-api";

describe("Document Print Center - Purchase Receipt Print Model", () => {
  it("should convert numeric amounts to Chinese upper case currency words correctly", () => {
    expect(convertNumberToChineseMoney(0)).toBe("零元整");
    expect(convertNumberToChineseMoney("100")).toBe("壹佰元整");
    expect(convertNumberToChineseMoney(1234.56)).toBe(
      "壹仟贰佰叁拾肆元伍角陆分",
    );
    expect(convertNumberToChineseMoney("88888.80")).toBe(
      "捌万捌仟捌佰捌拾捌元捌角",
    );
  });

  it("should generate complete print view model with totals and fallback metadata", () => {
    const dummyReceipt: PurchaseReceipt = {
      id: "pr-101",
      documentNumber: "CG-20260902-0001",
      businessDate: "2026-09-02",
      receivedAt: "2026-09-02T10:00:00Z",
      supplier: {
        id: "s-shougang",
        code: "GYS-001",
        name: "首钢特钢配件集团",
        phone: "13900000000",
      },
      warehouse: {
        id: "wh-main",
        code: "CK-01",
        name: "总库一号仓",
      },
      totalAmount: "3600.00",
      lines: [
        {
          id: "l-1",
          product: { id: "p-1", code: "PJ-001", name: "重型旋耕机刀片" },
          quantity: "50",
          unitPrice: "60.00",
          lineAmount: "3000.00",
          unitNameSnapshot: "把",
        },
        {
          id: "l-2",
          product: { id: "p-2", code: "PJ-002", name: "防尘润滑油封" },
          quantity: "20",
          unitPrice: "30.00",
          lineAmount: "600.00",
          unitNameSnapshot: "个",
        },
      ],
      postedBy: { id: "u-1", displayName: "张仓管" },
      status: "POSTED",
      version: 1,
      notes: "供应商随车送达，全部合格入库",
    };

    const model = buildPurchaseReceiptPrintModel(dummyReceipt, null, "A4");
    expect(model.documentNumber).toBe("CG-20260902-0001");
    expect(model.supplierName).toBe("首钢特钢配件集团");
    expect(model.totalQuantity).toBe(70);
    expect(model.totalAmount).toBe("3600.00");
    expect(model.totalAmountChinese).toBe("叁仟陆佰元整");
    expect(model.lines.length).toBe(2);
  });
});
