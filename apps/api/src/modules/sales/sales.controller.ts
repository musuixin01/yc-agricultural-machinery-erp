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
  CreateSalesDocumentDto,
  UpdateSalesDocumentDto,
} from "./dto/sales-document.dto.js";
import { PostSalesReturnDto } from "./dto/sales-return.dto.js";
import { PostSalesReversalDto } from "./dto/sales-reversal.dto.js";
import { SalesReturnsService } from "./sales-returns.service.js";
import { SalesReversalsService } from "./sales-reversals.service.js";
import { SalesService } from "./sales.service.js";

@ApiTags("sales")
@Controller("sales")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("sales.read")
export class SalesController {
  constructor(
    private readonly service: SalesService,
    private readonly returns: SalesReturnsService,
    private readonly reversals: SalesReversalsService,
  ) {}

  @Get("documents")
  list() {
    return this.service.list();
  }

  @Get("documents/:id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get("receivables")
  @RequirePermissions("receivables.read")
  receivables(@Query("customerId") customerId?: string) {
    return this.service.listReceivables(customerId);
  }

  @Get("returns")
  listReturns() {
    return this.returns.list();
  }

  @Post("returns")
  @RequirePermissions("sales.post")
  postReturn(
    @Body() input: PostSalesReturnDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.returns.post(input, idempotencyKey, req.user, ipAddress);
  }

  @Post("documents")
  @RequirePermissions("sales.post")
  create(
    @Body() input: CreateSalesDocumentDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.create(input, req.user);
  }

  @Patch("documents/:id")
  @RequirePermissions("sales.post")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateSalesDocumentDto,
  ) {
    return this.service.update(id, input);
  }

  @Post("documents/:id/submit")
  @RequirePermissions("sales.post")
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.submit(id, version, req.user);
  }

  @Post("documents/:id/post")
  @RequirePermissions("sales.post")
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.post(id, idempotencyKey, req.user, ipAddress);
  }

  @Post("documents/:id/reverse")
  @RequirePermissions("sales.post")
  reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PostSalesReversalDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.reversals.post(id, input, idempotencyKey, req.user, ipAddress);
  }
}
