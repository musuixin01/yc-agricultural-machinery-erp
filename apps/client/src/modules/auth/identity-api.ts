import { authenticatedFetch } from "./auth-api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";
export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  version: number;
  createdAt: string;
  roles: { code: string; name: string }[];
  activeSessionCount: number;
};
export type EmployeeRole = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: { permission: { code: string; name: string } }[];
};
export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  result: "SUCCESS" | "FAILURE";
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; username: string; displayName: string } | null;
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

export const identityApi = {
  roles: () => request<EmployeeRole[]>("/identity/roles"),
  users: (search: string, status: string) =>
    request<{ items: ManagedUser[]; total: number }>(
      `/identity/users?page=1&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`,
    ),
  createUser: (input: {
    username: string;
    displayName: string;
    password: string;
    roleCodes: string[];
  }) =>
    request<ManagedUser>("/identity/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setStatus: (user: ManagedUser, status: "ACTIVE" | "INACTIVE") =>
    request<ManagedUser>(`/identity/users/${user.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version: user.version }),
    }),
  revokeSessions: (user: ManagedUser) =>
    request<{ success: boolean; revokedCount: number }>(
      `/identity/users/${user.id}/revoke-sessions`,
      { method: "POST" },
    ),
  resetPassword: (user: ManagedUser, password: string) =>
    request<{ success: boolean }>(`/identity/users/${user.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  audit: (result: string) =>
    request<{ items: AuditEvent[]; total: number }>(
      `/identity/audit-events?page=1&pageSize=50${result ? `&result=${result}` : ""}`,
    ),
};
