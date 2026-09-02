import { IsDateString, IsString, IsUUID, Matches } from "class-validator";

export class CreateInitialStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsDateString({ strict: true })
  businessDate!: string;

  @IsString()
  @Matches(/^\d{1,13}(?:\.\d{1,6})?$/, {
    message: "quantity 必须是大于零且最多 6 位小数的数字字符串",
  })
  quantity!: string;

  @IsString()
  @Matches(/^\d{1,15}(?:\.\d{1,4})?$/, {
    message: "unitCost 必须是非负且最多 4 位小数的数字字符串",
  })
  unitCost!: string;
}
