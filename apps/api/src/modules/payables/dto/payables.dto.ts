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

export enum CashAccountTypeDto {
  CASH = "CASH",
  BANK = "BANK",
  WECHAT = "WECHAT",
  ALIPAY = "ALIPAY",
  OTHER = "OTHER",
}

export class CreateCashAccountDto {
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(CashAccountTypeDto)
  type!: CashAccountTypeDto;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  openingBalance!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PaymentAllocationDto {
  @IsUUID()
  payableEntryId!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  amount!: string;
}

export class CreateSupplierPaymentDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  cashAccountId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations!: PaymentAllocationDto[];
}

export class UpdateSupplierPaymentDto extends CreateSupplierPaymentDto {
  @IsInt()
  @Type(() => Number)
  version!: number;
}

export class PostSupplierPaymentReversalDto {
  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  reversedAt!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
