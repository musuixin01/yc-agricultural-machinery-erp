import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpFromLine, RotateCcw, X } from "lucide-react";
import { useCashAccounts } from "../payables/use-payables";
import type { PurchaseReceipt, PurchaseReturn } from "./purchasing-api";
import { usePostPurchaseReturn } from "./use-purchasing";

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

export function CreatePurchaseReturnDialog({
  document,
  returns,
  onClose,
}: {
  document: PurchaseReceipt | null;
  returns: PurchaseReturn[];
  onClose: () => void;
}) {
  const accounts = useCashAccounts();
  const postReturn = usePostPurchaseReturn();
  const [returnedAt, setReturnedAt] = useState(localDateTime());
  const [cashAccountId, setCashAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const returnedQuantities = useMemo(() => {
    const values = new Map<string, number>();
    returns
      .filter((item) => item.sourcePurchaseDocument.id === document?.id)
      .flatMap((item) => item.lines)
      .forEach((line) =>
        values.set(
          line.sourcePurchaseLineId,
          (values.get(line.sourcePurchaseLineId) ?? 0) + Number(line.quantity),
        ),
      );
    return values;
  }, [document?.id, returns]);
  const lines = useMemo(
    () =>
      document?.lines.map((line) => ({
        ...line,
        returnable: Math.max(
          0,
          Number(line.quantity) - (returnedQuantities.get(line.id) ?? 0),
        ),
      })) ?? [],
    [document?.lines, returnedQuantities],
  );
  const total = lines.reduce(
    (sum, line) =>
      sum + Number(quantities[line.id] || 0) * Number(line.unitPrice),
    0,
  );
  const outstanding = Number(document?.payableEntry?.outstandingAmount ?? 0);
  const payableReduction = Math.min(total, outstanding);
  const refundAmount = Math.max(0, total - payableReduction);

  useEffect(() => {
    if (!document) return;
    setReturnedAt(localDateTime());
    setCashAccountId("");
    setReason("");
    setQuantities({});
    setError("");
  }, [document]);
  useEffect(() => {
    if (refundAmount > 0 && !cashAccountId && accounts.data?.items.length)
      setCashAccountId(
        accounts.data.items.find((item) => item.status === "ACTIVE")?.id ?? "",
      );
  }, [refundAmount, cashAccountId, accounts.data]);
  useLayoutEffect(() => {
    window.document.body.classList.toggle(
      "sales-dialog-open",
      Boolean(document),
    );
    return () => window.document.body.classList.remove("sales-dialog-open");
  }, [document]);

  if (!document) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selected = lines
      .map((line) => ({
        sourcePurchaseLineId: line.id,
        quantity: quantities[line.id] || "0",
        maximum: line.returnable,
      }))
      .filter((line) => Number(line.quantity) > 0);
    if (!selected.length) return setError("请至少填写一件退货商品数量。");
    if (selected.some((line) => Number(line.quantity) > line.maximum))
      return setError("退货数量不能超过原采购剩余可退数量。");
    if (reason.trim().length < 2) return setError("请填写真实退货原因。");
    if (refundAmount > 0 && !cashAccountId)
      return setError("本次供应商需要退款，请选择收款账户。");
    if (
      !window.confirm(
        `确认采购退货 ¥${money(total)}？库存减少，供应商欠款减少 ¥${money(payableReduction)}，实际收回退款 ¥${money(refundAmount)}。`,
      )
    )
      return;
    try {
      await postReturn.mutateAsync({
        sourcePurchaseDocumentId: document!.id,
        businessDate: returnedAt.slice(0, 10),
        returnedAt: new Date(returnedAt).toISOString(),
        cashAccountId: refundAmount > 0 ? cashAccountId : undefined,
        reason: reason.trim(),
        lines: selected.map(({ sourcePurchaseLineId, quantity }) => ({
          sourcePurchaseLineId,
          quantity,
        })),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "采购退货失败，请重试。",
      );
    }
  }

  return (
    <div
      className="catalog-dialog-backdrop return-modal"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="catalog-dialog sales-return-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>关联原单 {document.documentNumber}</span>
            <h2>采购退货</h2>
          </div>
          <button type="button" aria-label="关闭采购退货" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <section className="return-source-summary">
            <RotateCcw />
            <div>
              <strong>{document.supplier.name}</strong>
              <span>
                原采购 ¥{money(document.totalAmount)} ·{" "}
                {document.warehouse.name}
              </span>
            </div>
            <b>退回供应商</b>
          </section>
          <div className="return-line-list">
            {lines.map((line) => (
              <label key={line.id}>
                <span>
                  <strong>{line.product.name}</strong>
                  <small>
                    原购 {Number(line.quantity)}，还可退 {line.returnable}{" "}
                    {line.unitNameSnapshot}
                  </small>
                </span>
                <input
                  value={quantities[line.id] ?? ""}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [line.id]: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  pattern="\d{1,13}(\.\d{1,6})?"
                  placeholder="退货数量"
                  disabled={line.returnable <= 0}
                />
              </label>
            ))}
          </div>
          <div className="return-form-grid">
            <label>
              <span>退货时间 *</span>
              <input
                type="datetime-local"
                step="1"
                value={returnedAt}
                onChange={(event) => setReturnedAt(event.target.value)}
                required
              />
            </label>
            {refundAmount > 0 && (
              <label>
                <span>供应商退款到账账户 *</span>
                <select
                  value={cashAccountId}
                  onChange={(event) => setCashAccountId(event.target.value)}
                  required
                >
                  <option value="">请选择收款账户</option>
                  {accounts.data?.items
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · 余额 ¥{money(item.balance)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="return-reason">
              <span>退货原因 *</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="例如：型号发错、质量问题"
                required
              />
            </label>
          </div>
          <section className="return-settlement-summary">
            <span>
              <small>退货商品总额</small>
              <strong>¥{money(total)}</strong>
            </span>
            <span>
              <small>减少供应商欠款</small>
              <strong>¥{money(payableReduction)}</strong>
            </span>
            <span>
              <small>供应商实际退款</small>
              <strong>¥{money(refundAmount)}</strong>
            </span>
          </section>
          <p className="return-restock-note">
            <ArrowUpFromLine />{" "}
            商品从原仓库出库；库存成本按退货时移动平均成本扣减。
          </p>
          {error && <p className="catalog-form-error">{error}</p>}
          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={postReturn.isPending || total <= 0}
            >
              {postReturn.isPending ? "正在退货过账…" : "确认退货并过账"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
