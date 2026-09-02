import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { AuthenticationGuard } from "./authentication.guard.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { QueryAuditDto } from "./dto/query-audit.dto.js";
import { QueryUsersDto } from "./dto/query-users.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";
import { IdentityService } from "./identity.service.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { RequirePermissions } from "./require-permissions.decorator.js";

@ApiTags("identity administration")
@Controller("identity")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("identity.manage")
export class IdentityAdminController {
  constructor(private readonly identity: IdentityService) {}

  @Get("roles")
  roles() {
    return this.identity.listRoles();
  }

  @Get("users")
  users(@Query() query: QueryUsersDto) {
    return this.identity.listUsers(query);
  }

  @Post("users")
  createUser(@Body() input: CreateUserDto) {
    return this.identity.createUser(input);
  }

  @Patch("users/:id/status")
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateUserStatusDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.identity.updateUserStatus(id, input, request.user);
  }

  @Post("users/:id/reset-password")
  @HttpCode(200)
  resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ResetPasswordDto,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.identity.resetPassword(id, input.password, request.user);
  }

  @Post("users/:id/revoke-sessions")
  @HttpCode(200)
  revokeSessions(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.identity.revokeUserSessions(id, request.user);
  }

  @Get("audit-events")
  @RequirePermissions("audit.read")
  audit(@Query() query: QueryAuditDto) {
    return this.identity.listAudit(query);
  }
}
