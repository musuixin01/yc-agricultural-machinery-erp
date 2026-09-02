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
import { CreatePartyDto } from "./dto/create-party.dto.js";
import { QueryPartiesDto } from "./dto/query-parties.dto.js";
import { UpdatePartyStatusDto } from "./dto/update-party-status.dto.js";
import { PartiesService } from "./parties.service.js";
import { AuthenticationGuard } from "../identity/authentication.guard.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { RequirePermissions } from "../identity/require-permissions.decorator.js";
@ApiTags("parties")
@Controller("parties")
@UseGuards(AuthenticationGuard, PermissionsGuard)
@RequirePermissions("parties.read")
export class PartiesController {
  constructor(
    @Inject(PartiesService) private readonly service: PartiesService,
  ) {}
  @Get() @ApiOkResponse({ description: "客户与供应商分页列表" }) list(
    @Query() query: QueryPartiesDto,
  ) {
    return this.service.list(query);
  }
  @Get(":id") get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @Post()
  @RequirePermissions("parties.write")
  @ApiCreatedResponse({ description: "创建客户或供应商" })
  create(@Body() input: CreatePartyDto) {
    return this.service.create(input);
  }
  @Patch(":id/status") @RequirePermissions("parties.write") updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePartyStatusDto,
  ) {
    return this.service.updateStatus(id, input);
  }
}
