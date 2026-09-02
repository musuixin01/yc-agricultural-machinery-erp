import { IsDateString } from "class-validator";

export class SupplierStatementQueryDto {
  @IsDateString({ strict: true })
  dateFrom!: string;

  @IsDateString({ strict: true })
  dateTo!: string;
}
