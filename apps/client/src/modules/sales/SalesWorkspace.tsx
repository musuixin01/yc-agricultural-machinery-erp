import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  ClipboardCheck,
  FileImage,
  PackageMinus,
  Plus,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { CreateSalesDialog } from "./CreateSalesDialog";
import { CreateSalesReversalDialog } from "./CreateSalesReversalDialog";
import { CreateSalesReturnDialog } from "./CreateSalesReturnDialog";
import type { SalesDocument } from "./sales-api";
import {
  usePostSales,
  useReceivables,
  useSalesDocuments,
  useSalesReturns,
  useSubmitSales,
} from "./use-sales";

const labels = {
  DRAFT: "草稿",
  SUBMITTED: "待过账",
  POSTED: "已出库",
  REVERSED: "已冲销",
  CANCELLED: "已取消",
} as const;

const SalesReceiptDialog = lazy(() =>
  import("./SalesReceiptDialog").then((module) => ({
    default: module.SalesReceiptDialog,
  })),
);

function money(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SalesWorkspace({ layout }: { layout: "desktop" | "mobile" }) {
  const [creating, setCreating] = useState(false);
  const [scanFirst, setScanFirst] = useState(false);
  const [returning, setReturning] = useState<SalesDocument | null>(null);
  const [reversing, setReversing] = useState<SalesDocument | null>(null);
  const [receipt, setReceipt] = useState<SalesDocument | null>(null);
  const [error, setError] = useState("");
  const documents = useSalesDocuments();
  const receivables = useReceivables();
  const returns = useSalesReturns();
  const submit = useSubmitSales();
  const post = usePostSales();
  const pending = submit.isPending || post.isPending;
  useEffect(() => {
    const openScanner = () => {
      sessionStorage.removeItem("yc-sales-entry-mode");
      setScanFirst(true);
      setCreating(true);
    };
    if (sessionStorage.getItem("yc-sales-entry-mode") === "scan") openScanner();
    window.addEventListener("yc-open-sales-scan", openScanner);
    return () => window.removeEventListener("yc-open-sales-scan", openScanner);
  }, []);
  const receivableTotal = useMemo(
    () =>
      receivables.data?.items.reduce(
        (sum, item) => sum + Number(item.outstandingAmount),
        0,
      ) ?? 0,
    [receivables.data],
  );
  const postedSales = useMemo(
    () =>
      documents.data?.items
        .filter((item) => item.status === "POSTED")
        .reduce((sum, item) => sum + Number(item.totalAmount), 0) ?? 0,
    [documents.data],
  );

  async function run(action: "submit" | "post", document: SalesDocument) {
    setError("");
    if (
      action === "post" &&
      !window.confirm(
        document.settlementType === "CREDIT"
          ? `确认从“${document.warehouse.name}”出库，并登记客户欠款 ¥${money(document.totalAmount)}？过账后不能直接修改。`
          : `确认从“${document.warehouse.name}”出库，并将现结收款 ¥${money(document.totalAmount)} 记入“${document.cashAccount?.name ?? "门店现金"}”？过账后不能直接修改。`,
      )
    )
      return;
    try {
      if (action === "submit") await submit.mutateAsync(document);
      else await post.mutateAsync(document);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "操作失败，请刷新后重试",
      );
    }
  }

  return (
    <div className={`sales-workspace sales-${layout}`}>
      <section className="sales-hero">
        <div>
          <span>销售管理 · 真实出库</span>
          <h1>销售出库</h1>
          <p>
            普通销售默认散客现结；只有选择赊账客户，过账后才会形成客户欠款。
          </p>
        </div>
        <div className="sales-summary">
          <span>
            <small>已过账销售</small>
            <strong>¥{money(postedSales)}</strong>
          </span>
          <span>
            <small>客户欠款</small>
            <strong>¥{money(receivableTotal)}</strong>
          </span>
          <span>
            <small>销售退货</small>
            <strong>¥{money(returns.data?.summary.totalAmount ?? 0)}</strong>
          </span>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> 新建销售出库
        </button>
      </section>

      <section className="sales-flow" aria-label="销售出库流程">
        <span>
          <ShoppingCart />
          <b>确认成交</b>
        </span>
        <ArrowRight />
        <span>
          <ClipboardCheck />
          <b>提交复核</b>
        </span>
        <ArrowRight />
        <span>
          <PackageMinus />
          <b>库存出库</b>
        </span>
        <ArrowRight />
        <span>
          <ReceiptText />
          <b>现结或记欠款</b>
        </span>
      </section>

      {error && (
        <div className="ledger-error">
          <AlertTriangle />
          {error}
        </div>
      )}

      <div className="sales-grid">
        <section className="a-panel sales-panel">
          <header>
            <div>
              <h2>销售出库单</h2>
              <p>草稿不扣库存，也不会改变客户欠款</p>
            </div>
            <PackageMinus />
          </header>
          <div className="sales-document-list">
            {documents.data?.items.map((document) => (
              <article key={document.id}>
                <div className="sales-document-main">
                  <span
                    className={`ledger-status ${document.status.toLowerCase()}`}
                  >
                    {labels[document.status]}
                  </span>
                  <strong>{document.documentNumber}</strong>
                  <small>
                    {document.customer.name} ·{" "}
                    {document.settlementType === "CREDIT" ? "赊账" : "现结"} ·{" "}
                    {new Date(document.soldAt).toLocaleString("zh-CN", {
                      hour12: false,
                    })}{" "}
                    · {document.warehouse.name} · {document.lines.length} 种商品
                  </small>
                </div>
                <div className="sales-document-amount">
                  <b>¥{money(document.totalAmount)}</b>
                  {document.status === "POSTED" && (
                    <small>毛利 ¥{money(document.grossProfit)}</small>
                  )}
                </div>
                <footer>
                  {document.status === "DRAFT" && (
                    <button
                      disabled={pending}
                      onClick={() => run("submit", document)}
                    >
                      提交复核
                    </button>
                  )}
                  {document.status === "SUBMITTED" && (
                    <button
                      className="post-button"
                      disabled={pending}
                      onClick={() => run("post", document)}
                    >
                      确认出库并过账
                    </button>
                  )}
                  {document.status === "POSTED" && (
                    <>
                      <span>
                        {document.postedBy?.displayName ?? "系统"} 已过账
                      </span>
                      <button
                        className="sales-return-button"
                        onClick={() => setReturning(document)}
                      >
                        <RotateCcw /> 销售退货
                      </button>
                      <button
                        className="sales-reversal-button"
                        onClick={() => setReversing(document)}
                      >
                        <RotateCcw /> 冲销错单
                      </button>
                    </>
                  )}
                  {document.status === "REVERSED" && document.reversal && (
                    <span className="sales-reversed-note">
                      冲销单 {document.reversal.documentNumber} ·{" "}
                      {document.reversal.reason}
                    </span>
                  )}
                  {(document.status === "POSTED" ||
                    document.status === "REVERSED") && (
                    <button
                      className="sales-receipt-button"
                      onClick={() => setReceipt(document)}
                    >
                      <FileImage aria-hidden="true" /> 打印/分享
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
          {!documents.isLoading && documents.data?.items.length === 0 && (
            <div className="ledger-empty">
              <ShoppingCart />
              <strong>还没有销售出库单</strong>
              <span>从有库存的商品建立第一张真实销售单。</span>
              <button onClick={() => setCreating(true)}>立即开单</button>
            </div>
          )}
          {!!returns.data?.items.length && (
            <div className="sales-return-history">
              <h3>最近销售退货</h3>
              {returns.data.items.slice(0, 5).map((item) => (
                <article key={item.id}>
                  <RotateCcw />
                  <span>
                    <strong>{item.documentNumber}</strong>
                    <small>
                      原单 {item.sourceSalesDocument.documentNumber} ·{" "}
                      {item.customer.name}
                    </small>
                    <small>
                      减少欠款 ¥{money(item.receivableReduction)} · 实际退款 ¥
                      {money(item.refundAmount)}
                    </small>
                  </span>
                  <b>退货 ¥{money(item.totalAmount)}</b>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="a-panel sales-panel">
          <header>
            <div>
              <h2>客户欠款</h2>
              <p>仅显示赊账销售；现结销售不会进入这里</p>
            </div>
            <BadgeDollarSign />
          </header>
          <div className="receivable-list">
            {receivables.data?.items.map((item) => {
              const customerName =
                item.sourceDocument.customerNameSnapshot || item.customer.name;
              return (
                <article key={item.id}>
                  <span>{customerName.slice(0, 1)}</span>
                  <div>
                    <strong>{customerName}</strong>
                    <small>
                      {item.sourceDocument.documentNumber} · 到期 {item.dueDate}
                    </small>
                  </div>
                  <b>¥{money(item.outstandingAmount)}</b>
                </article>
              );
            })}
          </div>
          {!receivables.isLoading && receivables.data?.items.length === 0 && (
            <div className="sales-empty-side">
              <Boxes />
              <span>只有选择“客户赊账”并正式过账，欠款才会出现在这里。</span>
            </div>
          )}
        </section>
      </div>
      <CreateSalesDialog
        open={creating}
        scanFirst={scanFirst}
        onClose={() => {
          setCreating(false);
          setScanFirst(false);
        }}
      />
      <CreateSalesReturnDialog
        document={returning}
        returns={returns.data?.items ?? []}
        onClose={() => setReturning(null)}
      />
      <CreateSalesReversalDialog
        document={reversing}
        onClose={() => setReversing(null)}
      />
      {receipt && (
        <Suspense
          fallback={
            <div className="sales-receipt-scrim" role="status">
              <div className="sales-receipt-loading">正在生成销售单预览…</div>
            </div>
          }
        >
          <SalesReceiptDialog
            document={receipt}
            onClose={() => setReceipt(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
