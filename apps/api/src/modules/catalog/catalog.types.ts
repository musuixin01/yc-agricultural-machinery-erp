export const PRODUCT_TYPES = [
  "MACHINE",
  "PART",
  "STANDARD_PART",
  "CONSUMABLE",
  "SERVICE",
] as const;
export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ProductView {
  id: string;
  code: string;
  name: string;
  mnemonicCode: string | null;
  type: ProductType;
  model: string | null;
  specification: string | null;
  category: { id: string; code: string; name: string };
  brand: { id: string; code: string; name: string } | null;
  baseUnit: { id: string; code: string; name: string; decimalScale: number };
  retailPrice: string;
  wholesalePrice: string;
  defaultPurchasePrice: string;
  minimumSalePrice: string;
  safetyStock: string;
  barcodes: { id: string; barcode: string; isPrimary: boolean }[];
  attributes: Record<string, unknown>;
  status: ProductStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: ProductView[];
  page: number;
  pageSize: number;
  total: number;
}
