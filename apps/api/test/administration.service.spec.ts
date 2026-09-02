import { describe, expect, it, vi } from "vitest";
import { AdministrationService } from "../src/modules/administration/administration.service.js";

const actor = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "owner",
  displayName: "经营者",
  roles: ["OWNER"],
  permissions: ["administration.manage"],
  sessionId: "session",
};

function profile() {
  return {
    id: "primary",
    storeName: "玉春农机",
    shortName: "YC",
    phone: "13800000000",
    address: "河南省测试地址",
    receiptFooter: "感谢惠顾",
    defaultPaperSize: "RECEIPT_80MM" as const,
    version: 2,
    updatedAt: new Date("2026-09-02T03:00:00.000Z"),
    updatedBy: { id: actor.id, displayName: actor.displayName },
  };
}

describe("AdministrationService", () => {
  it("updates the singleton profile with optimistic locking and audit", async () => {
    const transaction = {
      businessProfile: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(profile()),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    const service = new AdministrationService(prisma as never);
    const result = await service.updateBusinessProfile(
      {
        storeName: " 玉春农机 ",
        shortName: " YC ",
        phone: " 13800000000 ",
        address: " 河南省测试地址 ",
        receiptFooter: " 感谢惠顾 ",
        defaultPaperSize: "RECEIPT_80MM",
        version: 1,
      },
      actor,
      "127.0.0.1",
    );
    expect(transaction.businessProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "primary", version: 1 },
        data: expect.objectContaining({
          storeName: "玉春农机",
          phone: "13800000000",
          version: { increment: 1 },
        }),
      }),
    );
    expect(transaction.auditEvent.create).toHaveBeenCalledOnce();
    expect(result.updatedAt).toBe("2026-09-02T03:00:00.000Z");
  });

  it("rejects a stale profile version without writing audit", async () => {
    const transaction = {
      businessProfile: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditEvent: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    const service = new AdministrationService(prisma as never);
    await expect(
      service.updateBusinessProfile(
        {
          storeName: "玉春农机",
          shortName: "YC",
          defaultPaperSize: "A4",
          version: 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: { code: "BUSINESS_PROFILE_VERSION_CONFLICT" },
    });
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
  });
});
