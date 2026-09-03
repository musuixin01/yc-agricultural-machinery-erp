import { describe, it, expect } from "vitest";
import {
  buildBarcodePrintViewModel,
  generateCode128Bars,
  generateQRCodeMatrix,
  DEFAULT_LABEL_CONFIG,
  type BarcodePrintItem,
} from "./product-barcode-print";
import type { Product } from "./catalog-api";

describe("product-barcode-print", () => {
  const mockProduct: Product = {
    id: "prod-1",
    code: "YC-MC-001",
    name: "微耕机 170F汽油风冷型",
    mnemonicCode: "WGJ",
    type: "MACHINE",
    model: "170F",
    specification: "4.0kW / 3600rpm",
    category: { id: "cat-1", code: "CAT-01", name: "整机设备" },
    brand: { id: "br-1", code: "BR-01", name: "玉春农机" },
    baseUnit: { id: "unit-1", code: "TAI", name: "台", decimalScale: 0 },
    retailPrice: "2480.00",
    wholesalePrice: "2100.00",
    defaultPurchasePrice: "1850.00",
    minimumSalePrice: "2000.00",
    safetyStock: "5",
    barcodes: [{ id: "bc-1", barcode: "6971234567890", isPrimary: true }],
    status: "ACTIVE",
    version: 1,
    attributes: {},
  };

  it("should build barcode view model and expand copies correctly", () => {
    const items: BarcodePrintItem[] = [
      {
        product: mockProduct,
        printCopies: 3,
        customPrice: "2480.00",
      },
    ];

    const model = buildBarcodePrintViewModel(items, DEFAULT_LABEL_CONFIG, {
      id: "biz-1",
      companyName: "玉春农机销售服务中心",
      taxNumber: "",
      phone: "",
      address: "",
      bankName: "",
      bankAccount: "",
    } as any);

    expect(model.totalCopies).toBe(3);
    expect(model.labels.length).toBe(3);
    expect(model.labels[0].productName).toBe("微耕机 170F汽油风冷型");
    expect(model.labels[0].barcode).toBe("6971234567890");
    expect(model.labels[0].retailPrice).toBe(2480);
    expect(model.labels[0].storeName).toBe("玉春农机销售服务中心");
  });

  it("should encode Code128 bar pattern correctly without crashing", () => {
    const bars = generateCode128Bars("6971234567890");
    expect(bars.length).toBeGreaterThan(50);
    expect(bars.some((b) => b === true)).toBe(true);
    expect(bars.some((b) => b === false)).toBe(true);
  });

  it("should generate 2D QR Code matrix with finder patterns", () => {
    const matrix = generateQRCodeMatrix("6971234567890", 21);
    expect(matrix.length).toBe(21);
    expect(matrix[0].length).toBe(21);
    // Top-left finder center should be true
    expect(matrix[3][3]).toBe(true);
    // Top-right finder center should be true
    expect(matrix[3][17]).toBe(true);
    // Bottom-left finder center should be true
    expect(matrix[17][3]).toBe(true);
  });
});
