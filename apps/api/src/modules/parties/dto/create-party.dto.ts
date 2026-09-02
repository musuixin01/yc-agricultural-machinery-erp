import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { PARTY_ROLES, type PartyRoleType } from "../parties.types.js";

export class PartyContactDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+() -]{5,32}$/)
  phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  position?: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreatePartyDto {
  @ApiProperty({ example: "KH-WJG-001" })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @Length(2, 48)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  code!: string;
  @ApiProperty({ example: "王建国农机合作社" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mnemonicCode?: string;
  @ApiProperty({ enum: PARTY_ROLES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PARTY_ROLES, { each: true })
  roles!: PartyRoleType[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Z-]{8,32}$/)
  taxId?: string;
  @ApiPropertyOptional({ description: "居民身份证号码，服务端加密保存" })
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^\d{17}[\dX]$/)
  identityNumber?: string;
  @ApiPropertyOptional({ description: "压缩后的人像图片 Data URL" })
  @IsOptional()
  @IsString()
  @MaxLength(2_100_000)
  portraitDataUrl?: string;
  @ApiPropertyOptional({ example: "50000.00" })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  creditLimit?: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  paymentTermsDays?: number;
  @ApiPropertyOptional({ description: "默认账期（月）", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  paymentTermsMonths?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) city?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
  @ApiPropertyOptional({ type: [PartyContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyContactDto)
  contacts?: PartyContactDto[];
}
