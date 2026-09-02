import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { AuthenticationGuard } from "./authentication.guard.js";
import { BootstrapOwnerDto } from "./dto/bootstrap-owner.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshDto } from "./dto/refresh.dto.js";
import { IdentityService } from "./identity.service.js";

@ApiTags("identity")
@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("bootstrap-status")
  bootstrapStatus() {
    return this.identity.bootstrapStatus();
  }

  @Post("bootstrap-owner")
  bootstrapOwner(
    @Body() input: BootstrapOwnerDto,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.identity.bootstrapOwner(input, { ipAddress, userAgent });
  }

  @Post("login")
  login(
    @Body() input: LoginDto,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.identity.login(input, { ipAddress, userAgent });
  }

  @Post("refresh")
  refresh(@Body() input: RefreshDto) {
    return this.identity.refresh(input.refreshToken);
  }

  @Get("me")
  @UseGuards(AuthenticationGuard)
  me(@Req() request: { user: AuthenticatedUser }) {
    return request.user;
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(AuthenticationGuard)
  logout(@Req() request: { user: AuthenticatedUser }) {
    return this.identity.logout(request.user.sessionId, request.user.id);
  }
}
