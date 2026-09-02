import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CustomerReceipt } from "./receivables-api";
import { useReverseCustomerReceipt } from "./use-receivables";

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19);
};
const money = (value: string | number) =>
  Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CreateReceiptReversalDialog({
  receipt,
  onClose,
}: {
  receipt: CustomerReceipt | null;
  onClose: () => void;
}) {
  const reverse = useReverseCustomerReceipt();
  const [reversedAt, setReversedAt] = useState(localDateTime());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!receipt) return;
    globalThis.document.body.classList.add("sales-dialog-open");
    return () => globalThis.document.body.classList.remove("sales-dialog-open");
  }, [receipt]);
  useEffect(() => {
    if (!receipt) return;
    setReversedAt(localDateTime());
    setReason("");
    setError("");
  }, [receipt]);

  if (!receipt) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 2)
      return setError("请填写这笔客户收款为什么需要反核销。");
    if (
      !window.confirm(
        `确认反核销收款 ${receipt!.documentNumber}？客户欠款将恢复 ¥${money(receipt!.amount)}，原收款账户同时减少相同金额。`,
      )
    )
      return;
    try {
      await reverse.mutateAsync({
        receipt: receipt!,
        businessDate: reversedAt.slice(0, 10),
        reversedAt: new Date(reversedAt).toISOString(),
        reason: reason.trim(),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "收款反核销失败，请重试。",
      );
    }
  }

  return (
    <div
      className="catalog-dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <form
        className="catalog-dialog receipt-reversal-dialog"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>客户收款更正</small>
            <h2>收款反核销</h2>
          </div>
          <button type="button" aria-label="关闭收款反核销" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="receipt-reversal-body">
          <div className="receipt-reversal-source">
            <ReceiptText />
            <span>
              <small>原收款单</small>
              <strong>{receipt.documentNumber}</strong>
              <small>
                {receipt.customer.name} · {receipt.cashAccount.name}
              </small>
            </span>
            <b>¥{money(receipt.amount)}</b>
          </div>
          <div className="receipt-reversal-warning">
            <AlertTriangle />
            <span>
              <strong>只撤销录错的客户收款</strong>
              <small>客户真实退款或销售退货不能使用本功能。</small>
            </span>
          </div>
          <div className="receipt-reversal-fields">
            <label>
              <span>反核销时间</span>
              <input
                type="datetime-local"
                step="1"
                value={reversedAt}
                onChange={(event) => setReversedAt(event.target.value)}
                required
              />
            </label>
            <label>
              <span>反核销原因</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：收款金额录错、核销错销售单"
                rows={2}
                maxLength={500}
                required
              />
            </label>
          </div>
          <div className="receipt-reversal-effect">
            <ShieldCheck />
            <span>
              <strong>原收款记录和审计历史永久保留</strong>
              <small>
                恢复 {receipt.allocations.length} 笔客户欠款，原账户减少 ¥
                {money(receipt.amount)}。
              </small>
            </span>
          </div>
          {error && <p className="receipt-reversal-error">{error}</p>}
        </div>
        <footer>
          <button
            className="receipt-reversal-cancel"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="receipt-reversal-confirm"
            disabled={reverse.isPending}
          >
            <RotateCcw /> {reverse.isPending ? "正在反核销…" : "确认反核销"}
          </button>
        </footer>
      </form>
    </div>
  );
}
