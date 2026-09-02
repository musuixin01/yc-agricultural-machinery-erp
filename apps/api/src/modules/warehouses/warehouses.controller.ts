import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto.js";
import { QueryWarehousesDto } from "./dto/query-warehouses.dto.js";
import { SetDefaultWarehouseDto } from "./dto/set-default-warehouse.dto.js";
import { UpdateWarehouseStatusDto } from "./dto/update-warehouse-status.dto.js";
import { WarehousesService } from "./warehouses.service.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";

@ApiTags("warehouses")
@Controller("warehouses")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("warehouses.read")
export class WarehousesController {
  constructor(
    @Inject(WarehousesService) private readonly service: WarehousesService,
  ) {}

  @Get()
  @ApiOkResponse({ description: "仓库分页列表" })
  list(@Query() query: QueryWarehousesDto) {
    return this.service.list(query);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions("warehouses.write")
  @ApiCreatedResponse({ description: "创建仓库及初始库位" })
  create(@Body() input: CreateWarehouseDto) {
    return this.service.create(input);
  }

  @Patch(":id/status")
  @RequirePermissions("warehouses.write")
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateWarehouseStatusDto,
  ) {
    return this.service.updateStatus(id, input);
  }

  @Patch(":id/default")
  @RequirePermissions("warehouses.write")
  setDefault(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: SetDefaultWarehouseDto,
  ) {
    return this.service.setDefault(id, input);
  }
}
