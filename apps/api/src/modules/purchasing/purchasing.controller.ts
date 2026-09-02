import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
import {
  CreatePurchaseReceiptDto,
  UpdatePurchaseReceiptDto,
} from "./dto/purchase-receipt.dto.js";
import { PostPurchaseReturnDto } from "./dto/purchase-return.dto.js";
import { PurchaseReturnsService } from "./purchase-returns.service.js";
import { PurchasingService } from "./purchasing.service.js";

@ApiTags("purchasing")
@Controller("purchasing")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("purchasing.read")
export class PurchasingController {
  constructor(
    private readonly service: PurchasingService,
    private readonly returns: PurchaseReturnsService,
  ) {}

  @Get("receipts")
  list() {
    return this.service.list();
  }

  @Get("receipts/:id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get("payables")
  payables() {
    return this.service.listPayables();
  }

  @Get("returns")
  listReturns() {
    return this.returns.list();
  }

  @Post("receipts")
  @RequirePermissions("purchasing.post")
  create(
    @Body() input: CreatePurchaseReceiptDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.create(input, req.user);
  }

  @Patch("receipts/:id")
  @RequirePermissions("purchasing.post")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePurchaseReceiptDto,
  ) {
    return this.service.update(id, input);
  }

  @Post("receipts/:id/submit")
  @RequirePermissions("purchasing.post")
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.submit(id, version, req.user);
  }

  @Post("receipts/:id/post")
  @RequirePermissions("purchasing.post")
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.post(id, idempotencyKey, req.user, ipAddress);
  }

  @Post("returns")
  @RequirePermissions("purchasing.post")
  postReturn(
    @Body() input: PostPurchaseReturnDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.returns.post(input, idempotencyKey, req.user, ipAddress);
  }
}
