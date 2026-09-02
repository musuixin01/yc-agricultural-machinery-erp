import type { CreateProductDto } from "./dto/create-product.dto.js";
import type { QueryProductsDto } from "./dto/query-products.dto.js";
import type {
  ProductPage,
  ProductStatus,
  ProductView,
} from "./catalog.types.js";

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");

export interface CatalogRepository {
  list(query: QueryProductsDto): Promise<ProductPage>;
  findById(id: string): Promise<ProductView | null>;
  create(input: CreateProductDto): Promise<ProductView>;
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
