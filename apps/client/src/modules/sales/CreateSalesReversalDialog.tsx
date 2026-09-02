import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { SalesDocument } from "./sales-api";
import { useReverseSales } from "./use-sales";

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

export function CreateSalesReversalDialog({
  document,
  onClose,
}: {
  document: SalesDocument | null;
  onClose: () => void;
}) {
  const reverse = useReverseSales();
  const [reversedAt, setReversedAt] = useState(localDateTime());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!document) return;
    globalThis.document.body.classList.add("sales-dialog-open");
    return () => globalThis.document.body.classList.remove("sales-dialog-open");
  }, [document]);

  useEffect(() => {
    if (!document) return;
    setReversedAt(localDateTime());
    setReason("");
    setError("");
  }, [document]);

  if (!document) return null;
  const businessDate = reversedAt.slice(0, 10);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 2)
      return setError("请填写这张销售单为什么需要冲销。");
    const effect =
      document!.settlementType === "CREDIT"
        ? `撤销客户欠款 ¥${money(document!.totalAmount)}`
        : `从原收款账户退回 ¥${money(document!.totalAmount)}`;
    if (
      !window.confirm(
        `确认冲销错单 ${document!.documentNumber}？将整单商品回库并${effect}，操作后不能直接修改。`,
      )
    )
      return;
    try {
      await reverse.mutateAsync({
        document: document!,
        businessDate,
        reversedAt: new Date(reversedAt).toISOString(),
        reason: reason.trim(),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "销售冲销失败，请重试。",
      );
    }
  }

  return (
    <div
      className="catalog-dialog-backdrop reversal-modal"
      role="presentation"
      onMouseDown={onClose}
    >
      <form
        className="catalog-dialog sales-reversal-dialog"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>错误单据更正</small>
            <h2>销售单冲销</h2>
          </div>
          <button type="button" aria-label="关闭销售冲销" onClick={onClose}>
            <X />
          </button>
        </header>

        <div className="sales-reversal-body">
          <div className="reversal-source-card">
            <RotateCcw />
            <span>
              <small>原销售单</small>
              <strong>{document.documentNumber}</strong>
              <small>
                {document.customer.name} · {document.warehouse.name}
              </small>
            </span>
            <b>¥{money(document.totalAmount)}</b>
          </div>

          <div className="reversal-warning">
            <AlertTriangle />
            <span>
              <strong>仅用于开错或重复的单据</strong>
              <small>客户真实退货请使用“销售退货”。</small>
            </span>
          </div>

          <div className="reversal-form-grid">
            <label>
              <span>冲销时间</span>
              <input
                type="datetime-local"
                step="1"
                value={reversedAt}
                onChange={(event) => setReversedAt(event.target.value)}
                required
              />
            </label>
            <label className="reversal-reason-field">
              <span>冲销原因</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：重复开单、客户或商品录错"
                maxLength={500}
                rows={2}
                required
              />
            </label>
          </div>

          <div className="reversal-effects">
            <ShieldCheck />
            <span>
              <strong>原单和审计记录都会保留</strong>
              <small>
                商品整单回原仓；
                {document.settlementType === "CREDIT"
                  ? "客户欠款同步撤销。"
                  : "销售款从原收款账户退回。"}
              </small>
            </span>
          </div>

          {error && <p className="reversal-error">{error}</p>}
        </div>
        <footer>
          <button
            className="reversal-cancel-button"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="reversal-confirm-button"
            disabled={reverse.isPending}
          >
            <RotateCcw /> {reverse.isPending ? "正在冲销…" : "确认冲销"}
          </button>
        </footer>
      </form>
    </div>
  );
}
