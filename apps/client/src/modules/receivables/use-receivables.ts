import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  receivablesApi,
  type CustomerAdvance,
  type CustomerReceiptReversalInput,
} from "./receivables-api";

export function useCustomerAdvances() {
  return useQuery({
    queryKey: ["receivables", "advances"],
    queryFn: receivablesApi.advances,
  });
}

export function useReceivableEntries(customerId = "") {
  return useQuery({
    queryKey: ["receivables", "entries", customerId],
    queryFn: () => receivablesApi.entries(customerId),
  });
}

export function useCustomerReceipts() {
  return useQuery({
    queryKey: ["receivables", "receipts"],
    queryFn: receivablesApi.receipts,
  });
}

export function useCustomerStatement(
  customerId: string,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery({
    queryKey: ["receivables", "statement", customerId, dateFrom, dateTo],
    queryFn: () => receivablesApi.statement(customerId, dateFrom, dateTo),
    enabled: Boolean(customerId && dateFrom && dateTo),
  });
}

export function usePostCustomerReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: receivablesApi.postReceipt,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["receivables"] }),
        client.invalidateQueries({ queryKey: ["payables", "accounts"] }),
      ]);
    },
  });
}

export function usePostCustomerAdvance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: receivablesApi.postAdvance,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["receivables"] }),
        client.invalidateQueries({ queryKey: ["payables", "accounts"] }),
      ]);
    },
  });
}

export function useApplyCustomerAdvance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      advance: CustomerAdvance;
      businessDate: string;
      allocations: { receivableEntryId: string; amount: string }[];
    }) => receivablesApi.applyAdvance(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["receivables"] });
    },
  });
}

export function useReverseCustomerReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerReceiptReversalInput) =>
      receivablesApi.reverseReceipt(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["receivables"] }),
        client.invalidateQueries({ queryKey: ["payables", "accounts"] }),
        client.invalidateQueries({ queryKey: ["sales"] }),
      ]);
    },
  });
}
