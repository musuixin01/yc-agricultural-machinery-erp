import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "../src/modules/catalog/catalog.service.js";
import type { CatalogRepository } from "../src/modules/catalog/catalog.repository.js";
import type { ProductView } from "../src/modules/catalog/catalog.types.js";

const product: ProductView = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "LS-M12-045",
  name: "高强度螺栓 M12×45",
  mnemonicCode: "GQDLS",
  type: "STANDARD_PART",
  model: null,
  specification: "10.9 级 / 镀锌",
  category: {
    id: "00000000-0000-4000-8000-000000000002",
    code: "FASTENER",
    name: "螺丝标准件",
  },
  brand: null,
  baseUnit: {
    id: "00000000-0000-4000-8000-000000000003",
    code: "PCS",
    name: "个",
    decimalScale: 0,
  },
  retailPrice: "1.8000",
  wholesalePrice: "1.6000",
  defaultPurchasePrice: "1.1000",
  minimumSalePrice: "1.5000",
  safetyStock: "500.000000",
  barcodes: [],
  attributes: {},
  status: "ACTIVE",
  version: 1,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

function repository(
  overrides: Partial<CatalogRepository> = {},
): CatalogRepository {
  return {
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(product),
    create: vi.fn().mockResolvedValue(product),
    updateStatus: vi
      .fn()
      .mockResolvedValue({ ...product, status: "INACTIVE", version: 2 }),
    references: vi.fn(),
    ...overrides,
  } as CatalogRepository;
}

describe("CatalogService", () => {
  it("returns a product by id", async () => {
    await expect(
      new CatalogService(repository()).get(product.id),
    ).resolves.toEqual(product);
  });
  it("reports a missing product", async () => {
    await expect(
      new CatalogService(
        repository({ findById: vi.fn().mockResolvedValue(null) }),
      ).get(product.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it("detects optimistic concurrency conflicts", async () => {
    const service = new CatalogService(
      repository({ updateStatus: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      service.updateStatus(product.id, { status: "INACTIVE", version: 7 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
