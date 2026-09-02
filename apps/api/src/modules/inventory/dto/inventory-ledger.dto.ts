import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const inventoryLedgerSourceTypes = [
  "INITIAL_STOCK",
  "OPENING",
  "PURCHASE_RECEIPT",
  "PURCHASE_RETURN",
  "SALES_DISPATCH",
  "CASH_SALE",
  "SALES_RETURN",
  "SALES_REVERSAL",
  "STOCKTAKE_GAIN",
  "STOCKTAKE_LOSS",
  "INVENTORY_DAMAGE",
] as const;

export class QueryInventoryLedgerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsIn(inventoryLedgerSourceTypes)
  sourceDocumentType?: (typeof inventoryLedgerSourceTypes)[number];

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
