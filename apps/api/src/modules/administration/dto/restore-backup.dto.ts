import { IsString, MaxLength } from "class-validator";

export class RestoreBackupDto {
  @IsString()
  @MaxLength(180)
  confirmation!: string;
}
