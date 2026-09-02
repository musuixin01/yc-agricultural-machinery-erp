import { authenticatedFetch } from "../auth/auth-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type InventoryStatus =
  "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED" | "CANCELLED";
export type OpeningDocument = {
  id: string;
  documentNumber: string;
  status: InventoryStatus;
  businessDate: string;
  notes: string | null;
  version: number;
  warehouse: { id: string; code: string; name: string };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  postedBy: { id: string; displayName: string } | null;
  submittedAt: string | null;
  postedAt: string | null;
  lines: {
    id: string;
    product: { id: string; code: string; name: string };
    location: { id: string; code: string; name: string } | null;
    productNameSnapshot: string;
    unitNameSnapshot: string;
    quantity: string;
    unitCost: string;
    lineAmount: string;
  }[];
};
export type InventoryBalance = {
  id: string;
  product: {
    id: string;
    code: string;
    name: string;
    categoryName: string;
    unitName: string;
    safetyStock: string;
  };
  warehouse: { id: string; code: string; name: string };
  quantity: string;
  totalCost: string;
  averageCost: string;
  version: number;
  updatedAt: string;
};
export type InventoryLedgerSourceType =
  | "INITIAL_STOCK"
  | "OPENING"
  | "PURCHASE_RECEIPT"
  | "PURCHASE_RETURN"
  | "SALES_DISPATCH"
  | "CASH_SALE"
  | "SALES_RETURN"
  | "SALES_REVERSAL"
  | "STOCKTAKE_GAIN"
  | "STOCKTAKE_LOSS"
  | "INVENTORY_DAMAGE";
export type InventoryLedgerEntry = {
  id: string;
  sourceDocumentId: string;
  sourceDocumentType: InventoryLedgerSourceType;
  sourceDocumentNumber: string | null;
  product: {
    id: string;
    code: string;
    name: string;
    unitName: string;
  };
  warehouse: { id: string; code: string; name: string };
  location: { id: string; code: string; name: string } | null;
  quantityChange: string;
  unitCost: string;
  costAmount: string;
  businessDate: string;
  postedAt: string;
  postedBy: { id: string; displayName: string };
};
export type InventoryLedgerQuery = {
  keyword?: string;
  sourceDocumentType?: InventoryLedgerSourceType;
  page?: number;
  pageSize?: number;
};
export type OpeningInput = {
  warehouseId: string;
  businessDate: string;
  notes?: string;
  lines: {
    productId: string;
    locationId?: string;
    quantity: string;
    unitCost: string;
  }[];
};
export type InitialStockInput = {
  productId: string;
  warehouseId: string;
  businessDate: string;
  quantity: string;
  unitCost: string;
};
export type InventoryStocktake = {
  id: string;
  documentNumber: string;
  status: "DRAFT" | "SUBMITTED" | "POSTED" | "CANCELLED";
  businessDate: string;
  notes: string | null;
  version: number;
  warehouse: { id: string; code: string; name: string };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  postedBy: { id: string; displayName: string } | null;
  submittedAt: string | null;
  postedAt: string | null;
  progress: { counted: number; total: number };
  varianceCount: number;
  lines: {
    id: string;
    product: { id: string; code: string; name: string };
    productNameSnapshot: string;
    unitNameSnapshot: string;
    baselineQuantity: string;
    baselineTotalCost: string;
    baselineAverageCost: string;
    countedQuantity: string | null;
    varianceQuantity: string | null;
    reason: string | null;
  }[];
};
export type CreateStocktakeInput = {
  warehouseId: string;
  businessDate: string;
  notes?: string;
};
export type SaveStocktakeCountsInput = {
  stocktake: InventoryStocktake;
  lines: { lineId: string; countedQuantity: string; reason?: string }[];
};
export type InventoryDamageReason = "DAMAGED" | "RUSTED" | "OBSOLETE" | "OTHER";
export type InventoryDamageDocument = {
  id: string;
  documentNumber: string;
  status: "DRAFT" | "SUBMITTED" | "POSTED" | "CANCELLED";
  businessDate: string;
  notes: string | null;
  version: number;
  totalCost: string;
  warehouse: { id: string; code: string; name: string };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  postedBy: { id: string; displayName: string } | null;
  submittedAt: string | null;
  postedAt: string | null;
  lines: {
    id: string;
    product: { id: string; code: string; name: string };
    productNameSnapshot: string;
    unitNameSnapshot: string;
    quantity: string;
    reason: InventoryDamageReason;
    reasonDetail: string | null;
  }[];
};
export type InventoryDamageInput = {
  warehouseId: string;
  businessDate: string;
  notes?: string;
  lines: {
    productId: string;
    quantity: string;
    reason: InventoryDamageReason;
    reasonDetail?: string;
  }[];
};
export type UpdateInventoryDamageInput = {
  document: InventoryDamageDocument;
  input: InventoryDamageInput;
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

export const inventoryApi = {
  documents: () =>
    request<{ items: OpeningDocument[] }>("/inventory/opening-documents"),
  balances: () => request<{ items: InventoryBalance[] }>("/inventory/balances"),
  ledger: (query: InventoryLedgerQuery = {}) => {
    const parameters = new URLSearchParams();
    if (query.keyword?.trim()) parameters.set("keyword", query.keyword.trim());
    if (query.sourceDocumentType)
      parameters.set("sourceDocumentType", query.sourceDocumentType);
    parameters.set("page", String(query.page ?? 1));
    parameters.set("pageSize", String(query.pageSize ?? 20));
    return request<{
      items: InventoryLedgerEntry[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`/inventory/ledger?${parameters.toString()}`);
  },
  stocktakes: () =>
    request<{ items: InventoryStocktake[] }>("/inventory/stocktakes"),
  createStocktake: (input: CreateStocktakeInput) =>
    request<InventoryStocktake>("/inventory/stocktakes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveStocktakeCounts: ({ stocktake, lines }: SaveStocktakeCountsInput) =>
    request<InventoryStocktake>(
      `/inventory/stocktakes/${stocktake.id}/counts`,
      {
        method: "PATCH",
        body: JSON.stringify({ version: stocktake.version, lines }),
      },
    ),
  damages: () =>
    request<{ items: InventoryDamageDocument[] }>("/inventory/damages"),
  createDamage: (input: InventoryDamageInput) =>
    request<InventoryDamageDocument>("/inventory/damages", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDamage: ({ document, input }: UpdateInventoryDamageInput) =>
    request<InventoryDamageDocument>(`/inventory/damages/${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...input, version: document.version }),
    }),
  submitDamage: (document: InventoryDamageDocument) =>
    request<InventoryDamageDocument>(
      `/inventory/damages/${document.id}/submit?version=${document.version}`,
      { method: "POST" },
    ),
  postDamage: (document: InventoryDamageDocument) =>
    request<InventoryDamageDocument>(`/inventory/damages/${document.id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  submitStocktake: (stocktake: InventoryStocktake) =>
    request<InventoryStocktake>(
      `/inventory/stocktakes/${stocktake.id}/submit?version=${stocktake.version}`,
      { method: "POST" },
    ),
  postStocktake: (stocktake: InventoryStocktake) =>
    request<InventoryStocktake>(`/inventory/stocktakes/${stocktake.id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  createInitialStock: (input: InitialStockInput) =>
    request<OpeningDocument>("/inventory/initial-stock", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  create: (input: OpeningInput) =>
    request<OpeningDocument>("/inventory/opening-documents", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submit: (document: OpeningDocument) =>
    request<OpeningDocument>(
      `/inventory/opening-documents/${document.id}/submit?version=${document.version}`,
      { method: "POST" },
    ),
  post: (document: OpeningDocument) =>
    request<OpeningDocument>(
      `/inventory/opening-documents/${document.id}/post`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    ),
};
