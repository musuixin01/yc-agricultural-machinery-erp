import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import { BackupService } from "./backup.service.js";
import type { UpdateBackupPolicyDto } from "./dto/update-backup-policy.dto.js";

export type BackupPolicy = {
  enabled: boolean;
  backupTime: string;
  retentionCount: number;
  secondaryCopyEnabled: boolean;
  secondaryDirectory: string;
  version: number;
  nextRunAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  lastSecondaryCopyAt: string | null;
  lastSecondaryCopyFailureAt: string | null;
  lastSecondaryCopyFailureMessage: string | null;
  updatedAt: string;
  updatedBy: { id: string; displayName: string } | null;
};

@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly directory = path.resolve(
    process.env.YC_BACKUP_DIRECTORY ??
      path.join(process.cwd(), "../../data/backups"),
  );
  private readonly policyPath = path.join(this.directory, "policy.json");

  constructor(
    private readonly backups: BackupService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runDue(), 30_000);
    this.timer.unref();
    setTimeout(() => void this.runDue(), 2_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getPolicy() {
    return this.readPolicy();
  }

  async updatePolicy(input: UpdateBackupPolicyDto, actor: AuthenticatedUser) {
    const current = await this.readPolicy();
    if (current.version !== input.version)
      throw new ConflictException({
        code: "BACKUP_POLICY_VERSION_CONFLICT",
        detail: "自动备份设置已在其他设备修改，请刷新后重试。",
      });
    const secondaryCopyEnabled =
      input.secondaryCopyEnabled ?? current.secondaryCopyEnabled;
    const secondaryDirectory = (
      input.secondaryDirectory ?? current.secondaryDirectory
    ).trim();
    if (secondaryCopyEnabled)
      await this.backups.validateSecondaryDirectory(secondaryDirectory);
    const now = new Date();
    const updated: BackupPolicy = {
      ...current,
      enabled: input.enabled,
      backupTime: input.backupTime,
      retentionCount: input.retentionCount,
      secondaryCopyEnabled,
      secondaryDirectory,
      nextRunAt: input.enabled
        ? this.calculateNextRun(now, input.backupTime).toISOString()
        : null,
      version: current.version + 1,
      updatedAt: now.toISOString(),
      updatedBy: { id: actor.id, displayName: actor.displayName },
    };
    await this.writePolicy(updated);
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: actor.id,
        action: "administration.backup_policy.update",
        entityType: "BackupPolicy",
        entityId: "primary",
        result: "SUCCESS",
        metadata: {
          enabled: updated.enabled,
          backupTime: updated.backupTime,
          retentionCount: updated.retentionCount,
          secondaryCopyEnabled: updated.secondaryCopyEnabled ? 1 : 0,
        },
      },
    });
    return updated;
  }

  async runDue(now = new Date()) {
    if (this.running) return false;
    const policy = await this.readPolicy();
    if (
      !policy.enabled ||
      !policy.nextRunAt ||
      new Date(policy.nextRunAt) > now
    )
      return false;
    this.running = true;
    const claimed: BackupPolicy = {
      ...policy,
      nextRunAt: this.calculateNextRun(now, policy.backupTime).toISOString(),
      lastAttemptAt: now.toISOString(),
    };
    await this.writePolicy(claimed);
    try {
      const record = await this.backups.create(null, undefined, "AUTOMATIC");
      const completed: BackupPolicy = {
        ...(await this.readPolicy()),
        lastSuccessAt: new Date().toISOString(),
        lastFailureAt: null,
        lastFailureMessage: null,
      };
      await this.writePolicy(completed);
      await this.backups.enforceAutomaticRetention(completed.retentionCount);
      if (completed.secondaryCopyEnabled) {
        try {
          await this.backups.copyToSecondary(
            record,
            completed.secondaryDirectory,
          );
          await this.backups.enforceSecondaryAutomaticRetention(
            completed.secondaryDirectory,
            completed.retentionCount,
          );
          await this.writePolicy({
            ...(await this.readPolicy()),
            lastSecondaryCopyAt: new Date().toISOString(),
            lastSecondaryCopyFailureAt: null,
            lastSecondaryCopyFailureMessage: null,
          });
        } catch (error) {
          await this.writePolicy({
            ...(await this.readPolicy()),
            lastSecondaryCopyFailureAt: new Date().toISOString(),
            lastSecondaryCopyFailureMessage: this.safeMessage(error),
          });
        }
      }
      return true;
    } catch (error) {
      const failed: BackupPolicy = {
        ...(await this.readPolicy()),
        lastFailureAt: new Date().toISOString(),
        lastFailureMessage: this.safeMessage(error),
      };
      await this.writePolicy(failed);
      return false;
    } finally {
      this.running = false;
    }
  }

  calculateNextRun(now: Date, backupTime: string) {
    const [hour, minute] = backupTime.split(":").map(Number);
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  private async readPolicy(): Promise<BackupPolicy> {
    await mkdir(this.directory, { recursive: true });
    let value: string;
    try {
      value = await readFile(this.policyPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const now = new Date().toISOString();
      const policy: BackupPolicy = {
        enabled: false,
        backupTime: "21:00",
        retentionCount: 7,
        secondaryCopyEnabled: false,
        secondaryDirectory: "",
        version: 1,
        nextRunAt: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureMessage: null,
        lastSecondaryCopyAt: null,
        lastSecondaryCopyFailureAt: null,
        lastSecondaryCopyFailureMessage: null,
        updatedAt: now,
        updatedBy: null,
      };
      await this.writePolicy(policy);
      return policy;
    }
    const stored = JSON.parse(value) as Partial<BackupPolicy>;
    return {
      enabled: stored.enabled ?? false,
      backupTime: stored.backupTime ?? "21:00",
      retentionCount: stored.retentionCount ?? 7,
      secondaryCopyEnabled: stored.secondaryCopyEnabled ?? false,
      secondaryDirectory: stored.secondaryDirectory ?? "",
      version: stored.version ?? 1,
      nextRunAt: stored.nextRunAt ?? null,
      lastAttemptAt: stored.lastAttemptAt ?? null,
      lastSuccessAt: stored.lastSuccessAt ?? null,
      lastFailureAt: stored.lastFailureAt ?? null,
      lastFailureMessage: stored.lastFailureMessage ?? null,
      lastSecondaryCopyAt: stored.lastSecondaryCopyAt ?? null,
      lastSecondaryCopyFailureAt: stored.lastSecondaryCopyFailureAt ?? null,
      lastSecondaryCopyFailureMessage:
        stored.lastSecondaryCopyFailureMessage ?? null,
      updatedAt: stored.updatedAt ?? new Date().toISOString(),
      updatedBy: stored.updatedBy ?? null,
    };
  }

  private async writePolicy(policy: BackupPolicy) {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.policyPath}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(policy, null, 2));
    await rename(temporary, this.policyPath);
  }

  private safeMessage(error: unknown) {
    const value = error instanceof Error ? error.message : "自动备份失败";
    return value
      .replace(/postgresql:\/\/[^\s]+/gi, "[数据库连接已隐藏]")
      .slice(0, 240);
  }
}
