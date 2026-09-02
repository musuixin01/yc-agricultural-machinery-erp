import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length, Matches, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  username!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;

  @ApiProperty({ example: "Windows 门店电脑" })
  @IsString()
  @MaxLength(120)
  deviceName!: string;
}
