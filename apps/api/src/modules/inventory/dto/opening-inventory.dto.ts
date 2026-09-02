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
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class OpeningInventoryLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/, {
    message: "quantity 必须是大于零且最多 6 位小数的数字字符串",
  })
  quantity!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/, {
    message: "unitCost 必须是非负且最多 4 位小数的数字字符串",
  })
  unitCost!: string;
}

export class CreateOpeningInventoryDto {
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
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OpeningInventoryLineDto)
  lines!: OpeningInventoryLineDto[];
}

export class UpdateOpeningInventoryDto extends CreateOpeningInventoryDto {
  @IsInt()
  @Type(() => Number)
  version!: number;
}

export class QueryInventoryDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
