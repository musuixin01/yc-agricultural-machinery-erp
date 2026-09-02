import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import type { PostgresBackupTool } from "./backup-tool.js";
import { DockerPostgresBackupTool } from "./backup-tool.js";

export type BackupKind = "MANUAL" | "AUTOMATIC" | "PRE_RESTORE";
export type BackupStatus = "VERIFIED" | "INVALID";

export type BackupRecord = {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: { id: string; displayName: string } | null;
  kind: BackupKind;
  format: "PG_CUSTOM";
  sizeBytes: number;
  sha256: string;
  entryCount: number;
  status: BackupStatus;
  verifiedAt: string;
};

@Injectable()
export class BackupService {
  private operation: "BACKUP" | "RESTORE" | null = null;
  private readonly directory = path.resolve(
    process.env.YC_BACKUP_DIRECTORY ??
      path.join(process.cwd(), "../../data/backups"),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly tool: DockerPostgresBackupTool,
  ) {}

  async list() {
    await mkdir(this.directory, { recursive: true });
    const names = await readdir(this.directory);
    const records = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map((name) => this.readRecord(name.slice(0, -5)).catch(() => null)),
    );
    return {
      items: records
        .filter((record): record is BackupRecord => record !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      operation: this.operation,
      restoreConfirmationHint: "恢复 备份编号",
    };
  }

  async create(
    actor: AuthenticatedUser | null,
    ipAddress?: string,
    kind: BackupKind = "MANUAL",
    bypassLock = false,
  ) {
    if (!bypassLock) this.begin("BACKUP");
    try {
      await mkdir(this.directory, { recursive: true });
      const createdAt = new Date();
      const id = `${this.timestamp(createdAt)}-${randomUUID().slice(0, 8)}`;
      const fileName = `yc-erp-${id}.dump`;
      const destination = path.join(this.directory, fileName);
      try {
        await this.tool.create(destination);
        const inspection = await this.tool.inspect(destination);
        const file = await stat(destination);
        const record: BackupRecord = {
          id,
          fileName,
          createdAt: createdAt.toISOString(),
          createdBy: actor
            ? { id: actor.id, displayName: actor.displayName }
            : null,
          kind,
          format: "PG_CUSTOM",
          sizeBytes: file.size,
          sha256: await this.sha256(destination),
          entryCount: inspection.entryCount,
          status: "VERIFIED",
          verifiedAt: new Date().toISOString(),
        };
        await this.writeRecord(record);
        await this.audit(
          actor,
          "administration.backup.create",
          record.id,
          "SUCCESS",
          ipAddress,
          { kind, sizeBytes: record.sizeBytes, sha256: record.sha256 },
        );
        return record;
      } catch (error) {
        await rm(destination, { force: true }).catch(() => undefined);
        await this.audit(
          actor,
          "administration.backup.create",
          id,
          "FAILURE",
          ipAddress,
          { kind },
        ).catch(() => undefined);
        throw error;
      }
    } finally {
      if (!bypassLock) this.operation = null;
    }
  }

  async enforceAutomaticRetention(keep: number) {
    const automatic = (await this.list()).items.filter(
      (record) => record.kind === "AUTOMATIC",
    );
    const expired = automatic.slice(Math.max(0, keep));
    await Promise.all(
      expired.flatMap((record) => [
        rm(this.filePath(record), { force: true }),
        rm(path.join(this.directory, `${record.id}.json`), { force: true }),
      ]),
    );
    return expired.length;
  }

  async validateSecondaryDirectory(value: string) {
    const directory = this.secondaryDirectory(value);
    const probe = path.join(directory, `.yc-write-test-${randomUUID()}`);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(probe, "yc-backup-write-test", { flag: "wx" });
    } catch {
      throw new BadRequestException({
        code: "BACKUP_SECONDARY_DIRECTORY_NOT_WRITABLE",
        detail: "第二存储目录无法写入，请确认硬盘已连接且目录权限正确。",
      });
    } finally {
      await rm(probe, { force: true }).catch(() => undefined);
    }
    return directory;
  }

  async copyToSecondary(record: BackupRecord, value: string) {
    const directory = await this.validateSecondaryDirectory(value);
    const source = this.filePath(record);
    const destination = path.join(directory, record.fileName);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const metadata = path.join(directory, `${record.id}.json`);
    const metadataTemporary = `${metadata}.${randomUUID()}.tmp`;
    try {
      await copyFile(source, temporary);
      if ((await this.sha256(temporary)) !== record.sha256)
        throw new Error("第二存储副本完整性校验失败");
      await rename(temporary, destination);
      await writeFile(metadataTemporary, JSON.stringify(record, null, 2), {
        flag: "wx",
      });
      await rename(metadataTemporary, metadata);
      return destination;
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      await rm(metadataTemporary, { force: true }).catch(() => undefined);
      await rm(destination, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async enforceSecondaryAutomaticRetention(value: string, keep: number) {
    const directory = this.secondaryDirectory(value);
    const names = await readdir(directory);
    const records = await Promise.all(
      names
        .filter((name) => /^\d{8}T\d{6}-[a-f0-9]{8}\.json$/.test(name))
        .map((name) =>
          this.readRecordFrom(directory, name.slice(0, -5)).catch(() => null),
        ),
    );
    const automatic = records
      .filter(
        (record): record is BackupRecord =>
          record !== null && record.kind === "AUTOMATIC",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const expired = automatic.slice(Math.max(0, keep));
    await Promise.all(
      expired.flatMap((record) => [
        rm(path.join(directory, record.fileName), { force: true }),
        rm(path.join(directory, `${record.id}.json`), { force: true }),
      ]),
    );
    return expired.length;
  }

  async verify(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    this.begin("BACKUP");
    try {
      const record = await this.readRecord(id);
      const source = this.filePath(record);
      const currentHash = await this.sha256(source).catch(() => "");
      let entryCount = 0;
      let status: BackupStatus = "INVALID";
      if (currentHash && currentHash === record.sha256) {
        entryCount = (await this.tool.inspect(source)).entryCount;
        status = "VERIFIED";
      }
      const updated: BackupRecord = {
        ...record,
        entryCount,
        status,
        verifiedAt: new Date().toISOString(),
      };
      await this.writeRecord(updated);
      await this.audit(
        actor,
        "administration.backup.verify",
        id,
        status === "VERIFIED" ? "SUCCESS" : "FAILURE",
        ipAddress,
        { status },
      );
      return updated;
    } finally {
      this.operation = null;
    }
  }

  async download(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const record = await this.readRecord(id);
    if (record.status !== "VERIFIED") {
      throw new BadRequestException({
        code: "BACKUP_NOT_VERIFIED",
        detail: "该备份未通过完整性校验，不能下载。",
      });
    }
    const filePath = this.filePath(record);
    await stat(filePath).catch(() => {
      throw new NotFoundException({
        code: "BACKUP_FILE_MISSING",
        detail: "备份文件不存在。",
      });
    });
    await this.audit(
      actor,
      "administration.backup.download",
      id,
      "SUCCESS",
      ipAddress,
      { sha256: record.sha256, sizeBytes: record.sizeBytes },
    );
    return { record, filePath };
  }

  async restore(
    id: string,
    confirmation: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    this.begin("RESTORE");
    let safetyBackup: BackupRecord | null = null;
    try {
      const record = await this.readRecord(id);
      if (confirmation !== `恢复 ${record.id}`) {
        throw new BadRequestException({
          code: "RESTORE_CONFIRMATION_MISMATCH",
          detail: `请输入“恢复 ${record.id}”确认操作。`,
        });
      }
      const actualHash = await this.sha256(this.filePath(record)).catch(
        () => "",
      );
      if (record.status !== "VERIFIED" || actualHash !== record.sha256) {
        throw new BadRequestException({
          code: "BACKUP_INTEGRITY_FAILED",
          detail: "备份文件完整性校验失败，已禁止恢复。",
        });
      }
      await this.tool.inspect(this.filePath(record));
      safetyBackup = await this.create(actor, ipAddress, "PRE_RESTORE", true);

      await this.prisma.$disconnect();
      try {
        await this.tool.restore(this.filePath(record));
      } finally {
        await this.prisma.$connect();
      }
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.authSession.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const restoredActor = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true },
      });
      await this.audit(
        restoredActor ? actor : null,
        "administration.backup.restore",
        record.id,
        "SUCCESS",
        ipAddress,
        {
          safetyBackupId: safetyBackup.id,
          restoredSha256: record.sha256,
          initiatedBy: actor.displayName,
          allSessionsRevoked: 1,
        },
      );
      return {
        restoredBackup: record,
        safetyBackup,
        restoredAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.audit(
        actor,
        "administration.backup.restore",
        id,
        "FAILURE",
        ipAddress,
        { safetyBackupId: safetyBackup?.id ?? null },
      ).catch(() => undefined);
      throw error;
    } finally {
      this.operation = null;
    }
  }

  private begin(operation: "BACKUP" | "RESTORE") {
    if (this.operation) {
      throw new ConflictException({
        code: "BACKUP_OPERATION_IN_PROGRESS",
        detail: "已有备份或恢复任务正在进行，请稍后再试。",
      });
    }
    this.operation = operation;
  }

  private async readRecord(id: string): Promise<BackupRecord> {
    return this.readRecordFrom(this.directory, id);
  }

  private async readRecordFrom(
    directory: string,
    id: string,
  ): Promise<BackupRecord> {
    if (!/^\d{8}T\d{6}-[a-f0-9]{8}$/.test(id)) {
      throw new NotFoundException({
        code: "BACKUP_NOT_FOUND",
        detail: "备份不存在。",
      });
    }
    const value = await readFile(
      path.join(directory, `${id}.json`),
      "utf8",
    ).catch(() => {
      throw new NotFoundException({
        code: "BACKUP_NOT_FOUND",
        detail: "备份不存在。",
      });
    });
    const record = JSON.parse(value) as BackupRecord;
    if (
      record.id !== id ||
      path.basename(record.fileName) !== record.fileName
    ) {
      throw new BadRequestException({
        code: "BACKUP_METADATA_INVALID",
        detail: "备份元数据无效。",
      });
    }
    return record;
  }

  private secondaryDirectory(value: string) {
    const trimmed = value.trim();
    if (!trimmed || !path.isAbsolute(trimmed)) {
      throw new BadRequestException({
        code: "BACKUP_SECONDARY_DIRECTORY_INVALID",
        detail: "请输入完整的第二存储目录，例如 E:\\玉春备份。",
      });
    }
    const target = path.resolve(trimmed);
    if (
      this.isSameOrChild(this.directory, target) ||
      this.isSameOrChild(target, this.directory)
    ) {
      throw new BadRequestException({
        code: "BACKUP_SECONDARY_DIRECTORY_OVERLAPS",
        detail: "第二存储目录不能与本机备份目录相同或互相包含。",
      });
    }
    return target;
  }

  private isSameOrChild(parent: string, candidate: string) {
    const relative = path.relative(parent, candidate);
    return (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
  }

  private filePath(record: BackupRecord) {
    return path.join(this.directory, record.fileName);
  }

  private async writeRecord(record: BackupRecord) {
    const target = path.join(this.directory, `${record.id}.json`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(record, null, 2), { flag: "w" });
    await rename(temporary, target);
  }

  private sha256(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      const input = createReadStream(filePath);
      input.on("error", reject);
      input.on("data", (chunk) => hash.update(chunk));
      input.on("end", () => resolve(hash.digest("hex")));
    });
  }

  private timestamp(value: Date) {
    return value
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "");
  }

  private audit(
    actor: AuthenticatedUser | null,
    action: string,
    entityId: string,
    result: "SUCCESS" | "FAILURE",
    ipAddress: string | undefined,
    metadata: Record<string, string | number | null>,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: actor?.id ?? null,
        action,
        entityType: "DatabaseBackup",
        entityId,
        result,
        ipAddress,
        metadata,
      },
    });
  }
}
