import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import type { ServerResponse } from "node:http";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
import { AdministrationService } from "./administration.service.js";
import { UpdateBusinessProfileDto } from "./dto/update-business-profile.dto.js";
import { RestoreBackupDto } from "./dto/restore-backup.dto.js";
import { BackupService } from "./backup.service.js";
import { BackupSchedulerService } from "./backup-scheduler.service.js";
import { UpdateBackupPolicyDto } from "./dto/update-backup-policy.dto.js";

@ApiTags("administration")
@Controller("administration")
@UseGuards(AuthenticationGuard, PermissionsGuard)
export class AdministrationController {
  constructor(
    private readonly administration: AdministrationService,
    private readonly backups: BackupService,
    private readonly backupScheduler: BackupSchedulerService,
  ) {}

  @Get("business-profile")
  @RequirePermissions("sales.read")
  profile() {
    return this.administration.getBusinessProfile();
  }

  @Patch("business-profile")
  @RequirePermissions("administration.manage")
  updateProfile(
    @Body() input: UpdateBusinessProfileDto,
    @Req() request: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.administration.updateBusinessProfile(
      input,
      request.user,
      ipAddress,
    );
  }

  @Get("backups")
  @RequirePermissions("administration.manage")
  listBackups() {
    return this.backups.list();
  }

  @Get("backups/policy")
  @RequirePermissions("administration.manage")
  backupPolicy() {
    return this.backupScheduler.getPolicy();
  }

  @Patch("backups/policy")
  @RequirePermissions("administration.manage")
  updateBackupPolicy(
    @Body() input: UpdateBackupPolicyDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.backupScheduler.updatePolicy(input, request.user);
  }

  @Post("backups")
  @RequirePermissions("administration.manage")
  createBackup(
    @Req() request: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.backups.create(request.user, ipAddress);
  }

  @Post("backups/:id/verify")
  @RequirePermissions("administration.manage")
  verifyBackup(
    @Param("id") id: string,
    @Req() request: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.backups.verify(id, request.user, ipAddress);
  }

  @Get("backups/:id/download")
  @RequirePermissions("administration.manage")
  async downloadBackup(
    @Param("id") id: string,
    @Req() request: { user: AuthenticatedUser },
    @Ip() ipAddress: string | undefined,
    @Res() response: ServerResponse,
  ) {
    const download = await this.backups.download(id, request.user, ipAddress);
    response.setHeader("Content-Type", "application/octet-stream");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${download.record.fileName}"`,
    );
    response.setHeader("Content-Length", String(download.record.sizeBytes));
    createReadStream(download.filePath).pipe(response);
  }

  @Post("backups/:id/restore")
  @RequirePermissions("administration.manage")
  restoreBackup(
    @Param("id") id: string,
    @Body() input: RestoreBackupDto,
    @Req() request: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.backups.restore(
      id,
      input.confirmation,
      request.user,
      ipAddress,
    );
  }
}
