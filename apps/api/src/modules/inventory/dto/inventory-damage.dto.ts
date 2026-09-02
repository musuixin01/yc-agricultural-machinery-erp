import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { InventoryDamageReason } from "../../../generated/prisma/client.js";

export class InventoryDamageLineDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/, {
    message: "quantity 必须是大于零且最多 6 位小数的数字字符串",
  })
  quantity!: string;

  @IsEnum(InventoryDamageReason)
  reason!: InventoryDamageReason;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reasonDetail?: string;
}

export class CreateInventoryDamageDto {
  @IsUUID()
  warehouseId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InventoryDamageLineDto)
  lines!: InventoryDamageLineDto[];
}

export class UpdateInventoryDamageDto extends CreateInventoryDamageDto {
  @IsInt()
  @Type(() => Number)
  version!: number;
}
