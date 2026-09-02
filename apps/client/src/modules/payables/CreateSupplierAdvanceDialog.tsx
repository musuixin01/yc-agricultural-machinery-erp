import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { HandCoins, X } from "lucide-react";
import { useParties } from "../parties/use-parties";
import { useCashAccounts, usePostSupplierAdvance } from "./use-payables";

export function CreateSupplierAdvanceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const suppliers = useParties("", "SUPPLIER");
  const accounts = useCashAccounts();
  const post = usePostSupplierAdvance();
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (open && !supplierId && suppliers.data?.items.length)
      setSupplierId(suppliers.data.items[0].id);
  }, [open, supplierId, suppliers.data]);
  useLayoutEffect(() => {
    if (!open) return;
    document.body.classList.add("sales-dialog-open");
    return () => document.body.classList.remove("sales-dialog-open");
  }, [open]);
  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = String(data.get("amount"));
    const accountId = String(data.get("cashAccountId"));
    if (
      !window.confirm(
        `确认预付供应商 ¥${Number(amount).toFixed(2)}？资金会立即从所选账户扣除，但不会形成负应付。`,
      )
    )
      return;
    setError("");
    try {
      await post.mutateAsync({
        supplierId,
        cashAccountId: accountId,
        businessDate: String(data.get("businessDate")),
        amount,
        notes: String(data.get("notes") || ""),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "预付款登记失败。");
    }
  }

  return (
    <div className="catalog-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="catalog-dialog opening-dialog payment-dialog advance-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>采购前先付款</small>
            <h2>供应商预付款</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <section className="advance-dialog-tip">
            <HandCoins />
            <span>预付款单独保存，采购形成欠款后再选择抵扣。</span>
          </section>
          <div className="catalog-form-row">
            <label>
              <span>供应商 *</span>
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                required
              >
                {suppliers.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>付款账户 *</span>
              <select name="cashAccountId" required>
                {accounts.data?.items
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · ¥{Number(item.balance).toFixed(2)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>预付金额 *</span>
              <input
                name="amount"
                inputMode="decimal"
                pattern="\d{1,15}(\.\d{1,4})?"
                placeholder="0.00"
                required
              />
            </label>
            <label>
              <span>付款日期 *</span>
              <input
                name="businessDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
          </div>
          <label>
            <span>备注</span>
            <input
              name="notes"
              maxLength={500}
              placeholder="例如：订货预付款"
            />
          </label>
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" disabled={post.isPending}>
              {post.isPending ? "正在入账…" : "确认预付并入账"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
