import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { WarehousesRepository } from "../src/modules/warehouses/warehouses.repository.js";
import { WarehousesService } from "../src/modules/warehouses/warehouses.service.js";
import type { WarehouseView } from "../src/modules/warehouses/warehouses.types.js";

const warehouse: WarehouseView = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "YC-ZC",
  name: "玉春主仓",
  address: "门店后院",
  notes: null,
  isDefault: true,
  status: "ACTIVE",
  version: 1,
  locations: [
    {
      id: "00000000-0000-0000-0000-000000000002",
      code: "A-01",
      name: "配件一区",
      description: null,
      status: "ACTIVE",
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function repo(
  overrides: Partial<WarehousesRepository> = {},
): WarehousesRepository {
  return {
    list: async () => ({ items: [warehouse], page: 1, pageSize: 20, total: 1 }),
    findById: async () => warehouse,
    create: async () => warehouse,
    updateStatus: async () => ({
      ...warehouse,
      isDefault: false,
      status: "INACTIVE",
      version: 2,
    }),
    setDefault: async () => warehouse,
    ...overrides,
  };
}

describe("WarehousesService", () => {
  it("returns the warehouse list", async () => {
    const result = await new WarehousesService(repo()).list({
      page: 1,
      pageSize: 20,
    });
    expect(result.total).toBe(1);
  });

  it("returns a clear not-found error", async () => {
    await expect(
      new WarehousesService(repo({ findById: async () => null })).get(
        warehouse.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not allow the default warehouse to be disabled", async () => {
    await expect(
      new WarehousesService(repo()).updateStatus(warehouse.id, {
        status: "INACTIVE",
        version: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("protects optimistic status updates", async () => {
    const ordinary = { ...warehouse, isDefault: false };
    await expect(
      new WarehousesService(
        repo({
          findById: async () => ordinary,
          updateStatus: async () => null,
        }),
      ).updateStatus(ordinary.id, { status: "INACTIVE", version: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not allow an inactive warehouse to become default", async () => {
    const inactive = {
      ...warehouse,
      isDefault: false,
      status: "INACTIVE" as const,
    };
    await expect(
      new WarehousesService(
        repo({ findById: async () => inactive, setDefault: async () => null }),
      ).setDefault(inactive.id, { version: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
