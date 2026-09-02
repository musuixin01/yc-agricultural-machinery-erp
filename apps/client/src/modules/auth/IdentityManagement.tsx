import { useEffect, useState, type FormEvent } from "react";
import {
  Clock3,
  DatabaseBackup,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Plus,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { CreateUserDialog } from "./CreateUserDialog";
import { useAuth } from "./AuthGate";
import type { AuditEvent, ManagedUser } from "./identity-api";
import {
  useAuditEvents,
  useEmployeeRoles,
  useIdentityMutations,
  useManagedUsers,
} from "./use-identity";
import { BusinessProfileSettings } from "../administration/BusinessProfileSettings";
import { BackupRecoverySettings } from "../administration/BackupRecoverySettings";

export function IdentityManagement({
  layout,
}: {
  layout: "desktop" | "mobile";
}) {
  const auth = useAuth();
  const canManage = auth.user.permissions.includes("identity.manage");
  const canAudit = auth.user.permissions.includes("audit.read");
  const canManageProfile =
    auth.user.roles.includes("OWNER") ||
    auth.user.permissions.includes("administration.manage");
  const [tab, setTab] = useState<"profile" | "backups" | "users" | "audit">(
    () => initialSettingsTab(canManageProfile, canManage, canAudit),
  );
  useEffect(() => {
    const openTab = (event: Event) => {
      const requested = (event as CustomEvent<string>).detail;
      if (requested === "profile" && canManageProfile) setTab("profile");
      if (requested === "backups" && canManageProfile) setTab("backups");
      if (requested === "audit" && canAudit) setTab("audit");
    };
    window.addEventListener("yc-open-settings-tab", openTab);
    return () => window.removeEventListener("yc-open-settings-tab", openTab);
  }, [canAudit, canManageProfile]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [auditResult, setAuditResult] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [notice, setNotice] = useState("");
  const roles = useEmployeeRoles(canManage);
  const users = useManagedUsers(search, status, canManage && tab === "users");
  const audit = useAuditEvents(auditResult, canAudit && tab === "audit");
  const mutations = useIdentityMutations();

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "操作失败，请重试。",
      );
    }
  }

  return (
    <div className={`staff-page staff-page-${layout}`}>
      <section className="staff-hero">
        <div>
          <span>门店资料 · 身份与审计</span>
          <h1>系统设置</h1>
          <p>维护门店资料、数据安全和员工权限。</p>
        </div>
        <div className="staff-current">
          <span>{auth.user.displayName.slice(0, 1)}</span>
          <div>
            <small>当前账号</small>
            <strong>{auth.user.displayName}</strong>
            <em>{auth.user.roles.includes("OWNER") ? "经营者" : "员工"}</em>
          </div>
        </div>
        <button
          className="outline-button staff-logout"
          onClick={() => void auth.logout()}
        >
          <LogOut />
          安全退出
        </button>
      </section>
      {!canManage && !canAudit && !canManageProfile ? (
        <section className="a-panel staff-no-access">
          <ShieldCheck />
          <strong>当前账号没有员工管理权限</strong>
          <p>如需调整岗位或设备会话，请联系经营者。</p>
        </section>
      ) : (
        <section className="a-panel staff-workspace">
          <header className="staff-tabs">
            {canManageProfile && (
              <button
                className={tab === "profile" ? "active" : ""}
                onClick={() => setTab("profile")}
              >
                <Store />
                门店资料
              </button>
            )}
            {canManageProfile && (
              <button
                className={tab === "backups" ? "active" : ""}
                onClick={() => setTab("backups")}
              >
                <DatabaseBackup />
                数据安全
              </button>
            )}
            {canManage && (
              <button
                className={tab === "users" ? "active" : ""}
                onClick={() => setTab("users")}
              >
                <UsersRound />
                员工账号
              </button>
            )}
            {canAudit && (
              <button
                className={tab === "audit" ? "active" : ""}
                onClick={() => setTab("audit")}
              >
                <Clock3 />
                操作审计
              </button>
            )}
            {tab === "users" && canManage && (
              <button
                className="primary-button staff-add"
                onClick={() => setCreating(true)}
              >
                <Plus />
                新增员工
              </button>
            )}
          </header>
          {notice && <div className="staff-notice">{notice}</div>}
          {tab === "profile" && canManageProfile && <BusinessProfileSettings />}
          {tab === "backups" && canManageProfile && <BackupRecoverySettings />}
          {tab === "users" && canManage && (
            <>
              <div className="staff-toolbar">
                <div className="catalog-search-a">
                  <Search />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索员工姓名或登录账号"
                  />
                </div>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">全部状态</option>
                  <option value="ACTIVE">正常</option>
                  <option value="LOCKED">已锁定</option>
                  <option value="INACTIVE">已停用</option>
                </select>
              </div>
              {users.isLoading && (
                <div className="catalog-state">正在加载员工账号…</div>
              )}
              {users.isError && (
                <div className="catalog-state error">员工账号加载失败。</div>
              )}
              <div className="staff-user-grid">
                {users.data?.items.map((user) => (
                  <article
                    key={user.id}
                    className={user.id === auth.user.id ? "is-current" : ""}
                  >
                    <header>
                      <span className="staff-avatar">
                        {user.displayName.slice(0, 1)}
                      </span>
                      <div>
                        <strong>{user.displayName}</strong>
                        <small>@{user.username}</small>
                      </div>
                      <em
                        className={`staff-status ${user.status.toLowerCase()}`}
                      >
                        {user.status === "ACTIVE"
                          ? "正常"
                          : user.status === "LOCKED"
                            ? "已锁定"
                            : "已停用"}
                      </em>
                    </header>
                    <div className="staff-role-list">
                      {user.roles.map((role) => (
                        <span key={role.code}>{role.name}</span>
                      ))}
                    </div>
                    <dl>
                      <div>
                        <dt>最近登录</dt>
                        <dd>{formatTime(user.lastLoginAt)}</dd>
                      </div>
                      <div>
                        <dt>在线设备</dt>
                        <dd>{user.activeSessionCount} 台</dd>
                      </div>
                    </dl>
                    <footer>
                      {user.id === auth.user.id ? (
                        <small>当前登录账号</small>
                      ) : (
                        <>
                          <button onClick={() => setResetting(user)}>
                            <KeyRound />
                            重置密码
                          </button>
                          <button
                            disabled={
                              !user.activeSessionCount ||
                              mutations.revokeSessions.isPending
                            }
                            onClick={() =>
                              void run(
                                () =>
                                  mutations.revokeSessions.mutateAsync(user),
                                "已撤销该员工的全部设备会话。",
                              )
                            }
                          >
                            <MonitorSmartphone />
                            下线设备
                          </button>
                          <button
                            disabled={mutations.setStatus.isPending}
                            onClick={() =>
                              void run(
                                () =>
                                  mutations.setStatus.mutateAsync({
                                    user,
                                    status:
                                      user.status === "INACTIVE"
                                        ? "ACTIVE"
                                        : "INACTIVE",
                                  }),
                                user.status === "INACTIVE"
                                  ? "员工账号已启用。"
                                  : "员工账号已停用并下线。",
                              )
                            }
                          >
                            {user.status === "INACTIVE" ? "启用" : "停用"}
                          </button>
                        </>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
              {users.data?.items.length === 0 && (
                <div className="catalog-state">
                  <strong>没有匹配的员工账号</strong>
                  <br />
                  点击“新增员工”建立独立登录身份。
                </div>
              )}
            </>
          )}
          {tab === "audit" && canAudit && (
            <>
              <div className="staff-toolbar audit-toolbar">
                <div>
                  <strong>关键操作记录</strong>
                  <small>审计记录只能追加，不能在业务界面修改或删除。</small>
                </div>
                <select
                  value={auditResult}
                  onChange={(event) => setAuditResult(event.target.value)}
                >
                  <option value="">全部结果</option>
                  <option value="SUCCESS">成功</option>
                  <option value="FAILURE">失败</option>
                </select>
              </div>
              {audit.isLoading && (
                <div className="catalog-state">正在加载审计记录…</div>
              )}
              <div className="audit-list">
                {audit.data?.items.map((event) => (
                  <AuditRow key={event.id} event={event} />
                ))}
              </div>
              {audit.data?.items.length === 0 && (
                <div className="catalog-state">当前没有审计记录</div>
              )}
            </>
          )}
        </section>
      )}
      <CreateUserDialog
        open={creating}
        roles={roles.data ?? []}
        onClose={() => setCreating(false)}
      />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onSubmit={(password) =>
          resetting
            ? run(
                () =>
                  mutations.resetPassword.mutateAsync({
                    user: resetting,
                    password,
                  }),
                "密码已重置，该员工的旧设备会话均已撤销。",
              ).then(() => setResetting(null))
            : Promise.resolve()
        }
        pending={mutations.resetPassword.isPending}
      />
    </div>
  );
}

function initialSettingsTab(
  canManageProfile: boolean,
  canManage: boolean,
  canAudit: boolean,
): "profile" | "backups" | "users" | "audit" {
  const requested = sessionStorage.getItem("yc-settings-tab");
  sessionStorage.removeItem("yc-settings-tab");
  if (requested === "backups" && canManageProfile) return "backups";
  if (requested === "audit" && canAudit) return "audit";
  if (requested === "profile" && canManageProfile) return "profile";
  return canManageProfile ? "profile" : canManage ? "users" : "audit";
}

function AuditRow({ event }: { event: AuditEvent }) {
  return (
    <article>
      <span className={event.result === "SUCCESS" ? "ok" : "failed"}>
        {event.result === "SUCCESS" ? "成功" : "失败"}
      </span>
      <div>
        <strong>{actionLabel(event.action)}</strong>
        <small>
          {event.actor?.displayName ?? "未知人员"} ·{" "}
          {formatTime(event.createdAt)}
          {event.ipAddress ? ` · ${event.ipAddress}` : ""}
        </small>
      </div>
      <em>{event.entityType}</em>
    </article>
  );
}
function actionLabel(action: string) {
  if (action === "identity.login") return "登录系统";
  if (action === "identity.logout") return "安全退出";
  if (action === "identity.bootstrap_owner") return "初始化经营者账号";
  if (action.includes("/identity/users") && action.startsWith("POST"))
    return action.includes("reset-password")
      ? "重置员工密码"
      : action.includes("revoke-sessions")
        ? "撤销员工设备会话"
        : "新增员工账号";
  if (action.includes("/identity/users") && action.startsWith("PATCH"))
    return "变更员工账号状态";
  if (action.includes("/catalog/")) return "维护商品资料";
  if (action.includes("/parties")) return "维护客户供应商";
  if (action.includes("/warehouses")) return "维护仓库库位";
  return action;
}
function formatTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "尚未登录";
}

function ResetPasswordDialog({
  user,
  onClose,
  onSubmit,
  pending,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  pending: boolean;
}) {
  if (!user) return null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(String(new FormData(event.currentTarget).get("password")));
  }
  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog reset-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>安全操作</small>
            <h2>重置 {user.displayName} 的密码</h2>
          </div>
          <button onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <p className="reset-warning">
            保存后，该员工在所有设备上的现有登录都会立即失效。
          </p>
          <label>
            <span>新密码 *</span>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoFocus
              placeholder="至少 10 位"
            />
          </label>
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={pending}>
              {pending ? "正在重置…" : "确认重置并下线"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
