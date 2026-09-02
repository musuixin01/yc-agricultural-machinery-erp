import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { useParties } from "../parties/use-parties";
import { useCashAccounts } from "../payables/use-payables";
import {
  usePostCustomerReceipt,
  useReceivableEntries,
} from "./use-receivables";
import type { CustomerReceipt } from "./receivables-api";

function money(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CreateCustomerReceiptDialog({
  open,
  initialCustomerId,
  onPosted,
  onClose,
}: {
  open: boolean;
  initialCustomerId?: string;
  onPosted?: (receipt: CustomerReceipt) => void;
  onClose: () => void;
}) {
  const customers = useParties("", "CUSTOMER");
  const accounts = useCashAccounts();
  const post = usePostCustomerReceipt();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const entries = useReceivableEntries(customerId);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialCustomerId) setCustomerId(initialCustomerId);
    else if (!customerId && customers.data?.items.length)
      setCustomerId(customers.data.items[0].id);
  }, [customerId, customers.data, initialCustomerId, open]);
  useEffect(() => setAmounts({}), [customerId]);

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
      .map(([receivableEntryId, amount]) => ({ receivableEntryId, amount }));
    setError("");
    if (!allocations.length) return setError("请至少填写一笔收款核销金额。");
    const customer = customers.data?.items.find(
      (item) => item.id === customerId,
    );
    if (
      !window.confirm(
        `确认收到“${customer?.name ?? "该客户"}”付款 ¥${money(total)}？确认后资金和客户欠款会立即正式入账。`,
      )
    )
      return;
    try {
      const receipt = await post.mutateAsync({
        customerId,
        cashAccountId: String(data.get("cashAccountId")),
        businessDate: String(data.get("businessDate")),
        notes: String(data.get("notes") || ""),
        allocations,
      });
      setAmounts({});
      onClose();
      onPosted?.(receipt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "收款失败");
    }
  }

  return (
    <div className="catalog-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="catalog-dialog opening-dialog payment-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>客户欠款 · 收款后立即正式核销</small>
            <h2>登记客户收款</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="catalog-form-row">
            <label>
              <span>付款客户 *</span>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
              >
                {customers.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>收款账户 *</span>
              <select name="cashAccountId" required>
                {accounts.data?.items
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · 当前 ¥{money(item.balance)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="catalog-form-row">
            <label>
              <span>收款日期 *</span>
              <input
                name="businessDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              <span>收款备注</span>
              <input
                name="notes"
                maxLength={500}
                placeholder="可填写微信、现金或经办说明"
              />
            </label>
          </div>
          <div className="payment-allocation-head">
            <strong>选择客户本次偿还的欠款</strong>
            <b>本次实收 ¥{money(total)}</b>
          </div>
          <div className="payment-entry-list">
            {entries.data?.items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.sourceDocument.documentNumber}</strong>
                  <small>
                    销售于{" "}
                    {new Date(item.sourceDocument.soldAt).toLocaleString(
                      "zh-CN",
                    )}{" "}
                    · 到期 {item.dueDate}
                  </small>
                </div>
                <span>未收 ¥{money(item.outstandingAmount)}</span>
                <div className="receipt-amount-control">
                  <input
                    aria-label={`核销 ${item.sourceDocument.documentNumber}`}
                    value={amounts[item.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="本次收款"
                    pattern="\d{1,15}(\.\d{1,4})?"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAmounts((current) => ({
                        ...current,
                        [item.id]: item.outstandingAmount,
                      }))
                    }
                  >
                    全额
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!entries.isLoading && entries.data?.items.length === 0 && (
            <div className="catalog-state">该客户当前没有未结清欠款。</div>
          )}
          {!accounts.data?.items.length && (
            <p className="catalog-form-error">
              请先到供应商付款页面建立资金账户。
            </p>
          )}
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={post.isPending || !accounts.data?.items.length}
            >
              <Check />
              {post.isPending ? "正在正式入账…" : "确认收款并核销"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
