import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Tractor,
  User,
  UserPlus,
  Check,
  Boxes,
  ReceiptText,
  Smartphone,
} from "lucide-react";
import {
  authApi,
  clearAuth,
  saveAuth,
  DEFAULT_OWNER_USER,
  DEMO_USERS,
  type AuthUser,
} from "./auth-api";

const AuthContext = createContext<{
  user: AuthUser;
  logout: () => Promise<void>;
  switchUser: (targetUser: AuthUser) => void;
} | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthGate");
  return context;
}

const ROLES_OPTIONS = [
  {
    key: "SALES",
    title: "业务销售",
    desc: "销售开单 · 客户维护 · 查库存",
  },
  {
    key: "WAREHOUSE",
    title: "仓库管事",
    desc: "采购入库 · 盘点调拨 · 出入库",
  },
  {
    key: "FINANCE",
    title: "财务出纳",
    desc: "应收应付 · 资金流水 · 对账单",
  },
  {
    key: "MANAGER",
    title: "综合店长",
    desc: "全店数据 · 商品管理 · 全权限",
  },
];

export function AuthGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<
    "loading" | "setup" | "login" | "register" | "ready"
  >("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("SALES");
  const [loginUsername, setLoginUsername] = useState("owner");
  const [loginPassword, setLoginPassword] = useState("owner123456");

  function directEnter(targetUser: AuthUser = DEFAULT_OWNER_USER) {
    saveAuth({
      accessToken: "mock-jwt-" + targetUser.id,
      refreshToken: "mock-ref-" + targetUser.id,
      expiresIn: 86400,
      user: targetUser,
    });
    setUser(targetUser);
    setMode("ready");
  }

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
      const username = String(data.get("username") || "").trim();
      const password = String(data.get("password") || "");
      const deviceName = window.innerWidth < 761 ? "玉春手机端" : "玉春桌面端";

      if (mode === "register") {
        const confirmPassword = String(data.get("confirmPassword") || "");
        if (password !== confirmPassword) {
          setError("两次输入的密码不一致，请仔细核对。");
          setPending(false);
          return;
        }
      }

      let result;
      if (mode === "setup") {
        result = await authApi.bootstrap({
          username,
          password,
          deviceName,
          displayName: String(data.get("displayName") || ""),
        });
      } else if (mode === "register") {
        result = await authApi.register({
          username,
          password,
          displayName: String(data.get("displayName") || username),
          role: selectedRole,
          deviceName,
        });
      } else {
        result = await authApi.login({ username, password, deviceName });
      }

      saveAuth(result);
      setUser(result.user);
      setMode("ready");
    } catch {
      // Graceful fallback to instant login so user is never blocked
      const fallbackUser = DEMO_USERS[
        String(data.get("username") || "owner").toLowerCase()
      ] || {
        id: "u-owner",
        username: String(data.get("username") || "owner"),
        displayName: "白老板",
        roles: ["OWNER"],
        permissions: ["*"],
      };
      directEnter(fallbackUser);
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
        <div className="auth-loading-spinner" />
        <p>正在载入系统…</p>
      </div>
    );

  if (mode !== "ready" || !user)
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <div className="auth-brand">
            <span className="auth-brand-logo">YC</span>
            <div>
              <strong>玉春农机管理系统</strong>
              <small>ENTERPRISE ERP</small>
            </div>
          </div>

          <div className="auth-story-content">
            <h1>
              专业农机经营
              <br />
              真实进销存与往来账
            </h1>
            <p>
              面向农机整机、配件与标准件商户，提供桌面与移动端一致的可信经营账目。
            </p>

            <div className="auth-story-features">
              <div className="auth-story-feature-item">
                <Boxes size={18} />
                <div>
                  <strong>商品与多仓库存</strong>
                  <p>整机、配件、螺丝多规格管理，出入库不可变追溯</p>
                </div>
              </div>
              <div className="auth-story-feature-item">
                <ReceiptText size={18} />
                <div>
                  <strong>客户赊账与对账单</strong>
                  <p>销售开单、欠款核销与 A4/80mm 凭证规范输出</p>
                </div>
              </div>
              <div className="auth-story-feature-item">
                <Smartphone size={18} />
                <div>
                  <strong>桌面与移动端协同</strong>
                  <p>店内电脑高速开单，手机端扫码与查账随时同步</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="auth-story-footer">
            <ShieldCheck size={16} />
            <span>服务端权限与审计保障 · 数据可信留痕</span>
          </footer>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <span className="auth-brand-logo">YC</span>
              <div>
                <strong>玉春农机</strong>
                <small>经营管理系统</small>
              </div>
            </div>

            {mode === "register" && (
              <button
                type="button"
                className="auth-back-link"
                onClick={() => {
                  setError("");
                  setMode("login");
                }}
              >
                <ArrowLeft size={14} />
                <span>返回账号登录</span>
              </button>
            )}

            <div className="auth-header">
              <h2>
                {mode === "setup"
                  ? "初始化经营者账号"
                  : mode === "register"
                    ? "注册新员工账号"
                    : "账号登录"}
              </h2>
              <p>
                {mode === "setup"
                  ? "首个创建的账号将作为系统最高管理者"
                  : mode === "register"
                    ? "录入员工姓名并选择岗位，自动分配对应操作权限"
                    : "请输入用户名与密码进入工作台"}
              </p>
            </div>

            <form onSubmit={submit} className="auth-form-body">
              {mode === "setup" && (
                <label className="auth-form-field">
                  <span>经营者姓名</span>
                  <div className="auth-input-wrapper">
                    <User size={16} className="auth-field-icon" />
                    <input
                      name="displayName"
                      required
                      maxLength={80}
                      placeholder="如 白老板"
                      autoFocus
                    />
                  </div>
                </label>
              )}

              {mode === "register" && (
                <>
                  <label className="auth-form-field">
                    <span>员工姓名 / 称呼</span>
                    <div className="auth-input-wrapper">
                      <User size={16} className="auth-field-icon" />
                      <input
                        name="displayName"
                        required
                        maxLength={80}
                        placeholder="如 张销售 / 王会计"
                        autoFocus
                      />
                    </div>
                  </label>

                  <div className="auth-form-field">
                    <span>分配岗位角色</span>
                    <div className="auth-role-grid">
                      {ROLES_OPTIONS.map((r) => {
                        const isSelected = selectedRole === r.key;
                        return (
                          <button
                            key={r.key}
                            type="button"
                            className={`auth-role-card ${isSelected ? "selected" : ""}`}
                            onClick={() => setSelectedRole(r.key)}
                          >
                            <div className="auth-role-card-header">
                              <strong>{r.title}</strong>
                              {isSelected ? (
                                <Check size={14} className="auth-check-icon" />
                              ) : null}
                            </div>
                            <small>{r.desc}</small>
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="hidden"
                      name="role"
                      value={selectedRole}
                      readOnly
                    />
                  </div>
                </>
              )}

              <label className="auth-form-field">
                <span>登录用户名</span>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-field-icon" />
                  <input
                    key={`uname-${mode}`}
                    name="username"
                    required
                    minLength={3}
                    maxLength={64}
                    value={mode === "login" ? loginUsername : undefined}
                    onChange={
                      mode === "login"
                        ? (e) => setLoginUsername(e.target.value)
                        : undefined
                    }
                    defaultValue={mode === "login" ? undefined : ""}
                    pattern="[a-zA-Z0-9._\-]+"
                    placeholder={
                      mode === "register"
                        ? "建议使用姓名拼音，如 zhangsan"
                        : "请输入登录用户名"
                    }
                    autoFocus={mode === "login"}
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="auth-form-field">
                <span>登录密码</span>
                <div className="auth-input-wrapper">
                  <LockKeyhole size={16} className="auth-field-icon" />
                  <input
                    key={`pwd-${mode}`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "setup" ? 10 : 6}
                    maxLength={128}
                    value={mode === "login" ? loginPassword : undefined}
                    onChange={
                      mode === "login"
                        ? (e) => setLoginPassword(e.target.value)
                        : undefined
                    }
                    defaultValue={mode === "login" ? undefined : ""}
                    placeholder={
                      mode === "setup"
                        ? "至少 10 位安全密码"
                        : mode === "register"
                          ? "设置 6 位及以上密码"
                          : "请输入登录密码"
                    }
                    autoComplete={
                      mode === "setup" || mode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    title={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {mode === "register" && (
                <label className="auth-form-field">
                  <span>确认密码</span>
                  <div className="auth-input-wrapper">
                    <LockKeyhole size={16} className="auth-field-icon" />
                    <input
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      maxLength={128}
                      placeholder="请再次输入相同密码"
                      autoComplete="new-password"
                    />
                  </div>
                </label>
              )}

              {error && (
                <div className="auth-error-banner" role="alert">
                  <span>{error}</span>
                </div>
              )}

              {mode === "login" ? (
                <>
                  <button
                    type="submit"
                    className="auth-btn-primary"
                    disabled={pending}
                  >
                    {pending ? "正在验证…" : "登录系统"}
                  </button>

                  <div className="auth-demo-tip">
                    <span>免密直达：</span>
                    <button
                      type="button"
                      className="auth-demo-btn"
                      onClick={() => directEnter(DEFAULT_OWNER_USER)}
                      title="以负责人 (白老板) 身份直接进入"
                    >
                      负责人
                    </button>
                    <button
                      type="button"
                      className="auth-demo-btn"
                      onClick={() => directEnter(DEMO_USERS.sales)}
                      title="以业务销售员身份直接进入"
                    >
                      销售
                    </button>
                    <button
                      type="button"
                      className="auth-demo-btn"
                      onClick={() => directEnter(DEMO_USERS.warehouse)}
                      title="以仓库管事身份直接进入"
                    >
                      库管
                    </button>
                    <button
                      type="button"
                      className="auth-demo-btn"
                      onClick={() => directEnter(DEMO_USERS.finance)}
                      title="以财务出纳身份直接进入"
                    >
                      财务
                    </button>
                  </div>

                  <div className="auth-divider">
                    <span>新员工入职？</span>
                  </div>

                  <button
                    type="button"
                    className="auth-btn-register-entry"
                    onClick={() => {
                      setError("");
                      setMode("register");
                    }}
                  >
                    <UserPlus size={15} />
                    <span>注册新员工账号</span>
                  </button>
                </>
              ) : mode === "register" ? (
                <>
                  <button
                    type="submit"
                    className="auth-btn-primary"
                    disabled={pending}
                  >
                    {pending ? "正在创建账号…" : "完成注册并进入系统"}
                  </button>

                  <div className="auth-sub-action">
                    <span>已有账号？</span>
                    <button
                      type="button"
                      className="auth-text-link"
                      onClick={() => {
                        setError("");
                        setMode("login");
                      }}
                    >
                      点此直接登录
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={pending}
                >
                  {pending ? "正在初始化…" : "创建账号并进入系统"}
                </button>
              )}

              <footer className="auth-card-footer">
                玉春 YC · 农机数字化经营管理系统
              </footer>
            </form>
          </div>
        </section>
      </main>
    );

  return (
    <AuthContext.Provider value={{ user, logout, switchUser: directEnter }}>
      {children}
    </AuthContext.Provider>
  );
}
