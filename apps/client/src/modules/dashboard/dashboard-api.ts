import { authenticatedFetch } from "../auth/auth-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type DashboardPeriod = "TODAY" | "LAST_7_DAYS" | "THIS_MONTH";

export type DashboardOverview = {
  period: DashboardPeriod;
  periodStart: string;
  periodEndExclusive: string;
  timezone: string;
  generatedAt: string;
  sales: {
    gross: string;
    returns: string;
    reversals: string;
    net: string;
    grossProfit: string;
    postedCount: number;
    returnCount: number;
    reversalCount: number;
  };
  receivables: {
    outstanding: string;
    count: number;
    overdueAmount: string;
    overdueCount: number;
  };
  payables: {
    outstanding: string;
    count: number;
    overdueAmount: string;
    overdueCount: number;
  };
  inventory: {
    lowStockProductCount: number;
    negativeStockProductCount: number;
    items: Array<{
      id: string;
      code: string;
      name: string;
      unitName: string;
      quantity: string;
      safetyStock: string;
    }>;
  };
  cash: { balance: string; accountCount: number };
  overdueCustomers: Array<{
    id: string;
    customerId: string;
    customerName: string;
    phone: string | null;
    documentNumber: string;
    outstandingAmount: string;
    dueDate: string;
    overdueDays: number;
  }>;
  recentSales: Array<{
    id: string;
    documentNumber: string;
    status: "POSTED" | "REVERSED";
    settlementType: "IMMEDIATE" | "CREDIT";
    customerNameSnapshot: string | null;
    totalAmount: string;
    soldAt: string;
  }>;
  trend: Array<{
    date: string;
    salesGross: string;
    salesReturns: string;
    salesReversals: string;
    salesNet: string;
  }>;
};

async function request<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : (body?.detail ?? body?.message);
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const dashboardApi = {
  overview: (period: DashboardPeriod) =>
    request<DashboardOverview>(`/reporting/dashboard?period=${period}`),
};
