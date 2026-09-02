const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};
type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

const ACCESS_KEY = "yc_access_token";
const REFRESH_KEY = "yc_refresh_token";
let refreshPromise: Promise<AuthResult> | null = null;

export function saveAuth(result: AuthResult) {
  sessionStorage.setItem(ACCESS_KEY, result.accessToken);
  sessionStorage.setItem(REFRESH_KEY, result.refreshToken);
}
export function clearAuth() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

async function parse<T>(response: Response): Promise<T> {
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

async function raw<T>(path: string, init?: RequestInit) {
  return parse<T>(
    await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    }),
  );
}

async function rotate() {
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error("请重新登录");
  refreshPromise ??= raw<AuthResult>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).finally(() => {
    refreshPromise = null;
  });
  const result = await refreshPromise;
  saveAuth(result);
  return result.accessToken;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const run = (token: string | null) =>
    fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let response = await run(sessionStorage.getItem(ACCESS_KEY));
  if (response.status === 401 && sessionStorage.getItem(REFRESH_KEY)) {
    try {
      response = await run(await rotate());
    } catch {
      clearAuth();
    }
  }
  return response;
}

export const authApi = {
  bootstrapStatus: () => raw<{ required: boolean }>("/auth/bootstrap-status"),
  bootstrap: (input: {
    username: string;
    displayName: string;
    password: string;
    deviceName: string;
  }) =>
    raw<AuthResult>("/auth/bootstrap-owner", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { username: string; password: string; deviceName: string }) =>
    raw<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: async () =>
    parse<AuthUser>(await authenticatedFetch(`${API_BASE}/auth/me`)),
  logout: async () =>
    parse<{ success: boolean }>(
      await authenticatedFetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    ),
};
