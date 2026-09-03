import { useEffect, useState, type FormEvent } from "react";
import { X, Building2, User, Phone, ShieldCheck, MapPin } from "lucide-react";
import { useUpdateParty } from "./use-parties";
import type { Party, PartyRole } from "./parties-api";

export function EditPartyDialog({
  party,
  open,
  onClose,
}: {
  party: Party | null;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateParty();
  const [error, setError] = useState("");

  const primaryContact =
    party?.contacts?.find((c) => c.isPrimary) || party?.contacts?.[0];

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  if (!open || !party) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!party) return;
    setError("");

    const d = new FormData(e.currentTarget);
    const roles = [
      d.get("customer") && "CUSTOMER",
      d.get("supplier") && "SUPPLIER",
    ].filter(Boolean) as PartyRole[];

    if (!roles.length) {
      setError("请至少选择客户或供应商身份。");
      return;
    }

    const contactName = String(d.get("contactName") || "").trim();

    try {
      await update.mutateAsync({
        id: party.id,
        input: {
          code: String(d.get("code") || party.code),
          name: String(d.get("name") || party.name),
          shortName: String(d.get("shortName") || "") || undefined,
          roles,
          taxId: String(d.get("taxId") || "") || undefined,
          creditLimit: String(d.get("creditLimit") || "0"),
          paymentTermsDays: Number(d.get("paymentTermsDays") || 0),
          province: String(d.get("province") || "") || undefined,
          city: String(d.get("city") || "") || undefined,
          address: String(d.get("address") || "") || undefined,
          notes: String(d.get("notes") || "") || undefined,
          version: party.version,
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
            : party.contacts,
        },
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存修改失败，请稍后重试",
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
        className="catalog-dialog party-dialog edit-party-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-party-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div className="party-dialog-head-left">
            <span className="party-dialog-badge">
              <Building2 size={16} />
            </span>
            <div>
              <small>档案管理 / 编辑往来单位</small>
              <h2 id="edit-party-title">{party.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="party-form-section-title">
            <Building2 size={14} /> 基本身份与编码
          </div>

          <div className="catalog-form-row">
            <label>
              <span>单位编码 *</span>
              <input
                name="code"
                required
                defaultValue={party.code}
                maxLength={48}
                placeholder="如 KH-0001"
              />
            </label>
            <label>
              <span>单位名称 *</span>
              <input
                name="name"
                required
                defaultValue={party.name}
                maxLength={160}
                placeholder="企业名称或个人姓名"
              />
            </label>
          </div>

          <label>
            <span>业务身份 *</span>
            <div className="party-role-checks">
              <label>
                <input
                  type="checkbox"
                  name="customer"
                  defaultChecked={
                    party.roles?.includes("CUSTOMER") ||
                    (party as any).role === "CUSTOMER"
                  }
                />
                客户
              </label>
              <label>
                <input
                  type="checkbox"
                  name="supplier"
                  defaultChecked={
                    party.roles?.includes("SUPPLIER") ||
                    (party as any).role === "SUPPLIER"
                  }
                />
                供应商
              </label>
            </div>
          </label>

          <div className="catalog-form-row">
            <label>
              <span>简称</span>
              <input
                name="shortName"
                defaultValue={party.shortName || ""}
                maxLength={80}
                placeholder="如 丰收社"
              />
            </label>
            <label>
              <span>统一社会信用代码 / 税号</span>
              <input
                name="taxId"
                defaultValue={party.taxId || ""}
                maxLength={32}
                placeholder="18位纳税人识别号"
              />
            </label>
          </div>

          <div className="party-form-section-title">
            <ShieldCheck size={14} /> 信用风控与账期结算
          </div>

          <div className="catalog-form-row">
            <label>
              <span>信用额度（元）</span>
              <input
                name="creditLimit"
                inputMode="decimal"
                defaultValue={party.creditLimit || "0"}
                pattern="\d{1,15}(\.\d{1,4})?"
                placeholder="0表示不设赊销上限"
              />
            </label>
            <label>
              <span>默认应收/应付账期（天）</span>
              <input
                name="paymentTermsDays"
                type="number"
                min="0"
                max="3650"
                defaultValue={party.paymentTermsDays || 0}
                placeholder="0表示现结"
              />
            </label>
          </div>

          <div className="party-form-section-title">
            <User size={14} /> 联系人与通讯
          </div>

          <div className="catalog-form-row">
            <label>
              <span>联系人姓名</span>
              <input
                name="contactName"
                defaultValue={primaryContact?.name || party.name}
                maxLength={80}
              />
            </label>
            <label>
              <span>手机号 / 电话</span>
              <input
                name="phone"
                inputMode="tel"
                defaultValue={
                  primaryContact?.phone || (party as any).phone || ""
                }
                maxLength={32}
              />
            </label>
          </div>

          <div className="catalog-form-row">
            <label>
              <span>职位</span>
              <input
                name="position"
                defaultValue={primaryContact?.position || ""}
                maxLength={80}
                placeholder="如 经理、厂长、采购主管"
              />
            </label>
            <label>
              <span>电子邮箱</span>
              <input
                name="email"
                type="email"
                defaultValue={primaryContact?.email || ""}
                maxLength={160}
              />
            </label>
          </div>

          <div className="party-form-section-title">
            <MapPin size={14} /> 经营地址与备注
          </div>

          <div className="catalog-form-row">
            <label>
              <span>省份</span>
              <input
                name="province"
                defaultValue={party.province || ""}
                maxLength={60}
              />
            </label>
            <label>
              <span>城市 / 区县</span>
              <input
                name="city"
                defaultValue={party.city || ""}
                maxLength={60}
              />
            </label>
          </div>

          <label>
            <span>详细收发货地址</span>
            <input
              name="address"
              defaultValue={party.address || ""}
              maxLength={240}
              placeholder="乡镇、村庄或街道门牌"
            />
          </label>

          <label>
            <span>业务备注</span>
            <textarea
              name="notes"
              defaultValue={(party as any).notes || ""}
              maxLength={1000}
              rows={2}
              placeholder="开票要求、结算喜好、常备农机型号等"
              className="party-notes-textarea"
            />
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
            <button className="primary-button" disabled={update.isPending}>
              {update.isPending ? "正在保存…" : "保存修改"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
