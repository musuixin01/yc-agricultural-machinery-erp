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
  ValidateNested,
} from "class-validator";

export class PurchaseReturnLineDto {
  @IsUUID()
  sourcePurchaseLineId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/)
  quantity!: string;
}

export class PostPurchaseReturnDto {
  @IsUUID()
  sourcePurchaseDocumentId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  returnedAt!: string;

  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  lines!: PurchaseReturnLineDto[];
}
