import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  PARTY_ROLES,
  PARTY_STATUSES,
  type PartyRoleType,
  type PartyStatus,
} from "../parties.types.js";
export class QueryPartiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => String(value).trim())
  @IsString()
  search?: string;
  @ApiPropertyOptional({ enum: PARTY_ROLES })
  @IsOptional()
  @IsIn(PARTY_ROLES)
  role?: PartyRoleType;
  @ApiPropertyOptional({ enum: PARTY_STATUSES })
  @IsOptional()
  @IsIn(PARTY_STATUSES)
  status?: PartyStatus;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
