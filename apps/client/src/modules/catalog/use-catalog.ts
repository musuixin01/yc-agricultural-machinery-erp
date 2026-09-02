import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  catalogApi,
  type CreateProductInput,
  type Product,
  type ProductStatus,
  type UpdateProductInput,
} from "./catalog-api";

export function useProducts(search: string, categoryId = "", status = "") {
  return useQuery({
    queryKey: ["catalog", "products", search, categoryId, status],
    queryFn: () => catalogApi.list(search, categoryId, status),
  });
}
export function useCatalogReferences(enabled = true) {
  return useQuery({
    queryKey: ["catalog", "references"],
    queryFn: catalogApi.references,
    enabled,
  });
}
export function useCreateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => catalogApi.create(input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["catalog", "products"] }),
  });
}
export function useUpdateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      product,
      input,
    }: {
      product: Product;
      input: UpdateProductInput;
    }) => catalogApi.update(product, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["catalog", "products"] }),
  });
}
export function useSetProductStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      product,
      status,
    }: {
      product: Product;
      status: ProductStatus;
    }) => catalogApi.setStatus(product, status),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["catalog", "products"] }),
  });
}
