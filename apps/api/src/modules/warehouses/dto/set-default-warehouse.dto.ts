import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class SetDefaultWarehouseDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}
