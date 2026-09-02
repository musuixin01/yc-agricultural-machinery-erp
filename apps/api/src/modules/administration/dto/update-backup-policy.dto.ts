import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBackupPolicyDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "backupTime must use HH:mm format",
  })
  backupTime!: string;

  @IsInt()
  @Min(3)
  @Max(30)
  retentionCount!: number;

  @IsOptional()
  @IsBoolean()
  secondaryCopyEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  secondaryDirectory?: string;

  @IsInt()
  @Min(1)
  version!: number;
}
