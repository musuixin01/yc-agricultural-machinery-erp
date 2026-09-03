import { authenticatedFetch } from "../auth/auth-api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type SalesStatus =
  "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED" | "CANCELLED";

export type SalesDocument = {
  id: string;
  documentNumber: string;
  status: SalesStatus;
  settlementType: "IMMEDIATE" | "CREDIT";
  businessDate: string;
  soldAt: string;
  dueDate: string;
  totalAmount: string;
  totalCost: string;
  grossProfit: string;
  version: number;
  customerNameSnapshot: string | null;
  customerPhoneSnapshot: string | null;
  customer: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string } | null;
  postedBy: { id: string; displayName: string } | null;
  receivableEntry: {
    id: string;
    outstandingAmount: string;
    status: string;
  } | null;
  reversal: {
    id: string;
    documentNumber: string;
    businessDate: string;
    reversedAt: string;
    totalAmount: string;
    totalCost: string;
    reason: string;
    postedAt: string;
    postedBy: { id: string; displayName: string };
  } | null;
  lines: {
    id: string;
    product: { id: string; code: string; name: string };
    quantity: string;
    unitPrice: string;
    lineAmount: string;
    unitCost: string;
    costAmount: string;
    grossProfit: string;
    unitNameSnapshot: string;
  }[];
};

export type ReceivableEntry = {
  id: string;
  customer: { id: string; code: string; name: string };
  sourceDocument: {
    documentNumber: string;
    businessDate: string;
    customerNameSnapshot: string | null;
    customerPhoneSnapshot: string | null;
  };
  originalAmount: string;
  outstandingAmount: string;
  dueDate: string;
  status: "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "REVERSED";
};

export type SalesReturn = {
  id: string;
  documentNumber: string;
  businessDate: string;
  returnedAt: string;
  totalAmount: string;
  totalCost: string;
  receivableReduction: string;
  refundAmount: string;
  reason: string;
  sourceSalesDocument: {
    id: string;
    documentNumber: string;
    settlementType: "IMMEDIATE" | "CREDIT";
    soldAt: string;
  };
  customer: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string; type: string } | null;
  postedBy: { id: string; displayName: string };
  postedAt: string;
  lines: {
    id: string;
    sourceSalesLineId: string;
    product: { id: string; code: string; name: string };
    quantity: string;
    unitPrice: string;
    lineAmount: string;
    unitCost: string;
    costAmount: string;
    unitNameSnapshot: string;
  }[];
};

export type SalesReturnInput = {
  sourceSalesDocumentId: string;
  businessDate: string;
  returnedAt: string;
  cashAccountId?: string;
  reason: string;
  lines: { sourceSalesLineId: string; quantity: string }[];
};

export type SalesReversalInput = {
  document: SalesDocument;
  businessDate: string;
  reversedAt: string;
  reason: string;
};

export type SalesReturnsResponse = {
  items: SalesReturn[];
  summary: { totalAmount: string };
};

export type SalesInput = {
  settlementType: "IMMEDIATE" | "CREDIT";
  customerId?: string;
  cashAccountId?: string;
  warehouseId: string;
  businessDate: string;
  soldAt: string;
  dueDate?: string;
  notes?: string;
  lines: { productId: string; quantity: string; unitPrice: string }[];
};

export class SalesCompletionError extends Error {
  constructor(
    message: string,
    readonly savedDocument: SalesDocument,
  ) {
    super(message);
    this.name = "SalesCompletionError";
  }
}

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
    const messages = Array.isArray(body?.message)
      ? body.message
      : [body?.detail ?? body?.message].filter((item): item is string =>
          Boolean(item),
        );
    const message = messages.some((item) =>
      /^property .+ should not exist$/.test(item),
    )
      ? "当前页面与后台服务版本不一致，请刷新页面；如果仍然出现，请重启玉春 ERP 服务。"
      : messages
          .map((item) =>
            item === "dueDate must be a valid ISO 8601 date string"
              ? "约定付款日格式不正确，请重新选择日期"
              : item,
          )
          .join("；");
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const salesApi = {
  documents: () => request<{ items: SalesDocument[] }>("/sales/documents"),
  receivables: () =>
    request<{ items: ReceivableEntry[] }>("/sales/receivables"),
  returns: () => request<SalesReturnsResponse>("/sales/returns"),
  postReturn: (input: SalesReturnInput) =>
    request<SalesReturn>("/sales/returns", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  create: (input: SalesInput) =>
    request<SalesDocument>("/sales/documents", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submit: (document: SalesDocument) =>
    request<SalesDocument>(
      `/sales/documents/${document.id}/submit?version=${document.version}`,
      { method: "POST" },
    ),
  post: (document: SalesDocument) =>
    request<SalesDocument>(`/sales/documents/${document.id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  reverse: ({ document, ...input }: SalesReversalInput) =>
    request<SalesDocument["reversal"]>(
      `/sales/documents/${document.id}/reverse`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      },
    ),
  complete: async (input: SalesInput) => {
    const created = await salesApi.create(input);
    let savedDocument = created;
    try {
      savedDocument = await salesApi.submit(created);
      return await salesApi.post(savedDocument);
    } catch (reason) {
      const cause = reason instanceof Error ? reason.message : "未知错误";
      const state = savedDocument.status === "SUBMITTED" ? "已提交" : "草稿";
      throw new SalesCompletionError(
        `销售单已安全保留为${state}，但未能完成过账：${cause}。请关闭窗口后在销售记录中继续处理，避免重复开单。`,
        savedDocument,
      );
    }
  },
};
