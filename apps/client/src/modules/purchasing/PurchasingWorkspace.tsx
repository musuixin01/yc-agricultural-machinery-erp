import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  PackageCheck,
  Plus,
  RotateCcw,
  Truck,
  WalletCards,
} from "lucide-react";
import { CreatePurchaseDialog } from "./CreatePurchaseDialog";
import { CreatePurchaseReturnDialog } from "./CreatePurchaseReturnDialog";
import type { PurchaseReceipt } from "./purchasing-api";
import {
  usePayables,
  usePostPurchase,
  usePurchaseReceipts,
  usePurchaseReturns,
  useSubmitPurchase,
} from "./use-purchasing";

const labels = {
  DRAFT: "草稿",
  SUBMITTED: "待过账",
  POSTED: "已入库",
  REVERSED: "已冲销",
  CANCELLED: "已取消",
} as const;

export function PurchasingWorkspace({
  layout,
  onOpenPayables,
}: {
  layout: "desktop" | "mobile";
  onOpenPayables?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [returning, setReturning] = useState<PurchaseReceipt | null>(null);
  const [error, setError] = useState("");
  const receipts = usePurchaseReceipts();
  const payables = usePayables();
  const returns = usePurchaseReturns();
  const submit = useSubmitPurchase();
  const post = usePostPurchase();
  const pending = submit.isPending || post.isPending;
  const payableTotal = useMemo(
    () =>
      payables.data?.items.reduce(
        (sum, item) => sum + Number(item.outstandingAmount),
        0,
      ) ?? 0,
    [payables.data],
  );

  async function run(action: "submit" | "post", receipt: PurchaseReceipt) {
    setError("");
    if (
      action === "post" &&
      !window.confirm(
        "确认货物已经验收？过账会正式增加库存，并记录我们欠供应商的货款，之后不能直接修改。",
      )
    )
      return;
    try {
      if (action === "submit") await submit.mutateAsync(receipt);
      else await post.mutateAsync(receipt);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "操作失败，请刷新后重试",
      );
    }
  }

  return (
    <div className={`purchase-workspace purchase-${layout}`}>
      <section className="purchase-hero">
        <div>
          <span>采购管理 · 实际到货</span>
          <h1>采购入库</h1>
          <p>
            验收供应商到货，过账后增加库存，并记录我们应向供应商支付的货款。
          </p>
        </div>
        <div className="purchase-stats">
          <span>
            <small>采购单</small>
            <strong>{receipts.data?.items.length ?? "—"}</strong>
          </span>
          <span>
            <small>我们欠供应商</small>
            <strong>
              ¥
              {payableTotal.toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus />
          新建采购入库
        </button>
      </section>
      <section className="purchase-flow">
        <span>
          <Truck />
          <b>实际到货</b>
        </span>
        <i>→</i>
        <span>
          <ClipboardCheck />
          <b>提交核对</b>
        </span>
        <i>→</i>
        <span>
          <PackageCheck />
          <b>库存入账</b>
        </span>
        <i>+</i>
        <span>
          <WalletCards />
          <b>我们欠供应商</b>
        </span>
      </section>
      {error && (
        <div className="ledger-error">
          <AlertTriangle />
          {error}
        </div>
      )}
      <div className="purchase-grid">
        <section className="a-panel purchase-panel">
          <header>
            <div>
              <h2>采购入库单</h2>
              <p>草稿不影响库存和欠款</p>
            </div>
            <Truck />
          </header>
          <div className="purchase-list">
            {receipts.data?.items.map((receipt) => (
              <article key={receipt.id}>
                <div>
                  <span
                    className={`ledger-status ${receipt.status.toLowerCase()}`}
                  >
                    {labels[receipt.status]}
                  </span>
                  <strong>{receipt.documentNumber}</strong>
                  <small>
                    {receipt.supplier.name} · {receipt.warehouse.name} ·{" "}
                    {receipt.lines.length} 种商品
                  </small>
                </div>
                <b>
                  ¥
                  {Number(receipt.totalAmount).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </b>
                <footer>
                  {receipt.status === "DRAFT" && (
                    <button
                      disabled={pending}
                      onClick={() => run("submit", receipt)}
                    >
                      提交核对
                    </button>
                  )}
                  {receipt.status === "SUBMITTED" && (
                    <button
                      className="post-button"
                      disabled={pending}
                      onClick={() => run("post", receipt)}
                    >
                      验收入库并过账
                    </button>
                  )}
                  {receipt.status === "POSTED" && (
                    <>
                      <span>{receipt.postedBy?.displayName} 已过账</span>
                      <button
                        className="purchase-return-button"
                        onClick={() => setReturning(receipt)}
                      >
                        <RotateCcw /> 采购退货
                      </button>
                    </>
                  )}
                </footer>
              </article>
            ))}
          </div>
          {!receipts.isLoading && receipts.data?.items.length === 0 && (
            <div className="ledger-empty">
              <Truck />
              <strong>还没有采购入库单</strong>
              <span>按供应商实际到货建立第一张采购单。</span>
              <button onClick={() => setCreating(true)}>现在建立</button>
            </div>
          )}
        </section>
        <section className="a-panel purchase-panel">
          <header>
            <div>
              <h2>我们欠供应商</h2>
              <p>来自已过账采购入库单</p>
            </div>
            <WalletCards />
          </header>
          {onOpenPayables && (
            <button className="purchase-payables-link" onClick={onOpenPayables}>
              去给供应商付款
              <span>→</span>
            </button>
          )}
          <div className="payable-list">
            {payables.data?.items.map((item) => (
              <article key={item.id}>
                <span>{item.supplier.name.slice(0, 1)}</span>
                <div>
                  <strong>{item.supplier.name}</strong>
                  <small>
                    {item.sourceDocument.documentNumber} · 到期 {item.dueDate}
                  </small>
                </div>
                <b>
                  ¥
                  {Number(item.outstandingAmount).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </b>
              </article>
            ))}
          </div>
          {!payables.isLoading && payables.data?.items.length === 0 && (
            <div className="catalog-state">
              采购正式过账后，我们欠供应商的货款将在这里出现。
            </div>
          )}
        </section>
      </div>
      {!!returns.data?.items.length && (
        <section className="a-panel purchase-panel purchase-return-history">
          <header>
            <div>
              <h2>最近采购退货</h2>
              <p>
                累计退货 ¥
                {Number(returns.data.summary.totalAmount).toLocaleString(
                  "zh-CN",
                  { minimumFractionDigits: 2 },
                )}
              </p>
            </div>
            <RotateCcw />
          </header>
          <div>
            {returns.data.items.slice(0, 5).map((item) => (
              <article key={item.id}>
                <span>
                  <strong>{item.documentNumber}</strong>
                  <small>
                    {item.supplier.name} · 原单{" "}
                    {item.sourcePurchaseDocument.documentNumber}
                  </small>
                </span>
                <span>
                  <b>¥{Number(item.totalAmount).toFixed(2)}</b>
                  <small>
                    减应付 ¥{Number(item.payableReduction).toFixed(2)} · 到账 ¥
                    {Number(item.refundAmount).toFixed(2)}
                  </small>
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
      <CreatePurchaseDialog
        open={creating}
        onClose={() => setCreating(false)}
      />
      <CreatePurchaseReturnDialog
        document={returning}
        returns={returns.data?.items ?? []}
        onClose={() => setReturning(null)}
      />
    </div>
  );
}
