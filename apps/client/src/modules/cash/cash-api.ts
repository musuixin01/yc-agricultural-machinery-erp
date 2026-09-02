import { authenticatedFetch } from "../auth/auth-api";
import type { CashAccount } from "../payables/payables-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type CashTransfer = {
  id: string;
  documentNumber: string;
  businessDate: string;
  amount: string;
  notes: string | null;
  postedAt: string;
  fromCashAccount: Pick<CashAccount, "id" | "code" | "name" | "type">;
  toCashAccount: Pick<CashAccount, "id" | "code" | "name" | "type">;
  postedBy: { id: string; displayName: string };
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

export const cashApi = {
  transfers: () => request<{ items: CashTransfer[] }>("/cash/transfers"),
  postTransfer: (input: {
    fromCashAccountId: string;
    toCashAccountId: string;
    businessDate: string;
    amount: string;
    notes?: string;
  }) =>
    request<CashTransfer>("/cash/transfers", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
};
