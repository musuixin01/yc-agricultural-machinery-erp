import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "xiaowang" })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  username!: string;

  @ApiProperty({ example: "王师傅" })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @Length(10, 128)
  password!: string;

  @ApiProperty({ example: ["SALES"] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes!: string[];
}
