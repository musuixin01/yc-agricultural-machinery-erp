import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { PRODUCT_TYPES, type ProductType } from "../catalog.types.js";

export class ProductBarcodeDto {
  @ApiProperty({ example: "6901234567890" })
  @IsString()
  @Length(3, 64)
  @Matches(/^[0-9A-Za-z._-]+$/)
  barcode!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: "LS-M12-045" })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @Length(2, 48)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  code!: string;

  @ApiProperty({ example: "高强度螺栓 M12×45" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mnemonicCode?: string;

  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  type!: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  specification?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty()
  @IsUUID()
  baseUnitId!: string;

  @ApiPropertyOptional({ example: "1.80" })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  retailPrice?: string;

  @ApiPropertyOptional({ example: "1.60" })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  wholesalePrice?: string;

  @ApiPropertyOptional({ example: "1.10" })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  defaultPurchasePrice?: string;

  @ApiPropertyOptional({ example: "1.50" })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  minimumSalePrice?: string;

  @ApiPropertyOptional({ example: "500" })
  @IsOptional()
  @Matches(/^\d{1,12}(\.\d{1,6})?$/)
  safetyStock?: string;

  @ApiPropertyOptional({ type: [ProductBarcodeDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((x: ProductBarcodeDto) => x.barcode)
  @ValidateNested({ each: true })
  @Type(() => ProductBarcodeDto)
  barcodes?: ProductBarcodeDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
