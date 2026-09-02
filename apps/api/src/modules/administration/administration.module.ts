import { Module } from "@nestjs/common";
import { AdministrationController } from "./administration.controller.js";
import { AdministrationService } from "./administration.service.js";
import { BackupService } from "./backup.service.js";
import { DockerPostgresBackupTool } from "./backup-tool.js";
import { BackupSchedulerService } from "./backup-scheduler.service.js";

@Module({
  controllers: [AdministrationController],
  providers: [
    AdministrationService,
    BackupService,
    BackupSchedulerService,
    DockerPostgresBackupTool,
  ],
})
export class AdministrationModule {}
