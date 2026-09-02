import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { LockKeyhole, ShieldCheck, Tractor } from "lucide-react";
import { authApi, clearAuth, saveAuth, type AuthUser } from "./auth-api";

const AuthContext = createContext<{
  user: AuthUser;
  logout: () => Promise<void>;
} | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthGate");
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"loading" | "setup" | "login" | "ready">(
    "loading",
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const status = await authApi.bootstrapStatus();
        if (status.required) return setMode("setup");
        try {
          const current = await authApi.me();
          setUser(current);
          setMode("ready");
        } catch {
          clearAuth();
          setMode("login");
        }
      } catch {
        setError("暂时无法连接玉春服务，请确认数据库和服务端已启动。");
        setMode("login");
      }
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const username = String(data.get("username"));
      const password = String(data.get("password"));
      const deviceName = window.innerWidth < 761 ? "玉春手机端" : "玉春桌面端";
      const result =
        mode === "setup"
          ? await authApi.bootstrap({
              username,
              password,
              deviceName,
              displayName: String(data.get("displayName")),
            })
          : await authApi.login({ username, password, deviceName });
      saveAuth(result);
      setUser(result.user);
      setMode("ready");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "操作失败，请稍后重试。",
      );
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      setUser(null);
      setMode("login");
    }
  }

  if (mode === "loading")
    return (
      <div className="auth-loading">
        <span>YC</span>
        <p>正在检查经营账本…</p>
      </div>
    );
  if (mode !== "ready" || !user)
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <div className="auth-brand">
            <span>YC</span>
            <strong>玉春农机</strong>
          </div>
          <div>
            <small>YC BUSINESS SYSTEM</small>
            <h1>
              把每一件商品，
              <br />
              每一笔账，都管得明明白白。
            </h1>
            <p>桌面与手机共用同一本可信经营账。</p>
          </div>
          <footer>
            <ShieldCheck />
            <span>
              <strong>服务端权限保护</strong>
              <small>库存和账款操作均记录到具体人员</small>
            </span>
          </footer>
        </section>
        <section className="auth-form-panel">
          <div className="auth-mobile-brand">
            <span>YC</span>
            <strong>玉春农机</strong>
          </div>
          <form onSubmit={submit}>
            <span className="auth-form-icon">
              {mode === "setup" ? <Tractor /> : <LockKeyhole />}
            </span>
            <small>{mode === "setup" ? "首次使用 · 初始化" : "欢迎回来"}</small>
            <h2>{mode === "setup" ? "创建经营者账号" : "登录玉春 YC"}</h2>
            <p>
              {mode === "setup"
                ? "该账号拥有系统首版权限，请由老板本人设置。"
                : "登录后继续管理商品、客户和仓库。"}
            </p>
            {mode === "setup" && (
              <label>
                <span>经营者姓名</span>
                <input
                  name="displayName"
                  required
                  maxLength={80}
                  placeholder="如 白老板"
                  autoFocus
                />
              </label>
            )}
            <label>
              <span>登录账号</span>
              <input
                name="username"
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9._\-]+"
                placeholder="如 owner"
                autoFocus={mode === "login"}
                autoComplete="username"
              />
            </label>
            <label>
              <span>登录密码</span>
              <input
                name="password"
                type="password"
                required
                minLength={mode === "setup" ? 10 : 1}
                maxLength={128}
                placeholder={
                  mode === "setup"
                    ? "至少 10 位，请勿使用简单密码"
                    : "请输入密码"
                }
                autoComplete={
                  mode === "setup" ? "new-password" : "current-password"
                }
              />
            </label>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <button disabled={pending}>
              {pending
                ? "正在验证…"
                : mode === "setup"
                  ? "创建账号并进入系统"
                  : "安全登录"}
            </button>
            <footer>玉春 YC · 农机经营管理系统</footer>
          </form>
        </section>
      </main>
    );
  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
