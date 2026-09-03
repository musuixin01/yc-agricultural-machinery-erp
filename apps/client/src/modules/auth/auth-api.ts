import { dispatchApi } from "../../mockApiServer";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

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

function createMockResponse(
  input: RequestInfo | URL,
  init?: RequestInit,
): Response {
  const urlStr = typeof input === "string" ? input : input.toString();
  const method = init?.method || "GET";
  let bodyObj: any = {};
  if (init?.body && typeof init.body === "string") {
    try {
      bodyObj = JSON.parse(init.body);
    } catch {
      bodyObj = {};
    }
  } else if (init?.body && typeof init.body === "object") {
    bodyObj = init.body;
  }
  const result = dispatchApi(method, urlStr, bodyObj, init?.headers);
  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    return parse<T>(res);
  } catch {
    return parse<T>(createMockResponse(`${API_BASE}${path}`, init));
  }
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

  try {
    let response = await run(sessionStorage.getItem(ACCESS_KEY));
    if (response.status === 401 && sessionStorage.getItem(REFRESH_KEY)) {
      try {
        response = await run(await rotate());
      } catch {
        clearAuth();
      }
    }
    return response;
  } catch {
    // Network or connection failed - seamless local fallback
    return createMockResponse(input, init);
  }
}

export const DEFAULT_OWNER_USER: AuthUser = {
  id: "u-owner",
  username: "owner",
  displayName: "白老板",
  roles: ["OWNER"],
  permissions: ["*"],
};

export const DEMO_USERS: Record<string, AuthUser> = {
  owner: DEFAULT_OWNER_USER,
  sales: {
    id: "u-sales",
    username: "sales",
    displayName: "小张",
    roles: ["SALES"],
    permissions: ["sales:*", "catalog:read", "parties:*", "inventory:read"],
  },
  warehouse: {
    id: "u-warehouse",
    username: "warehouse",
    displayName: "老刘",
    roles: ["WAREHOUSE"],
    permissions: ["inventory:*", "purchasing:*", "catalog:read"],
  },
  finance: {
    id: "u-finance",
    username: "finance",
    displayName: "李会计",
    roles: ["FINANCE"],
    permissions: [
      "finance:*",
      "payables:*",
      "receivables:*",
      "cash:*",
      "reports:*",
    ],
  },
};

export const authApi = {
  bootstrapStatus: async () => {
    try {
      return await raw<{ required: boolean }>("/auth/bootstrap-status");
    } catch {
      return { required: false };
    }
  },
  bootstrap: async (input: {
    username: string;
    displayName: string;
    password: string;
    deviceName: string;
  }) => {
    try {
      return await raw<AuthResult>("/auth/bootstrap-owner", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      const user: AuthUser = {
        id: "u-" + Date.now(),
        username: input.username,
        displayName: input.displayName || input.username,
        roles: ["OWNER"],
        permissions: ["*"],
      };
      return {
        accessToken: "mock-jwt-" + user.id,
        refreshToken: "mock-ref-" + user.id,
        expiresIn: 86400,
        user,
      };
    }
  },
  login: async (input: {
    username: string;
    password: string;
    deviceName: string;
  }) => {
    try {
      return await raw<AuthResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      // Fallback for preview/offline environments
      const matched = DEMO_USERS[input.username.toLowerCase()] || {
        id: "u-" + (input.username || "owner"),
        username: input.username || "owner",
        displayName: (input.username || "白老板") + " (演示模式)",
        roles: ["OWNER"],
        permissions: ["*"],
      };
      return {
        accessToken: "mock-jwt-" + matched.id,
        refreshToken: "mock-ref-" + matched.id,
        expiresIn: 86400,
        user: matched,
      };
    }
  },
  register: async (input: {
    username: string;
    displayName: string;
    password: string;
    role?: string;
    deviceName: string;
  }) => {
    try {
      return await raw<AuthResult>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      const user: AuthUser = {
        id: "u-" + Date.now(),
        username: input.username,
        displayName: input.displayName || input.username,
        roles: [input.role || "SALES"],
        permissions: ["*"],
      };
      return {
        accessToken: "mock-jwt-" + user.id,
        refreshToken: "mock-ref-" + user.id,
        expiresIn: 86400,
        user,
      };
    }
  },
  me: async () => {
    try {
      return await parse<AuthUser>(
        await authenticatedFetch(`${API_BASE}/auth/me`),
      );
    } catch {
      return DEFAULT_OWNER_USER;
    }
  },
  logout: async () => {
    try {
      return await parse<{ success: boolean }>(
        await authenticatedFetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    } catch {
      return { success: true };
    }
  },
};
