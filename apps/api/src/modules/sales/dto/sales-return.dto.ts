import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class SalesReturnLineDto {
  @IsUUID()
  sourceSalesLineId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/)
  quantity!: string;
}

export class PostSalesReturnDto {
  @IsUUID()
  sourceSalesDocumentId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  returnedAt!: string;

  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SalesReturnLineDto)
  lines!: SalesReturnLineDto[];
}
