import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardPeriod } from "./dashboard-api";

export function useDashboard(period: DashboardPeriod) {
  return useQuery({
    queryKey: ["reporting", "dashboard", period],
    queryFn: () => dashboardApi.overview(period),
    staleTime: 30_000,
  });
}
