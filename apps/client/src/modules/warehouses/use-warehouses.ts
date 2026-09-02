import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  warehousesApi,
  type CreateWarehouseInput,
  type Warehouse,
  type WarehouseStatus,
} from "./warehouses-api";

export function useWarehouses(search: string, status: string) {
  return useQuery({
    queryKey: ["warehouses", search, status],
    queryFn: () => warehousesApi.list(search, status),
  });
}

export function useCreateWarehouse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) => warehousesApi.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useSetWarehouseStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      warehouse,
      status,
    }: {
      warehouse: Warehouse;
      status: WarehouseStatus;
    }) => warehousesApi.setStatus(warehouse, status),
    onSuccess: () => client.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useSetDefaultWarehouse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (warehouse: Warehouse) => warehousesApi.setDefault(warehouse),
    onSuccess: () => client.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}
