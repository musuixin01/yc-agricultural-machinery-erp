import type { CreateProductDto } from "./dto/create-product.dto.js";
import type { QueryProductsDto } from "./dto/query-products.dto.js";
import type { UpdateProductDto } from "./dto/update-product.dto.js";
import type {
  ProductPage,
  ProductStatus,
  ProductView,
} from "./catalog.types.js";

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");
export type ProductUpdateResult =
  ProductView | "NOT_FOUND" | "VERSION_CONFLICT" | "BASE_UNIT_LOCKED";

export interface CatalogRepository {
  list(query: QueryProductsDto): Promise<ProductPage>;
  findById(id: string): Promise<ProductView | null>;
  create(input: CreateProductDto): Promise<ProductView>;
  update(id: string, input: UpdateProductDto): Promise<ProductUpdateResult>;
  updateStatus(
    id: string,
    status: ProductStatus,
    expectedVersion: number,
  ): Promise<ProductView | null>;
  references(): Promise<{
    categories: { id: string; code: string; name: string }[];
    brands: { id: string; code: string; name: string }[];
    units: { id: string; code: string; name: string; decimalScale: number }[];
  }>;
}
