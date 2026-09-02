import { Type } from "class-transformer";
import { IsIn, IsInt, Min } from "class-validator";
export class UpdateUserStatusDto {
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
