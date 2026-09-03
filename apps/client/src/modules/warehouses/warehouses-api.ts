const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
import { authenticatedFetch } from "../auth/auth-api";

export type WarehouseStatus = "ACTIVE" | "INACTIVE";
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  notes: string | null;
  isDefault: boolean;
  status: WarehouseStatus;
  version: number;
  locations: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: WarehouseStatus;
  }[];
};
export type WarehousePage = {
  items: Warehouse[];
  page: number;
  pageSize: number;
  total: number;
};
export type CreateWarehouseInput = {
  code: string;
  name: string;
  address?: string;
  notes?: string;
  isDefault?: boolean;
  locations?: { code: string; name: string; description?: string }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      detail?: string;
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : (body?.detail ?? body?.message);
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const warehousesApi = {
  list: (search: string, status: string) =>
    request<WarehousePage>(
      `/warehouses?page=1&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`,
    ),
  create: (input: CreateWarehouseInput) =>
    request<Warehouse>("/warehouses", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setStatus: (warehouse: Warehouse, status: WarehouseStatus) =>
    request<Warehouse>(`/warehouses/${warehouse.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version: warehouse.version }),
    }),
  setDefault: (warehouse: Warehouse) =>
    request<Warehouse>(`/warehouses/${warehouse.id}/default`, {
      method: "PATCH",
      body: JSON.stringify({ version: warehouse.version }),
    }),
};
