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

export class CreateInventoryStocktakeDto {
  @IsUUID()
  warehouseId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class InventoryStocktakeCountLineDto {
  @IsUUID()
  lineId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/, {
    message: "countedQuantity 必须是非负且最多 6 位小数的数字字符串",
  })
  countedQuantity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class SaveInventoryStocktakeCountsDto {
  @IsInt()
  @Type(() => Number)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => InventoryStocktakeCountLineDto)
  lines!: InventoryStocktakeCountLineDto[];
}
