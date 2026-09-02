import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";
import { CreateProductDto } from "./create-product.dto.js";

export class UpdateProductDto extends CreateProductDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}
