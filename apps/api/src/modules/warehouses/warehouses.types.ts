export const WAREHOUSE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number];

export interface WarehouseView {
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
  createdAt: string;
  updatedAt: string;
}

export interface WarehousePage {
  items: WarehouseView[];
  page: number;
  pageSize: number;
  total: number;
}
