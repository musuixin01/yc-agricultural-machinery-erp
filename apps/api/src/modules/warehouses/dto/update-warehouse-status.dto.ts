import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, Min } from "class-validator";
import {
  WAREHOUSE_STATUSES,
  type WarehouseStatus,
} from "../warehouses.types.js";

export class UpdateWarehouseStatusDto {
  @ApiProperty({ enum: WAREHOUSE_STATUSES })
  @IsIn(WAREHOUSE_STATUSES)
  status!: WarehouseStatus;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}
