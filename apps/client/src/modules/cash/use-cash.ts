import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cashApi } from "./cash-api";

export function useCashTransfers() {
  return useQuery({
    queryKey: ["cash", "transfers"],
    queryFn: cashApi.transfers,
  });
}

export function usePostCashTransfer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: cashApi.postTransfer,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["cash"] }),
        client.invalidateQueries({ queryKey: ["payables", "accounts"] }),
      ]);
    },
  });
}
