import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  Req,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../identity/authenticated-user.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
import {
  PostCustomerAdvanceApplicationDto,
  PostCustomerAdvanceDto,
} from "./dto/customer-advances.dto.js";
import {
  PostCustomerReceiptDto,
  PostCustomerReceiptReversalDto,
} from "./dto/receivables.dto.js";
import { ReceiptReversalsService } from "./receipt-reversals.service.js";
import { ReceivablesService } from "./receivables.service.js";
import { CustomerAdvancesService } from "./customer-advances.service.js";
import { CustomerStatementsService } from "./customer-statements.service.js";
import { CustomerStatementQueryDto } from "./dto/customer-statement.dto.js";

@ApiTags("receivables")
@Controller("receivables")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("receivables.read")
export class ReceivablesController {
  constructor(
    private readonly service: ReceivablesService,
    private readonly reversals: ReceiptReversalsService,
    private readonly advances: CustomerAdvancesService,
    private readonly statements: CustomerStatementsService,
  ) {}

  @Get("statements/:customerId")
  statement(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Query() query: CustomerStatementQueryDto,
  ) {
    return this.statements.get(customerId, query.dateFrom, query.dateTo);
  }

  @Get("entries")
  entries(@Query("customerId") customerId?: string) {
    return this.service.listEntries(customerId);
  }

  @Get("receipts")
  receipts() {
    return this.service.listReceipts();
  }

  @Get("advances")
  advancesList() {
    return this.advances.list();
  }

  @Post("advances")
  @RequirePermissions("receivables.post")
  postAdvance(
    @Body() input: PostCustomerAdvanceDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.advances.postAdvance(
      input,
      idempotencyKey,
      req.user,
      ipAddress,
    );
  }

  @Post("advances/:id/apply")
  @RequirePermissions("receivables.post")
  applyAdvance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PostCustomerAdvanceApplicationDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.advances.apply(id, input, idempotencyKey, req.user, ipAddress);
  }

  @Post("receipts")
  @RequirePermissions("receivables.post")
  postReceipt(
    @Body() input: PostCustomerReceiptDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.postReceipt(input, idempotencyKey, req.user, ipAddress);
  }

  @Post("receipts/:id/reverse")
  @RequirePermissions("receivables.post")
  reverseReceipt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PostCustomerReceiptReversalDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.reversals.post(id, input, idempotencyKey, req.user, ipAddress);
  }
}
