import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useCreateParty } from "./use-parties";
import type { PartyRole } from "./parties-api";
export function CreatePartyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateParty();
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  if (!open) return null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const d = new FormData(e.currentTarget);
    const roles = [
      d.get("customer") && "CUSTOMER",
      d.get("supplier") && "SUPPLIER",
    ].filter(Boolean) as PartyRole[];
    if (!roles.length) {
      setError("请至少选择客户或供应商身份。 ");
      return;
    }
    const contactName = String(d.get("contactName") || "").trim();
    try {
      await create.mutateAsync({
        code: String(d.get("code")),
        name: String(d.get("name")),
        shortName: String(d.get("shortName") || "") || undefined,
        roles,
        taxId: String(d.get("taxId") || "") || undefined,
        creditLimit: String(d.get("creditLimit") || "0"),
        paymentTermsDays: Number(d.get("paymentTermsDays") || 0),
        province: String(d.get("province") || "") || undefined,
        city: String(d.get("city") || "") || undefined,
        address: String(d.get("address") || "") || undefined,
        notes: String(d.get("notes") || "") || undefined,
        contacts: contactName
          ? [
              {
                name: contactName,
                phone: String(d.get("phone") || "") || undefined,
                email: String(d.get("email") || "") || undefined,
                position: String(d.get("position") || "") || undefined,
                isPrimary: true,
              },
            ]
          : undefined,
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存失败，请稍后重试",
      );
    }
  }
  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog party-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-party-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>基础资料</small>
            <h2 id="new-party-title">新增客户或供应商</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>单位编码 *</span>
              <input
                name="code"
                required
                minLength={2}
                maxLength={48}
                placeholder="如 KH-WJG-001"
                autoFocus
              />
            </label>
            <label>
              <span>单位名称 *</span>
              <input
                name="name"
                required
                maxLength={160}
                placeholder="个人客户可填写姓名"
              />
            </label>
          </div>
          <label>
            <span>业务身份 *</span>
            <div className="party-role-checks">
              <label>
                <input type="checkbox" name="customer" defaultChecked />
                客户
              </label>
              <label>
                <input type="checkbox" name="supplier" />
                供应商
              </label>
            </div>
          </label>
          <div className="catalog-form-row">
            <label>
              <span>简称</span>
              <input name="shortName" maxLength={80} />
            </label>
            <label>
              <span>统一社会信用代码</span>
              <input name="taxId" maxLength={32} />
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>信用额度（元）</span>
              <input
                name="creditLimit"
                inputMode="decimal"
                defaultValue="0"
                pattern="\d{1,15}(\.\d{1,4})?"
              />
            </label>
            <label>
              <span>默认账期（天）</span>
              <input
                name="paymentTermsDays"
                type="number"
                min="0"
                max="3650"
                defaultValue="0"
              />
            </label>
          </div>
          <div className="party-form-divider">主要联系人</div>
          <div className="catalog-form-row">
            <label>
              <span>联系人姓名</span>
              <input name="contactName" maxLength={80} />
            </label>
            <label>
              <span>手机号/电话</span>
              <input name="phone" inputMode="tel" maxLength={32} />
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>职位</span>
              <input name="position" maxLength={80} />
            </label>
            <label>
              <span>邮箱</span>
              <input name="email" type="email" maxLength={160} />
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>省份</span>
              <input name="province" maxLength={60} />
            </label>
            <label>
              <span>城市/区县</span>
              <input name="city" maxLength={60} />
            </label>
          </div>
          <label>
            <span>详细地址</span>
            <input name="address" maxLength={240} />
          </label>
          <label>
            <span>备注</span>
            <input name="notes" maxLength={1000} />
          </label>
          {error && (
            <p className="catalog-form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={create.isPending}>
              {create.isPending ? "正在保存…" : "保存往来单位"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
