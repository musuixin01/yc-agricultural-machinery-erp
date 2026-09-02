import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  payablesApi,
  type CashAccount,
  type SupplierPaymentReversalInput,
  type SupplierPayment,
  type SupplierAdvance,
} from "./payables-api";

export function useCashAccounts() {
  return useQuery({
    queryKey: ["payables", "accounts"],
    queryFn: payablesApi.accounts,
  });
}
export function usePayableEntries(supplierId = "") {
  return useQuery({
    queryKey: ["payables", "entries", supplierId],
    queryFn: () => payablesApi.entries(supplierId),
  });
}
export function useSupplierPayments() {
  return useQuery({
    queryKey: ["payables", "payments"],
    queryFn: payablesApi.payments,
  });
}
export function useSupplierStatement(
  supplierId: string,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery({
    queryKey: ["payables", "statement", supplierId, dateFrom, dateTo],
    queryFn: () => payablesApi.statement(supplierId, dateFrom, dateTo),
    enabled: Boolean(supplierId && dateFrom && dateTo),
  });
}
export function useSupplierAdvances() {
  return useQuery({
    queryKey: ["payables", "advances"],
    queryFn: payablesApi.advances,
  });
}
function mutation<T, Result = unknown>(fn: (input: T) => Promise<Result>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["payables"] });
      await client.invalidateQueries({ queryKey: ["purchasing", "payables"] });
    },
  });
}
export function useCreateCashAccount() {
  return mutation<{
    code: string;
    name: string;
    type: CashAccount["type"];
    openingBalance: string;
  }>(payablesApi.createAccount);
}
export function useCreateSupplierPayment() {
  return mutation<{
    supplierId: string;
    cashAccountId: string;
    businessDate: string;
    allocations: { payableEntryId: string; amount: string }[];
  }>(payablesApi.createPayment);
}
export function useSubmitSupplierPayment() {
  return mutation<SupplierPayment>(payablesApi.submit);
}
export function usePostSupplierPayment() {
  return mutation<SupplierPayment, SupplierPayment>(payablesApi.post);
}

export function useReverseSupplierPayment() {
  return mutation<SupplierPaymentReversalInput>(payablesApi.reverse);
}

export function usePostSupplierAdvance() {
  return mutation<{
    supplierId: string;
    cashAccountId: string;
    businessDate: string;
    amount: string;
    notes?: string;
  }>(payablesApi.postAdvance);
}

export function useApplySupplierAdvance() {
  return mutation<{
    advance: SupplierAdvance;
    businessDate: string;
    allocations: { payableEntryId: string; amount: string }[];
  }>(payablesApi.applyAdvance);
}
