import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CreateWarehouseLocationDto {
  @ApiProperty({ example: "A-01" })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  code!: string;

  @ApiProperty({ example: "配件区" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: "MAIN" })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  code!: string;

  @ApiProperty({ example: "主仓库" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: [CreateWarehouseLocationDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((location: CreateWarehouseLocationDto) => location.code)
  @ValidateNested({ each: true })
  @Type(() => CreateWarehouseLocationDto)
  locations?: CreateWarehouseLocationDto[];
}
