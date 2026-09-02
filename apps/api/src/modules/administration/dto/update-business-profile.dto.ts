import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBusinessProfileDto {
  @IsString()
  @Length(2, 80)
  storeName!: string;

  @IsString()
  @Length(1, 20)
  shortName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  receiptFooter?: string;

  @IsIn(["A4", "RECEIPT_80MM"])
  defaultPaperSize!: "A4" | "RECEIPT_80MM";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
