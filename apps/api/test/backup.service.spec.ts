import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupService } from "../src/modules/administration/backup.service.js";

const actor = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "owner",
  displayName: "经营者",
  roles: ["OWNER"],
  permissions: ["administration.manage"],
  sessionId: "session",
};

describe("BackupService", () => {
  let directory = "";
  let secondaryDirectory = "";
  let tool: {
    create: ReturnType<typeof vi.fn>;
    inspect: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    auditEvent: { create: ReturnType<typeof vi.fn> };
    $disconnect: ReturnType<typeof vi.fn>;
    $connect: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
    user: { findUnique: ReturnType<typeof vi.fn> };
    authSession: { updateMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "yc-backup-test-"));
    secondaryDirectory = await mkdtemp(
      path.join(tmpdir(), "yc-secondary-test-"),
    );
    process.env.YC_BACKUP_DIRECTORY = directory;
    tool = {
      create: vi.fn(async (destination: string) => {
        await writeFile(destination, "trusted postgres archive");
      }),
      inspect: vi.fn().mockResolvedValue({ entryCount: 24 }),
      restore: vi.fn().mockResolvedValue(undefined),
    };
    prisma = {
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $connect: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      user: { findUnique: vi.fn().mockResolvedValue({ id: actor.id }) },
      authSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
  });

  afterEach(async () => {
    delete process.env.YC_BACKUP_DIRECTORY;
    await rm(directory, { recursive: true, force: true });
    await rm(secondaryDirectory, { recursive: true, force: true });
  });

  it("creates a custom archive record only after structure and hash verification", async () => {
    const service = new BackupService(prisma as never, tool as never);
    const record = await service.create(actor, "127.0.0.1");
    expect(record.status).toBe("VERIFIED");
    expect(record.entryCount).toBe(24);
    expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(tool.inspect).toHaveBeenCalledOnce();
    expect(
      JSON.parse(
        await readFile(path.join(directory, `${record.id}.json`), "utf8"),
      ),
    ).toMatchObject({ id: record.id });
  });

  it("marks a changed backup invalid without passing it to pg_restore", async () => {
    const service = new BackupService(prisma as never, tool as never);
    const record = await service.create(actor);
    await writeFile(path.join(directory, record.fileName), "tampered");
    tool.inspect.mockClear();
    const verified = await service.verify(record.id, actor);
    expect(verified.status).toBe("INVALID");
    expect(tool.inspect).not.toHaveBeenCalled();
  });

  it("copies a verified backup and metadata to a writable second directory", async () => {
    const service = new BackupService(prisma as never, tool as never);
    const record = await service.create(null, undefined, "AUTOMATIC");
    await service.copyToSecondary(record, secondaryDirectory);
    expect(
      await readFile(path.join(secondaryDirectory, record.fileName), "utf8"),
    ).toBe("trusted postgres archive");
    expect(
      JSON.parse(
        await readFile(
          path.join(secondaryDirectory, `${record.id}.json`),
          "utf8",
        ),
      ),
    ).toMatchObject({ id: record.id, kind: "AUTOMATIC" });
  });

  it("rejects a second directory that overlaps the primary backup folder", async () => {
    const service = new BackupService(prisma as never, tool as never);
    await expect(
      service.validateSecondaryDirectory(path.join(directory, "copy")),
    ).rejects.toMatchObject({
      response: { code: "BACKUP_SECONDARY_DIRECTORY_OVERLAPS" },
    });
  });

  it("requires the exact restore phrase before creating a safety snapshot", async () => {
    const service = new BackupService(prisma as never, tool as never);
    const record = await service.create(actor);
    await expect(
      service.restore(record.id, "恢复", actor),
    ).rejects.toMatchObject({
      response: { code: "RESTORE_CONFIRMATION_MISMATCH" },
    });
    expect(tool.restore).not.toHaveBeenCalled();
    expect(tool.create).toHaveBeenCalledTimes(1);
  });

  it("creates a safety snapshot, restores atomically, reconnects and audits", async () => {
    const service = new BackupService(prisma as never, tool as never);
    const record = await service.create(actor);
    const result = await service.restore(record.id, `恢复 ${record.id}`, actor);
    expect(result.safetyBackup.kind).toBe("PRE_RESTORE");
    expect(tool.create).toHaveBeenCalledTimes(2);
    expect(tool.restore).toHaveBeenCalledOnce();
    expect(prisma.$disconnect).toHaveBeenCalledBefore(tool.restore);
    expect(prisma.$connect).toHaveBeenCalledAfter(tool.restore);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
