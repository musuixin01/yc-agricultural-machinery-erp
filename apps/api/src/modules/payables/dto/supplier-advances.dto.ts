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

export class PostSupplierAdvanceDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  cashAccountId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SupplierAdvanceApplicationLineDto {
  @IsUUID()
  payableEntryId!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  amount!: string;
}

export class PostSupplierAdvanceApplicationDto {
  @IsDateString({ strict: true })
  businessDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierAdvanceApplicationLineDto)
  allocations!: SupplierAdvanceApplicationLineDto[];
}
