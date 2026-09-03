import { authenticatedFetch } from "../auth/auth-api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type ReceivableEntry = {
  id: string;
  customer: { id: string; code: string; name: string; phone: string | null };
  sourceDocument: { documentNumber: string; soldAt: string };
  originalAmount: string;
  outstandingAmount: string;
  dueDate: string;
  status: "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "REVERSED";
};

export type CustomerReceipt = {
  id: string;
  documentNumber: string;
  businessDate: string;
  amount: string;
  postedAt: string;
  notes: string | null;
  customer: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string };
  postedBy: { id: string; displayName: string };
  allocations: {
    id: string;
    amount: string;
    createdAt: string;
    receivableEntry: {
      id: string;
      originalAmount: string;
      outstandingAmount: string;
      dueDate: string;
      status: "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "REVERSED";
      sourceDocument: { documentNumber: string; soldAt: string };
    };
  }[];
  reversal: {
    id: string;
    documentNumber: string;
    businessDate: string;
    reversedAt: string;
    amount: string;
    reason: string;
    postedAt: string;
    postedBy: { id: string; displayName: string };
  } | null;
};

export type CustomerReceiptReversalInput = {
  receipt: CustomerReceipt;
  businessDate: string;
  reversedAt: string;
  reason: string;
};

export type CustomerAdvance = {
  id: string;
  documentNumber: string;
  businessDate: string;
  amount: string;
  notes: string | null;
  postedAt: string;
  customer: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string };
  postedBy: { id: string; displayName: string };
  balance: { availableAmount: string; version: number } | null;
  applications: {
    id: string;
    documentNumber: string;
    amount: string;
    businessDate: string;
  }[];
};

export type CustomerAdvancesResponse = {
  items: CustomerAdvance[];
  summary: { originalAmount: string; availableAmount: string };
};

export type CustomerStatement = {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    contactName: string | null;
    address: string | null;
  };
  period: { dateFrom: string; dateTo: string };
  summary: {
    openingBalance: string;
    increases: string;
    decreases: string;
    closingBalance: string;
  };
  items: {
    id: string;
    businessDate: string;
    kind:
      | "CREDIT_SALE"
      | "SALES_RETURN"
      | "SALES_REVERSAL"
      | "CUSTOMER_RECEIPT"
      | "RECEIPT_REVERSAL"
      | "ADVANCE_APPLICATION";
    label: string;
    documentNumber: string;
    sourceDocumentNumber: string | null;
    increase: string;
    decrease: string;
    balance: string;
    note: string | null;
  }[];
  generatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : (body?.detail ?? body?.message);
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const receivablesApi = {
  entries: (customerId = "") =>
    request<{ items: ReceivableEntry[] }>(
      `/receivables/entries${customerId ? `?customerId=${customerId}` : ""}`,
    ),
  receipts: () =>
    request<{ items: CustomerReceipt[] }>("/receivables/receipts"),
  statement: (customerId: string, dateFrom: string, dateTo: string) =>
    request<CustomerStatement>(
      `/receivables/statements/${customerId}?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
    ),
  advances: () => request<CustomerAdvancesResponse>("/receivables/advances"),
  postAdvance: (input: {
    customerId: string;
    cashAccountId: string;
    businessDate: string;
    amount: string;
    notes?: string;
  }) =>
    request<CustomerAdvance>("/receivables/advances", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  applyAdvance: (input: {
    advance: CustomerAdvance;
    businessDate: string;
    allocations: { receivableEntryId: string; amount: string }[];
  }) =>
    request(`/receivables/advances/${input.advance.id}/apply`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        businessDate: input.businessDate,
        allocations: input.allocations,
      }),
    }),
  postReceipt: (input: {
    customerId: string;
    cashAccountId: string;
    businessDate: string;
    notes?: string;
    allocations: { receivableEntryId: string; amount: string }[];
  }) =>
    request<CustomerReceipt>("/receivables/receipts", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  reverseReceipt: ({ receipt, ...input }: CustomerReceiptReversalInput) =>
    request<CustomerReceipt["reversal"]>(
      `/receivables/receipts/${receipt.id}/reverse`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      },
    ),
};
