import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
import { DashboardQueryDto } from "./dto/dashboard-query.dto.js";
import { ReportingService } from "./reporting.service.js";

@ApiTags("reporting")
@Controller("reporting")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("reporting.read")
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get("dashboard")
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reporting.dashboard(query.period);
  }
}
