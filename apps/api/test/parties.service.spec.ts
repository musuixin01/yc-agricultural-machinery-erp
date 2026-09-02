import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { PartiesRepository } from "../src/modules/parties/parties.repository.js";
import { PartiesService } from "../src/modules/parties/parties.service.js";
import type { PartyView } from "../src/modules/parties/parties.types.js";
const party: PartyView = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "KH-001",
  name: "测试客户",
  shortName: null,
  mnemonicCode: null,
  taxId: null,
  identityNumberMasked: null,
  hasPortrait: false,
  roles: ["CUSTOMER"],
  creditLimit: "1000.0000",
  paymentTermsDays: 30,
  paymentTermsMonths: 0,
  province: null,
  city: null,
  address: null,
  notes: null,
  contacts: [],
  status: "ACTIVE",
  version: 1,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
function repo(overrides: Partial<PartiesRepository> = {}): PartiesRepository {
  return {
    list: async () => ({ items: [party], page: 1, pageSize: 20, total: 1 }),
    findById: async () => party,
    create: async () => party,
    updateStatus: async () => ({ ...party, status: "INACTIVE", version: 2 }),
    ...overrides,
  };
}
describe("PartiesService", () => {
  it("returns a party list", async () => {
    const result = await new PartiesService(repo()).list({
      page: 1,
      pageSize: 20,
    });
    expect(result.total).toBe(1);
  });
  it("returns a clear not-found error", async () => {
    await expect(
      new PartiesService(repo({ findById: async () => null })).get(party.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it("protects optimistic status updates", async () => {
    await expect(
      new PartiesService(repo({ updateStatus: async () => null })).updateStatus(
        party.id,
        { status: "INACTIVE", version: 1 },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
