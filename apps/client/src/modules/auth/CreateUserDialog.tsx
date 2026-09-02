import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { EmployeeRole } from "./identity-api";
import { useIdentityMutations } from "./use-identity";

export function CreateUserDialog({
  open,
  roles,
  onClose,
}: {
  open: boolean;
  roles: EmployeeRole[];
  onClose: () => void;
}) {
  const { createUser } = useIdentityMutations();
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  if (!open) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const roleCodes = roles
      .filter((role) => data.get(`role-${role.code}`))
      .map((role) => role.code);
    if (!roleCodes.length) return setError("请至少选择一个岗位角色。");
    try {
      await createUser.mutateAsync({
        username: String(data.get("username")),
        displayName: String(data.get("displayName")),
        password: String(data.get("password")),
        roleCodes,
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试。");
    }
  }
  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog staff-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-user-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>员工与权限</small>
            <h2 id="new-user-title">新增员工账号</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>员工姓名 *</span>
              <input
                name="displayName"
                required
                maxLength={80}
                placeholder="如 王师傅"
                autoFocus
              />
            </label>
            <label>
              <span>登录账号 *</span>
              <input
                name="username"
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9._-]+"
                placeholder="如 xiaowang"
              />
            </label>
          </div>
          <label>
            <span>初始密码 *</span>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              placeholder="至少 10 位，首次交给员工本人"
            />
          </label>
          <div className="party-form-divider">岗位角色（可多选）</div>
          <div className="staff-role-options">
            {roles.map((role) => (
              <label key={role.code}>
                <input type="checkbox" name={`role-${role.code}`} />
                <span>
                  <strong>{role.name}</strong>
                  <small>{role.description}</small>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p className="catalog-form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={createUser.isPending}>
              {createUser.isPending ? "正在创建…" : "创建员工账号"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
