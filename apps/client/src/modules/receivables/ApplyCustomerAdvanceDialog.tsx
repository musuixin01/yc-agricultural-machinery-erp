import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { CustomerAdvance } from "./receivables-api";
import {
  useApplyCustomerAdvance,
  useReceivableEntries,
} from "./use-receivables";

export function ApplyCustomerAdvanceDialog({
  advance,
  onClose,
}: {
  advance: CustomerAdvance | null;
  onClose: () => void;
}) {
  const entries = useReceivableEntries(advance?.customer.id ?? "");
  const apply = useApplyCustomerAdvance();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const total = useMemo(
    () =>
      Object.values(amounts).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [amounts],
  );
  useEffect(() => {
    setAmounts({});
    setError("");
  }, [advance]);
  useLayoutEffect(() => {
    if (!advance) return;
    document.body.classList.add("sales-dialog-open");
    return () => document.body.classList.remove("sales-dialog-open");
  }, [advance]);
  if (!advance) return null;
  const available = Number(advance.balance?.availableAmount ?? 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const allocations = Object.entries(amounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([receivableEntryId, amount]) => ({ receivableEntryId, amount }));
    if (!allocations.length) return setError("请至少填写一笔抵扣金额。");
    if (total > available) return setError("抵扣金额超过预收款可用余额。");
    if (!window.confirm(`确认用预收款抵扣客户欠款 ¥${total.toFixed(2)}？`))
      return;
    try {
      await apply.mutateAsync({
        advance: advance!,
        businessDate: new Date().toISOString().slice(0, 10),
        allocations,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "预收款抵扣失败。");
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
            <small>{advance.documentNumber}</small>
            <h2>预收款抵扣欠款</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <section className="advance-dialog-tip">
            <CheckCircle2 />
            <span>
              {advance.customer.name} · 可用 ¥{available.toFixed(2)}
              ，抵扣不再次收付款
            </span>
          </section>
          <div className="payment-entry-list">
            {entries.data?.items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.sourceDocument.documentNumber}</strong>
                  <small>
                    未收 ¥{Number(item.outstandingAmount).toFixed(2)}
                  </small>
                </div>
                <input
                  value={amounts[item.id] ?? ""}
                  onChange={(event) =>
                    setAmounts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  pattern="\d{1,15}(\.\d{1,4})?"
                  placeholder="抵扣金额"
                />
              </article>
            ))}
          </div>
          {!entries.data?.items.length && (
            <div className="catalog-state">该客户当前没有可抵扣欠款。</div>
          )}
          <div className="advance-apply-total">
            本次抵扣 <strong>¥{total.toFixed(2)}</strong>
          </div>
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={apply.isPending || total <= 0}
            >
              {apply.isPending ? "正在抵扣…" : "确认抵扣"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
