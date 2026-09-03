const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
import { authenticatedFetch } from "../auth/auth-api";
export type PartyRole = "CUSTOMER" | "SUPPLIER";
export type PartyStatus = "ACTIVE" | "INACTIVE";
export type Party = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  taxId: string | null;
  identityNumberMasked: string | null;
  hasPortrait: boolean;
  roles: PartyRole[];
  creditLimit: string;
  paymentTermsDays: number;
  paymentTermsMonths: number;
  province: string | null;
  city: string | null;
  address: string | null;
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    position: string | null;
    isPrimary: boolean;
  }[];
  status: PartyStatus;
  version: number;
};
export type PartyPage = {
  items: Party[];
  page: number;
  pageSize: number;
  total: number;
};
export type CreatePartyInput = {
  code: string;
  name: string;
  shortName?: string;
  roles: PartyRole[];
  taxId?: string;
  identityNumber?: string;
  portraitDataUrl?: string;
  creditLimit?: string;
  paymentTermsDays?: number;
  paymentTermsMonths?: number;
  province?: string;
  city?: string;
  address?: string;
  notes?: string;
  contacts?: {
    name: string;
    phone?: string;
    email?: string;
    position?: string;
    isPrimary: boolean;
  }[];
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      detail?: string;
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join("；")
      : (body?.detail ?? body?.message);
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}
export const partiesApi = {
  list: (search: string, role: string) =>
    request<PartyPage>(
      `/parties?page=1&pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ""}${role ? `&role=${role}` : ""}`,
    ),
  create: (input: CreatePartyInput) =>
    request<Party>("/parties", { method: "POST", body: JSON.stringify(input) }),
  update: (
    id: string,
    input: Partial<CreatePartyInput> & { version?: number },
  ) =>
    request<Party>(`/parties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  batchImport: (parties: CreatePartyInput[]) =>
    request<{ count: number; items: Party[] }>("/parties/batch", {
      method: "POST",
      body: JSON.stringify({ parties }),
    }),
  setStatus: (party: Party, status: PartyStatus) =>
    request<Party>(`/parties/${party.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version: party.version }),
    }),
};
