import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class QueryAuditDto {
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsIn(["SUCCESS", "FAILURE"]) result?: "SUCCESS" | "FAILURE";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
}
