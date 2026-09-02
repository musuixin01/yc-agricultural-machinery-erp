const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
import { authenticatedFetch } from "../auth/auth-api";

export type ProductStatus = "ACTIVE" | "INACTIVE";
export type ProductType =
  "MACHINE" | "PART" | "STANDARD_PART" | "CONSUMABLE" | "SERVICE";
export type Reference = { id: string; code: string; name: string };
export type Product = {
  id: string;
  code: string;
  name: string;
  type: ProductType;
  model: string | null;
  specification: string | null;
  category: Reference;
  brand: Reference | null;
  baseUnit: Reference & { decimalScale: number };
  retailPrice: string;
  safetyStock: string;
  barcodes: { id: string; barcode: string; isPrimary: boolean }[];
  status: ProductStatus;
  version: number;
};
export type ProductPage = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
};
export type CatalogReferences = {
  categories: Reference[];
  brands: Reference[];
  units: (Reference & { decimalScale: number })[];
};
export type CreateProductInput = {
  code: string;
  name: string;
  type: ProductType;
  categoryId: string;
  baseUnitId: string;
  brandId?: string;
  model?: string;
  specification?: string;
  retailPrice?: string;
  safetyStock?: string;
  barcodes?: { barcode: string; isPrimary: boolean }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : body?.message;
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const catalogApi = {
  list: (search: string, categoryId = "", status = "") =>
    request<ProductPage>(
      `/catalog/products?page=1&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`,
    ),
  references: () => request<CatalogReferences>("/catalog/references"),
  create: (input: CreateProductInput) =>
    request<Product>("/catalog/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setStatus: (product: Product, status: ProductStatus) =>
    request<Product>(`/catalog/products/${product.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version: product.version }),
    }),
};
