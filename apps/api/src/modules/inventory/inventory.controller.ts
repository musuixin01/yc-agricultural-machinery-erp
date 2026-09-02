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
  CreateOpeningInventoryDto,
  QueryInventoryDto,
  UpdateOpeningInventoryDto,
} from "./dto/opening-inventory.dto.js";
import { CreateInitialStockDto } from "./dto/initial-stock.dto.js";
import {
  CreateInventoryDamageDto,
  UpdateInventoryDamageDto,
} from "./dto/inventory-damage.dto.js";
import { QueryInventoryLedgerDto } from "./dto/inventory-ledger.dto.js";
import {
  CreateInventoryStocktakeDto,
  SaveInventoryStocktakeCountsDto,
} from "./dto/stocktake.dto.js";
import { InventoryService } from "./inventory.service.js";
import { InventoryDamageService } from "./inventory-damage.service.js";
import { StocktakeService } from "./stocktake.service.js";

@ApiTags("inventory")
@Controller("inventory")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("inventory.read")
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly stocktakes: StocktakeService,
    private readonly damages: InventoryDamageService,
  ) {}

  @Get("ledger")
  listLedger(@Query() query: QueryInventoryLedgerDto) {
    return this.service.listLedger(query);
  }

  @Get("damages")
  listDamages() {
    return this.damages.list();
  }

  @Get("damages/:id")
  getDamage(@Param("id", ParseUUIDPipe) id: string) {
    return this.damages.get(id);
  }

  @Post("damages")
  @RequirePermissions("inventory.post")
  createDamage(
    @Body() input: CreateInventoryDamageDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.damages.create(input, req.user);
  }

  @Patch("damages/:id")
  @RequirePermissions("inventory.post")
  updateDamage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateInventoryDamageDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.damages.update(id, input, req.user);
  }

  @Post("damages/:id/submit")
  @RequirePermissions("inventory.post")
  submitDamage(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.damages.submit(id, version, req.user);
  }

  @Post("damages/:id/post")
  @RequirePermissions("inventory.post")
  postDamage(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.damages.post(id, idempotencyKey, req.user, ipAddress);
  }

  @Get("stocktakes")
  listStocktakes() {
    return this.stocktakes.list();
  }

  @Get("stocktakes/:id")
  getStocktake(@Param("id", ParseUUIDPipe) id: string) {
    return this.stocktakes.get(id);
  }

  @Post("stocktakes")
  @RequirePermissions("inventory.post")
  createStocktake(
    @Body() input: CreateInventoryStocktakeDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.stocktakes.create(input, req.user);
  }

  @Patch("stocktakes/:id/counts")
  @RequirePermissions("inventory.post")
  saveStocktakeCounts(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: SaveInventoryStocktakeCountsDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.stocktakes.saveCounts(id, input, req.user);
  }

  @Post("stocktakes/:id/submit")
  @RequirePermissions("inventory.post")
  submitStocktake(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.stocktakes.submit(id, version, req.user);
  }

  @Post("stocktakes/:id/post")
  @RequirePermissions("inventory.post")
  postStocktake(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.stocktakes.post(id, idempotencyKey, req.user, ipAddress);
  }

  @Get("opening-documents")
  listDocuments(@Query() query: QueryInventoryDto) {
    return this.service.listDocuments(query.warehouseId);
  }

  @Get("opening-documents/:id")
  getDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getDocument(id);
  }

  @Get("balances")
  listBalances(@Query() query: QueryInventoryDto) {
    return this.service.listBalances(query.warehouseId);
  }

  @Post("opening-documents")
  @RequirePermissions("inventory.post")
  create(
    @Body() input: CreateOpeningInventoryDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.createOpening(input, req.user);
  }

  @Post("initial-stock")
  @RequirePermissions("inventory.post")
  createInitialStock(
    @Body() input: CreateInitialStockDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.createInitialStock(
      input,
      idempotencyKey,
      req.user,
      ipAddress,
    );
  }

  @Patch("opening-documents/:id")
  @RequirePermissions("inventory.post")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateOpeningInventoryDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.updateOpening(id, input, req.user);
  }

  @Post("opening-documents/:id/submit")
  @RequirePermissions("inventory.post")
  submit(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("version", ParseIntPipe) version: number,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.service.submit(id, version, req.user);
  }

  @Post("opening-documents/:id/post")
  @RequirePermissions("inventory.post")
  post(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() req: { user: AuthenticatedUser },
    @Ip() ipAddress?: string,
  ) {
    return this.service.post(id, idempotencyKey, req.user, ipAddress);
  }
}
