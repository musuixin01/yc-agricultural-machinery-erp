import { useEffect, useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useParties } from "../parties/use-parties";
import {
  useCashAccounts,
  useCreateSupplierPayment,
  usePayableEntries,
} from "./use-payables";

export function CreateSupplierPaymentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const suppliers = useParties("", "SUPPLIER");
  const accounts = useCashAccounts();
  const create = useCreateSupplierPayment();
  const [supplierId, setSupplierId] = useState("");
  const entries = usePayableEntries(supplierId);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (open && !supplierId && suppliers.data?.items.length)
      setSupplierId(suppliers.data.items[0].id);
  }, [open, supplierId, suppliers.data]);
  useEffect(() => setAmounts({}), [supplierId]);
  const total = useMemo(
    () =>
      Object.values(amounts).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [amounts],
  );
  if (!open) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const allocations = Object.entries(amounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([payableEntryId, amount]) => ({ payableEntryId, amount }));
    setError("");
    if (!allocations.length) return setError("请至少填写一笔核销金额。");
    try {
      await create.mutateAsync({
        supplierId,
        cashAccountId: String(data.get("cashAccountId")),
        businessDate: String(data.get("businessDate")),
        allocations,
      });
      setAmounts({});
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    }
  }
  return (
    <div className="catalog-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="catalog-dialog opening-dialog payment-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>供应商付款与指定核销</small>
            <h2>登记给供应商付款</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>供应商 *</span>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
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
                      {item.name} · 可用 ¥
                      {Number(item.balance).toLocaleString("zh-CN")}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label>
            <span>付款日期 *</span>
            <input
              name="businessDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <div className="payment-allocation-head">
            <strong>选择要偿还的采购欠款</strong>
            <b>
              本次付款 ¥
              {total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </b>
          </div>
          <div className="payment-entry-list">
            {entries.data?.items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.sourceDocument.documentNumber}</strong>
                  <small>
                    {item.supplier.name} · 到期 {item.dueDate}
                  </small>
                </div>
                <span>
                  未付 ¥
                  {Number(item.outstandingAmount).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <input
                  aria-label={`核销 ${item.sourceDocument.documentNumber}`}
                  value={amounts[item.id] ?? ""}
                  onChange={(e) =>
                    setAmounts((current) => ({
                      ...current,
                      [item.id]: e.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="核销金额"
                  pattern="\d{1,15}(\.\d{1,4})?"
                />
              </article>
            ))}
          </div>
          {entries.data?.items.length === 0 && (
            <div className="catalog-state">该供应商没有待付款采购欠款。</div>
          )}
          {accounts.data?.items.length === 0 && (
            <p className="catalog-form-error">请先建立资金账户。</p>
          )}
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={create.isPending || !accounts.data?.items.length}
            >
              {create.isPending ? "正在保存…" : "保存给供应商付款草稿"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
