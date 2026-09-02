import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class PostCashTransferDto {
  @IsUUID()
  fromCashAccountId!: string;

  @IsUUID()
  toCashAccountId!: string;

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
