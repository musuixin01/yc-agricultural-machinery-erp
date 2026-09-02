import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class SalesLineDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/)
  quantity!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  unitPrice!: string;
}

export class CreateSalesDocumentDto {
  @IsIn(["IMMEDIATE", "CREDIT"])
  settlementType!: "IMMEDIATE" | "CREDIT";

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  soldAt!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SalesLineDto)
  lines!: SalesLineDto[];
}

export class UpdateSalesDocumentDto extends CreateSalesDocumentDto {
  @IsInt()
  @Type(() => Number)
  version!: number;
}
