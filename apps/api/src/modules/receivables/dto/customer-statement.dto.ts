import { IsDateString } from "class-validator";

export class CustomerStatementQueryDto {
  @IsDateString({ strict: true })
  dateFrom!: string;

  @IsDateString({ strict: true })
  dateTo!: string;
}
