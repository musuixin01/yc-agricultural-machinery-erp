import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupSchedulerService } from "../src/modules/administration/backup-scheduler.service.js";

const actor = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "owner",
  displayName: "经营者",
  roles: ["OWNER"],
  permissions: ["administration.manage"],
  sessionId: "session",
};

describe("BackupSchedulerService", () => {
  let directory = "";
  let backups: {
    create: ReturnType<typeof vi.fn>;
    enforceAutomaticRetention: ReturnType<typeof vi.fn>;
    validateSecondaryDirectory: ReturnType<typeof vi.fn>;
    copyToSecondary: ReturnType<typeof vi.fn>;
    enforceSecondaryAutomaticRetention: ReturnType<typeof vi.fn>;
  };
  let prisma: { auditEvent: { create: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "yc-policy-test-"));
    process.env.YC_BACKUP_DIRECTORY = directory;
    backups = {
      create: vi.fn().mockResolvedValue({ id: "automatic" }),
      enforceAutomaticRetention: vi.fn().mockResolvedValue(0),
      validateSecondaryDirectory: vi.fn().mockResolvedValue("E:\\玉春备份"),
      copyToSecondary: vi.fn().mockResolvedValue("E:\\玉春备份\\copy.dump"),
      enforceSecondaryAutomaticRetention: vi.fn().mockResolvedValue(0),
    };
    prisma = { auditEvent: { create: vi.fn().mockResolvedValue({}) } };
  });

  afterEach(async () => {
    delete process.env.YC_BACKUP_DIRECTORY;
    await rm(directory, { recursive: true, force: true });
  });

  it("calculates the next local run today or tomorrow", () => {
    const service = new BackupSchedulerService(
      backups as never,
      prisma as never,
    );
    expect(
      service
        .calculateNextRun(new Date("2026-09-02T10:00:00"), "21:00")
        .getDate(),
    ).toBe(2);
    expect(
      service
        .calculateNextRun(new Date("2026-09-02T22:00:00"), "21:00")
        .getDate(),
    ).toBe(3);
  });

  it("runs a due automatic backup and applies retention", async () => {
    const service = new BackupSchedulerService(
      backups as never,
      prisma as never,
    );
    const initial = await service.getPolicy();
    const policy = await service.updatePolicy(
      {
        enabled: true,
        backupTime: "21:00",
        retentionCount: 7,
        version: initial.version,
      },
      actor,
    );
    const ran = await service.runDue(
      new Date(new Date(policy.nextRunAt!).getTime() + 1_000),
    );
    expect(ran).toBe(true);
    expect(backups.create).toHaveBeenCalledWith(null, undefined, "AUTOMATIC");
    expect(backups.enforceAutomaticRetention).toHaveBeenCalledWith(7);
    expect((await service.getPolicy()).lastSuccessAt).not.toBeNull();
  });

  it("records a visible failure without exposing an unbounded error", async () => {
    backups.create.mockRejectedValue(new Error("pg_dump failed"));
    const service = new BackupSchedulerService(
      backups as never,
      prisma as never,
    );
    const initial = await service.getPolicy();
    const policy = await service.updatePolicy(
      {
        enabled: true,
        backupTime: "21:00",
        retentionCount: 3,
        version: initial.version,
      },
      actor,
    );
    expect(
      await service.runDue(
        new Date(new Date(policy.nextRunAt!).getTime() + 1_000),
      ),
    ).toBe(false);
    expect((await service.getPolicy()).lastFailureMessage).toBe(
      "pg_dump failed",
    );
  });

  it("keeps local backup successful and records a second-copy failure", async () => {
    backups.copyToSecondary.mockRejectedValue(new Error("drive unavailable"));
    const service = new BackupSchedulerService(
      backups as never,
      prisma as never,
    );
    const initial = await service.getPolicy();
    const policy = await service.updatePolicy(
      {
        enabled: true,
        backupTime: "21:00",
        retentionCount: 7,
        secondaryCopyEnabled: true,
        secondaryDirectory: "E:\\玉春备份",
        version: initial.version,
      },
      actor,
    );
    expect(
      await service.runDue(
        new Date(new Date(policy.nextRunAt!).getTime() + 1_000),
      ),
    ).toBe(true);
    const completed = await service.getPolicy();
    expect(completed.lastSuccessAt).not.toBeNull();
    expect(completed.lastSecondaryCopyFailureMessage).toBe("drive unavailable");
  });
});
