import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
import { CashTransfersService } from "./cash-transfers.service.js";
import { PostCashTransferDto } from "./dto/cash-transfers.dto.js";

@ApiTags("cash")
@Controller("cash")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("cash.read")
export class CashController {
  constructor(private readonly transfers: CashTransfersService) {}

  @Get("transfers")
  listTransfers() {
    return this.transfers.list();
  }

  @Post("transfers")
  @RequirePermissions("cash.post")
  postTransfer(
    @Body() input: PostCashTransferDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.transfers.post(input, idempotencyKey, req.user, ipAddress);
  }
}
