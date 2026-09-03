import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inventoryApi,
  type InitialStockInput,
  type CreateStocktakeInput,
  type InventoryStocktake,
  type InventoryDamageDocument,
  type InventoryDamageInput,
  type InventoryLedgerQuery,
  type OpeningDocument,
  type OpeningInput,
  type SaveStocktakeCountsInput,
  type UpdateInventoryDamageInput,
  type InventoryTransferDocument,
  type CreateTransferInput,
  type UpdateTransferInput,
} from "./inventory-api";

export function useOpeningDocuments() {
  return useQuery({
    queryKey: ["inventory", "opening"],
    queryFn: inventoryApi.documents,
  });
}
export function useInventoryBalances() {
  return useQuery({
    queryKey: ["inventory", "balances"],
    queryFn: inventoryApi.balances,
  });
}
export function useInventoryLedger(query: InventoryLedgerQuery) {
  return useQuery({
    queryKey: ["inventory", "ledger", query],
    queryFn: () => inventoryApi.ledger(query),
  });
}
export function useStocktakes() {
  return useQuery({
    queryKey: ["inventory", "stocktakes"],
    queryFn: inventoryApi.stocktakes,
  });
}
export function useInventoryDamages() {
  return useQuery({
    queryKey: ["inventory", "damages"],
    queryFn: inventoryApi.damages,
  });
}
function useInventoryMutation<T, R = unknown>(
  mutationFn: (value: T) => Promise<R>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ["inventory"] }),
  });
}
export function useCreateOpening() {
  return useInventoryMutation<OpeningInput>(inventoryApi.create);
}
export function useCreateInitialStock() {
  return useInventoryMutation<InitialStockInput>(
    inventoryApi.createInitialStock,
  );
}
export function useSubmitOpening() {
  return useInventoryMutation<OpeningDocument>(inventoryApi.submit);
}
export function usePostOpening() {
  return useInventoryMutation<OpeningDocument>(inventoryApi.post);
}
export function useCreateStocktake() {
  return useInventoryMutation<CreateStocktakeInput, InventoryStocktake>(
    inventoryApi.createStocktake,
  );
}
export function useSaveStocktakeCounts() {
  return useInventoryMutation<SaveStocktakeCountsInput, InventoryStocktake>(
    inventoryApi.saveStocktakeCounts,
  );
}
export function useSubmitStocktake() {
  return useInventoryMutation<InventoryStocktake, InventoryStocktake>(
    inventoryApi.submitStocktake,
  );
}
export function usePostStocktake() {
  return useInventoryMutation<InventoryStocktake, InventoryStocktake>(
    inventoryApi.postStocktake,
  );
}
export function useCreateInventoryDamage() {
  return useInventoryMutation<InventoryDamageInput, InventoryDamageDocument>(
    inventoryApi.createDamage,
  );
}
export function useUpdateInventoryDamage() {
  return useInventoryMutation<
    UpdateInventoryDamageInput,
    InventoryDamageDocument
  >(inventoryApi.updateDamage);
}
export function useSubmitInventoryDamage() {
  return useInventoryMutation<InventoryDamageDocument, InventoryDamageDocument>(
    inventoryApi.submitDamage,
  );
}
export function usePostInventoryDamage() {
  return useInventoryMutation<InventoryDamageDocument, InventoryDamageDocument>(
    inventoryApi.postDamage,
  );
}

export function useInventoryTransfers() {
  return useQuery({
    queryKey: ["inventory", "transfers"],
    queryFn: inventoryApi.transfers,
  });
}

export function useCreateInventoryTransfer() {
  return useInventoryMutation<CreateTransferInput, InventoryTransferDocument>(
    inventoryApi.createTransfer,
  );
}

export function useUpdateInventoryTransfer() {
  return useInventoryMutation<UpdateTransferInput, InventoryTransferDocument>(
    inventoryApi.updateTransfer,
  );
}

export function useSubmitInventoryTransfer() {
  return useInventoryMutation<
    InventoryTransferDocument,
    InventoryTransferDocument
  >(inventoryApi.submitTransfer);
}

export function usePostInventoryTransfer() {
  return useInventoryMutation<
    InventoryTransferDocument,
    InventoryTransferDocument
  >(inventoryApi.postTransfer);
}
