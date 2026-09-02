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
import { CatalogService } from "./catalog.service.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { QueryProductsDto } from "./dto/query-products.dto.js";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";

@ApiTags("catalog")
@Controller("catalog")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("catalog.read")
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly service: CatalogService,
  ) {}

  @Get("references")
  @ApiOkResponse({ description: "商品分类、品牌和单位" })
  references() {
    return this.service.references();
  }

  @Get("products")
  @ApiOkResponse({ description: "分页商品列表" })
  list(@Query() query: QueryProductsDto) {
    return this.service.list(query);
  }

  @Get("products/:id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post("products")
  @RequirePermissions("catalog.write")
  @ApiCreatedResponse({ description: "创建商品" })
  create(@Body() input: CreateProductDto) {
    return this.service.create(input);
  }

  @Patch("products/:id/status")
  @RequirePermissions("catalog.write")
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateProductStatusDto,
  ) {
    return this.service.updateStatus(id, input);
  }
}
