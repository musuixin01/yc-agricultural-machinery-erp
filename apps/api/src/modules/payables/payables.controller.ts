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
  CreateCashAccountDto,
  CreateSupplierPaymentDto,
  PostSupplierPaymentReversalDto,
  UpdateSupplierPaymentDto,
} from "./dto/payables.dto.js";
import { PayablesService } from "./payables.service.js";
import { PaymentReversalsService } from "./payment-reversals.service.js";
import {
  PostSupplierAdvanceApplicationDto,
  PostSupplierAdvanceDto,
} from "./dto/supplier-advances.dto.js";
import { SupplierAdvancesService } from "./supplier-advances.service.js";
import { SupplierStatementQueryDto } from "./dto/supplier-statement.dto.js";
import { SupplierStatementsService } from "./supplier-statements.service.js";

@ApiTags("payables")
@Controller("payables")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("payables.read")
export class PayablesController {
  constructor(
    private readonly service: PayablesService,
    private readonly reversals: PaymentReversalsService,
    private readonly advances: SupplierAdvancesService,
    private readonly statements: SupplierStatementsService,
  ) {}

  @Get("cash-accounts")
  accounts() {
    return this.service.listAccounts();
  }

  @Post("cash-accounts")
  @RequirePermissions("payables.post")
  createAccount(
    @Body() input: CreateCashAccountDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.createAccount(input, req.user);
  }

  @Get("entries")
  entries(@Query("supplierId") supplierId?: string) {
    return this.service.listPayables(supplierId);
  }

  @Get("statements/:supplierId")
  supplierStatement(
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Query() query: SupplierStatementQueryDto,
  ) {
    return this.statements.get(supplierId, query.dateFrom, query.dateTo);
  }

  @Get("payments")
  payments() {
    return this.service.listPayments();
  }

  @Get("advances")
  supplierAdvances() {
    return this.advances.list();
  }

  @Post("advances")
  @RequirePermissions("payables.post")
  postSupplierAdvance(
    @Body() input: PostSupplierAdvanceDto,
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
  @RequirePermissions("payables.post")
  applySupplierAdvance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PostSupplierAdvanceApplicationDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.advances.apply(id, input, idempotencyKey, req.user, ipAddress);
  }

  @Get("payments/:id")
  payment(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getPayment(id);
  }

  @Post("payments")
  @RequirePermissions("payables.post")
  createPayment(
    @Body() input: CreateSupplierPaymentDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.createPayment(input, req.user);
  }

  @Patch("payments/:id")
  @RequirePermissions("payables.post")
  updatePayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateSupplierPaymentDto,
  ) {
    return this.service.updatePayment(id, input);
  }

  @Post("payments/:id/submit")
  @RequirePermissions("payables.post")
  submitPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.submitPayment(id, version, req.user);
  }

  @Post("payments/:id/post")
  @RequirePermissions("payables.post")
  postPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.postPayment(id, idempotencyKey, req.user, ipAddress);
  }

  @Post("payments/:id/reverse")
  @RequirePermissions("payables.post")
  reversePayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PostSupplierPaymentReversalDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.reversals.post(id, input, idempotencyKey, req.user, ipAddress);
  }
}
