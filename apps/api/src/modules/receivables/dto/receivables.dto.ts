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
  MinLength,
  ValidateNested,
} from "class-validator";

export class ReceiptAllocationDto {
  @IsUUID()
  receivableEntryId!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/)
  amount!: string;
}

export class PostCustomerReceiptDto {
  @IsUUID()
  customerId!: string;

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
  @Type(() => ReceiptAllocationDto)
  allocations!: ReceiptAllocationDto[];
}

export class PostCustomerReceiptReversalDto {
  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  reversedAt!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
