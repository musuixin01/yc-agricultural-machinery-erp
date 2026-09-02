import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { useCashAccounts } from "../payables/use-payables";
import { usePostCashTransfer } from "./use-cash";

export function CreateCashTransferDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const accounts = useCashAccounts();
  const post = usePostCashTransfer();
  const active =
    accounts.data?.items.filter((item) => item.status === "ACTIVE") ?? [];
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || active.length < 2) return;
    if (!active.some((item) => item.id === fromId)) setFromId(active[0].id);
    const nextFrom = active.some((item) => item.id === fromId)
      ? fromId
      : active[0].id;
    if (!active.some((item) => item.id === toId) || toId === nextFrom)
      setToId(active.find((item) => item.id !== nextFrom)?.id ?? "");
  }, [active, fromId, open, toId]);

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
    const from = active.find((item) => item.id === fromId);
    const to = active.find((item) => item.id === toId);
    if (!from || !to) return setError("请先建立至少两个启用中的资金账户。");
    if (fromId === toId) return setError("转出账户和转入账户不能相同。");
    if (Number(amount) > Number(from.balance))
      return setError("转出账户余额不足。");
    if (
      !window.confirm(
        `确认从“${from.name}”转出 ¥${Number(amount).toFixed(2)} 到“${to.name}”？`,
      )
    )
      return;
    setError("");
    try {
      await post.mutateAsync({
        fromCashAccountId: fromId,
        toCashAccountId: toId,
        businessDate: String(data.get("businessDate")),
        amount,
        notes: String(data.get("notes") || ""),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户转账失败。");
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
            <small>资金账户内部调拨</small>
            <h2>账户转账</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <section className="advance-dialog-tip">
            <ArrowRightLeft />
            <span>转出和转入会同时入账，资金总额不变且全程可追溯。</span>
          </section>
          {active.length < 2 ? (
            <p className="catalog-form-error">
              请先建立至少两个启用中的资金账户。
            </p>
          ) : (
            <>
              <div className="catalog-form-row">
                <label>
                  <span>转出账户 *</span>
                  <select
                    value={fromId}
                    onChange={(event) => setFromId(event.target.value)}
                    required
                  >
                    {active.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · ¥{Number(item.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>转入账户 *</span>
                  <select
                    value={toId}
                    onChange={(event) => setToId(event.target.value)}
                    required
                  >
                    {active
                      .filter((item) => item.id !== fromId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="catalog-form-row">
                <label>
                  <span>转账金额 *</span>
                  <input
                    name="amount"
                    inputMode="decimal"
                    pattern="\d{1,15}(\.\d{1,4})?"
                    placeholder="0.00"
                    required
                  />
                </label>
                <label>
                  <span>转账日期 *</span>
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
                  placeholder="例如：现金存入银行卡"
                />
              </label>
            </>
          )}
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={post.isPending || active.length < 2}
            >
              {post.isPending ? "正在入账…" : "确认转账并入账"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
