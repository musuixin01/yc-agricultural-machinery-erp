import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  salesApi,
  type SalesDocument,
  type SalesInput,
  type SalesReversalInput,
  type SalesReturnInput,
} from "./sales-api";

export function useSalesDocuments() {
  return useQuery({
    queryKey: ["sales", "documents"],
    queryFn: salesApi.documents,
  });
}

export function useReceivables() {
  return useQuery({
    queryKey: ["sales", "receivables"],
    queryFn: salesApi.receivables,
  });
}
export function useSalesReturns() {
  return useQuery({
    queryKey: ["sales", "returns"],
    queryFn: salesApi.returns,
  });
}

function useSalesMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["sales"] });
      await client.invalidateQueries({ queryKey: ["inventory"] });
      await client.invalidateQueries({ queryKey: ["payables"] });
    },
  });
}

export function useCreateSales() {
  return useSalesMutation<SalesInput>(salesApi.create);
}

export function useCompleteSales() {
  return useSalesMutation<SalesInput>(salesApi.complete);
}

export function useSubmitSales() {
  return useSalesMutation<SalesDocument>(salesApi.submit);
}

export function usePostSales() {
  return useSalesMutation<SalesDocument>(salesApi.post);
}
export function usePostSalesReturn() {
  return useSalesMutation<SalesReturnInput>(salesApi.postReturn);
}
export function useReverseSales() {
  return useSalesMutation<SalesReversalInput>(salesApi.reverse);
}
