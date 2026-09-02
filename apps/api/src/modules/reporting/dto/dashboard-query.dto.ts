import { IsIn, IsOptional } from "class-validator";

export const dashboardPeriods = ["TODAY", "LAST_7_DAYS", "THIS_MONTH"] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(dashboardPeriods)
  period: DashboardPeriod = "TODAY";
}
