import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class PurchaseReceiptLineDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/)
  quantity!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  unitPrice!: string;
}

export class CreatePurchaseReceiptDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString({ strict: true })
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptLineDto)
  lines!: PurchaseReceiptLineDto[];
}

export class UpdatePurchaseReceiptDto extends CreatePurchaseReceiptDto {
  @IsInt()
  @Type(() => Number)
  version!: number;
}
