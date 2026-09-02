import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class BootstrapOwnerDto {
  @ApiProperty({ example: "owner" })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  username!: string;

  @ApiProperty({ example: "白老板" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @Length(10, 128)
  password!: string;

  @ApiProperty({ example: "Windows 门店电脑" })
  @IsString()
  @MaxLength(120)
  deviceName!: string;
}
