import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { CashAccount } from "./payables-api";
import { useCreateCashAccount } from "./use-payables";

export function CreateCashAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateCashAccount();
  const [error, setError] = useState("");
  if (!open) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await create.mutateAsync({
        code: String(data.get("code")),
        name: String(data.get("name")),
        type: data.get("type") as CashAccount["type"],
        openingBalance: String(data.get("openingBalance")),
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    }
  }
  return (
    <div className="catalog-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="catalog-dialog cash-account-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>资金基础资料</small>
            <h2>新增资金账户</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="opening-warning">
            <strong>期初余额会进入资金流水</strong>
            <span>
              请按现金、银行卡或线上账户的实际可用余额填写，保存后不能直接改写历史。
            </span>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>账户编码 *</span>
              <input
                name="code"
                required
                pattern="[A-Z0-9][A-Z0-9_-]{1,31}"
                placeholder="如 CASH-01"
              />
            </label>
            <label>
              <span>账户名称 *</span>
              <input
                name="name"
                required
                maxLength={100}
                placeholder="如 门店现金"
              />
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>账户类型 *</span>
              <select name="type">
                <option value="CASH">现金</option>
                <option value="BANK">银行卡</option>
                <option value="WECHAT">微信</option>
                <option value="ALIPAY">支付宝</option>
                <option value="OTHER">其他</option>
              </select>
            </label>
            <label>
              <span>期初余额 *</span>
              <input
                name="openingBalance"
                defaultValue="0"
                required
                inputMode="decimal"
                pattern="\d{1,15}(\.\d{1,4})?"
              />
            </label>
          </div>
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={create.isPending}>
              {create.isPending ? "正在保存…" : "建立账户"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
