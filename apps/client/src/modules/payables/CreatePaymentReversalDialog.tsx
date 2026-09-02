import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Banknote,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { SupplierPayment } from "./payables-api";
import { useReverseSupplierPayment } from "./use-payables";

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

export function CreatePaymentReversalDialog({
  payment,
  onClose,
}: {
  payment: SupplierPayment | null;
  onClose: () => void;
}) {
  const reverse = useReverseSupplierPayment();
  const [reversedAt, setReversedAt] = useState(localDateTime());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!payment) return;
    globalThis.document.body.classList.add("sales-dialog-open");
    return () => globalThis.document.body.classList.remove("sales-dialog-open");
  }, [payment]);
  useEffect(() => {
    if (!payment) return;
    setReversedAt(localDateTime());
    setReason("");
    setError("");
  }, [payment]);

  if (!payment) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 2)
      return setError("请填写这笔供应商付款为什么需要反核销。");
    if (
      !window.confirm(
        `确认反核销付款 ${payment!.documentNumber}？供应商欠款将恢复 ¥${money(payment!.amount)}，原付款账户同时加回相同金额。`,
      )
    )
      return;
    try {
      await reverse.mutateAsync({
        payment: payment!,
        businessDate: reversedAt.slice(0, 10),
        reversedAt: new Date(reversedAt).toISOString(),
        reason: reason.trim(),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "付款反核销失败，请重试。",
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
            <small>供应商付款更正</small>
            <h2>付款反核销</h2>
          </div>
          <button type="button" aria-label="关闭付款反核销" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="receipt-reversal-body">
          <div className="receipt-reversal-source">
            <Banknote />
            <span>
              <small>原付款单</small>
              <strong>{payment.documentNumber}</strong>
              <small>
                {payment.supplier.name} · {payment.cashAccount.name}
              </small>
            </span>
            <b>¥{money(payment.amount)}</b>
          </div>
          <div className="receipt-reversal-warning">
            <AlertTriangle />
            <span>
              <strong>只撤销录错的供应商付款</strong>
              <small>供应商真实退款或采购退货不能使用本功能。</small>
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
                placeholder="例如：付款金额录错、核销错采购单"
                rows={2}
                maxLength={500}
                required
              />
            </label>
          </div>
          <div className="receipt-reversal-effect">
            <ShieldCheck />
            <span>
              <strong>原付款记录和审计历史永久保留</strong>
              <small>
                恢复 {payment.allocations.length} 笔供应商欠款，原账户加回 ¥
                {money(payment.amount)}。
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
