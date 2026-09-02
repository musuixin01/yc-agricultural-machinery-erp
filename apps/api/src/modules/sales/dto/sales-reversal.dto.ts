import { IsDateString, IsString, MaxLength, MinLength } from "class-validator";

export class PostSalesReversalDto {
  @IsDateString({ strict: true })
  businessDate!: string;

  @IsDateString()
  reversedAt!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
