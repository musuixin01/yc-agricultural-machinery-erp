import { authenticatedFetch } from "../auth/auth-api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type CashAccount = {
  id: string;
  code: string;
  name: string;
  type: "CASH" | "BANK" | "WECHAT" | "ALIPAY" | "OTHER";
  status: "ACTIVE" | "INACTIVE";
  balance: string;
};
export type PayableEntry = {
  id: string;
  supplier: { id: string; code: string; name: string };
  sourceDocument: {
    documentNumber: string;
    businessDate: string;
  };
  originalAmount: string;
  outstandingAmount: string;
  dueDate: string;
  status: "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "REVERSED";
};
export type SupplierPayment = {
  id: string;
  documentNumber: string;
  status: "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED" | "CANCELLED";
  businessDate: string;
  amount: string;
  notes: string | null;
  version: number;
  postedAt: string | null;
  supplier: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string };
  postedBy: { id: string; displayName: string } | null;
  reversal: {
    id: string;
    documentNumber: string;
    businessDate: string;
    reversedAt: string;
    amount: string;
    reason: string;
    postedAt: string;
  } | null;
  allocations: {
    id: string;
    amount: string;
    payableEntry: PayableEntry;
  }[];
};

export type SupplierPaymentReversalInput = {
  payment: SupplierPayment;
  businessDate: string;
  reversedAt: string;
  reason: string;
};
export type SupplierAdvance = {
  id: string;
  documentNumber: string;
  businessDate: string;
  amount: string;
  notes: string | null;
  supplier: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string };
  balance: {
    availableAmount: string;
    version: number;
    updatedAt: string;
  } | null;
  applications: {
    id: string;
    documentNumber: string;
    businessDate: string;
    amount: string;
    lines: { id: string; payableEntryId: string; amount: string }[];
  }[];
};
export type SupplierAdvancesResponse = {
  items: SupplierAdvance[];
  summary: { originalAmount: string; availableAmount: string };
};
export type SupplierStatement = {
  supplier: {
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
      | "CREDIT_PURCHASE"
      | "PURCHASE_RETURN"
      | "SUPPLIER_PAYMENT"
      | "PAYMENT_REVERSAL"
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

export const payablesApi = {
  accounts: () => request<{ items: CashAccount[] }>("/payables/cash-accounts"),
  createAccount: (input: {
    code: string;
    name: string;
    type: CashAccount["type"];
    openingBalance: string;
  }) =>
    request<CashAccount>("/payables/cash-accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  entries: (supplierId = "") =>
    request<{ items: PayableEntry[] }>(
      `/payables/entries${supplierId ? `?supplierId=${supplierId}` : ""}`,
    ),
  statement: (supplierId: string, dateFrom: string, dateTo: string) =>
    request<SupplierStatement>(
      `/payables/statements/${supplierId}?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
    ),
  payments: () => request<{ items: SupplierPayment[] }>("/payables/payments"),
  advances: () => request<SupplierAdvancesResponse>("/payables/advances"),
  createPayment: (input: {
    supplierId: string;
    cashAccountId: string;
    businessDate: string;
    allocations: { payableEntryId: string; amount: string }[];
  }) =>
    request<SupplierPayment>("/payables/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submit: (payment: SupplierPayment) =>
    request<SupplierPayment>(
      `/payables/payments/${payment.id}/submit?version=${payment.version}`,
      { method: "POST" },
    ),
  post: (payment: SupplierPayment) =>
    request<SupplierPayment>(`/payables/payments/${payment.id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  reverse: ({ payment, ...input }: SupplierPaymentReversalInput) =>
    request(`/payables/payments/${payment.id}/reverse`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  postAdvance: (input: {
    supplierId: string;
    cashAccountId: string;
    businessDate: string;
    amount: string;
    notes?: string;
  }) =>
    request<SupplierAdvance>("/payables/advances", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  applyAdvance: (input: {
    advance: SupplierAdvance;
    businessDate: string;
    allocations: { payableEntryId: string; amount: string }[];
  }) =>
    request(`/payables/advances/${input.advance.id}/apply`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        businessDate: input.businessDate,
        allocations: input.allocations,
      }),
    }),
};
