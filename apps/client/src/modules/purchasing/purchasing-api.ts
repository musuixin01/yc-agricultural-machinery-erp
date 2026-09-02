import { authenticatedFetch } from "../auth/auth-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type PurchaseStatus =
  "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED" | "CANCELLED";
export type PurchaseReceipt = {
  id: string;
  documentNumber: string;
  status: PurchaseStatus;
  businessDate: string;
  dueDate: string;
  totalAmount: string;
  version: number;
  supplier: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string };
  postedBy: { id: string; displayName: string } | null;
  payableEntry: {
    id: string;
    outstandingAmount: string;
    status: string;
  } | null;
  lines: {
    id: string;
    product: { id: string; code: string; name: string };
    quantity: string;
    unitPrice: string;
    lineAmount: string;
    unitNameSnapshot: string;
  }[];
};
export type PurchaseInput = {
  supplierId: string;
  warehouseId: string;
  businessDate: string;
  dueDate: string;
  notes?: string;
  lines: { productId: string; quantity: string; unitPrice: string }[];
};
export type PayableEntry = {
  id: string;
  supplier: { id: string; code: string; name: string };
  sourceDocument: { documentNumber: string };
  originalAmount: string;
  outstandingAmount: string;
  dueDate: string;
  status: string;
};
export type PurchaseReturn = {
  id: string;
  documentNumber: string;
  businessDate: string;
  returnedAt: string;
  totalAmount: string;
  inventoryCost: string;
  payableReduction: string;
  refundAmount: string;
  reason: string;
  sourcePurchaseDocument: {
    id: string;
    documentNumber: string;
    businessDate: string;
  };
  supplier: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string } | null;
  lines: {
    id: string;
    sourcePurchaseLineId: string;
    quantity: string;
    unitPrice: string;
    lineAmount: string;
    product: { id: string; code: string; name: string };
    unitNameSnapshot: string;
  }[];
};
export type PurchaseReturnInput = {
  sourcePurchaseDocumentId: string;
  businessDate: string;
  returnedAt: string;
  cashAccountId?: string;
  reason: string;
  lines: { sourcePurchaseLineId: string; quantity: string }[];
};
export type PurchaseReturnsResponse = {
  items: PurchaseReturn[];
  summary: {
    totalAmount: string;
    payableReduction: string;
    refundAmount: string;
  };
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

export const purchasingApi = {
  receipts: () => request<{ items: PurchaseReceipt[] }>("/purchasing/receipts"),
  payables: () => request<{ items: PayableEntry[] }>("/purchasing/payables"),
  returns: () => request<PurchaseReturnsResponse>("/purchasing/returns"),
  create: (input: PurchaseInput) =>
    request<PurchaseReceipt>("/purchasing/receipts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submit: (document: PurchaseReceipt) =>
    request<PurchaseReceipt>(
      `/purchasing/receipts/${document.id}/submit?version=${document.version}`,
      { method: "POST" },
    ),
  post: (document: PurchaseReceipt) =>
    request<PurchaseReceipt>(`/purchasing/receipts/${document.id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  postReturn: (input: PurchaseReturnInput) =>
    request<PurchaseReturn>("/purchasing/returns", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
};
