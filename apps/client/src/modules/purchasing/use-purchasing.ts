import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  purchasingApi,
  type PurchaseInput,
  type PurchaseReceipt,
  type PurchaseReturnInput,
} from "./purchasing-api";

export function usePurchaseReceipts() {
  return useQuery({
    queryKey: ["purchasing", "receipts"],
    queryFn: purchasingApi.receipts,
  });
}
export function usePayables() {
  return useQuery({
    queryKey: ["purchasing", "payables"],
    queryFn: purchasingApi.payables,
  });
}
export function usePurchaseReturns() {
  return useQuery({
    queryKey: ["purchasing", "returns"],
    queryFn: purchasingApi.returns,
  });
}
function usePurchaseMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["purchasing"] });
      await client.invalidateQueries({ queryKey: ["inventory"] });
      await client.invalidateQueries({ queryKey: ["payables"] });
    },
  });
}
export function useCreatePurchase() {
  return usePurchaseMutation<PurchaseInput>(purchasingApi.create);
}
export function useSubmitPurchase() {
  return usePurchaseMutation<PurchaseReceipt>(purchasingApi.submit);
}
export function usePostPurchase() {
  return usePurchaseMutation<PurchaseReceipt>(purchasingApi.post);
}
export function usePostPurchaseReturn() {
  return usePurchaseMutation<PurchaseReturnInput>(purchasingApi.postReturn);
}
