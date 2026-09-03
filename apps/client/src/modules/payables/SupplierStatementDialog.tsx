import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { useBusinessProfile } from "../administration/use-administration";
import { useParties } from "../parties/use-parties";
import { financialMoney } from "../shared/financial-voucher";
import { CreateSupplierPaymentDialog } from "./CreateSupplierPaymentDialog";
import type { SupplierPayment } from "./payables-api";
import {
  createSupplierStatementPng,
  openSupplierStatementPrint,
  supplierStatementFileName,
} from "./supplier-statement";
import { useSupplierStatement } from "./use-payables";

const SupplierPaymentVoucherDialog = lazy(() =>
  import("./SupplierPaymentVoucherDialog").then((module) => ({
    default: module.SupplierPaymentVoucherDialog,
  })),
);

function todayInChina() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

export function SupplierStatementDialog({
  open,
  initialSupplierId,
  onClose,
}: {
  open: boolean;
  initialSupplierId?: string;
  onClose: () => void;
}) {
  const today = todayInChina();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? "");
  const [dateFrom, setDateFrom] = useState(monthStart(today));
  const [dateTo, setDateTo] = useState(today);
  const [busy, setBusy] = useState<"save" | "share" | "">("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voucherPayment, setVoucherPayment] = useState<SupplierPayment | null>(
    null,
  );

  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const suppliers = useParties("", "SUPPLIER");
  const statement = useSupplierStatement(supplierId, dateFrom, dateTo);
  const profile = useBusinessProfile(open);

  useEffect(() => {
    if (!open) return;
    setSupplierId(initialSupplierId ?? "");
    setFeedback("");
    setError("");
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("party-statement-open");
    window.setTimeout(() => closeButton.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("party-statement-open");
      window.removeEventListener("keydown", onKeyDown);
      returnFocus.current?.focus();
    };
  }, [open, initialSupplierId, onClose]);

  if (!open) return null;

  async function makeFile() {
    if (!statement.data) throw new Error("请先选择供应商并加载对账单。");
    const blob = await createSupplierStatementPng(statement.data, profile.data);
    return new File([blob], supplierStatementFileName(statement.data), {
      type: "image/png",
    });
  }

  async function saveImage() {
    setBusy("save");
    setError("");
    setFeedback("");
    try {
      const file = await makeFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("供应商对账单图片已保存。手机端通常会进入系统下载目录。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存图片失败。");
    } finally {
      setBusy("");
    }
  }

  async function share() {
    setBusy("share");
    setError("");
    setFeedback("");
    try {
      const file = await makeFile();
      const data = {
        title: `${statement.data!.supplier.name}供应商对账单`,
        text: `${statement.data!.supplier.name} ${dateFrom} 至 ${dateTo}，期末欠款 ¥${financialMoney(statement.data!.summary.closingBalance)}`,
        files: [file],
      };
      if (!navigator.share || (navigator.canShare && !navigator.canShare(data)))
        throw new Error(
          "当前浏览器不能直接调起微信分享，请先保存图片，再从微信发送。",
        );
      await navigator.share(data);
      setFeedback("已交给系统分享面板处理；手机上可选择微信。");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      setError(reason instanceof Error ? reason.message : "分享失败。");
    } finally {
      setBusy("");
    }
  }

  const closingBalanceNum = Number(statement.data?.summary.closingBalance || 0);

  return createPortal(
    <div
      className="customer-statement-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="customer-statement-dialog supplier-statement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-statement-title"
      >
        <header className="customer-statement-toolbar">
          <div>
            <span>正式供应商欠款流水</span>
            <h2 id="supplier-statement-title">供应商对账单</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="关闭供应商对账单"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="customer-statement-filters">
          <label>
            <span>供应商</span>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">请选择需要对账的供应商</option>
              {suppliers.data?.items.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · {supplier.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>开始日期</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label>
            <span>结束日期</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label="刷新供应商对账单"
            disabled={!supplierId || statement.isFetching}
            onClick={() => statement.refetch()}
          >
            <RefreshCw aria-hidden="true" /> 刷新
          </button>
        </div>

        <div className="customer-statement-content">
          {!supplierId && (
            <div className="customer-statement-state">
              <FileText aria-hidden="true" />
              <strong>先选择供应商</strong>
              <span>系统会根据正式采购、退货和付款流水生成对账单。</span>
            </div>
          )}
          {supplierId && statement.isLoading && (
            <div className="customer-statement-state" role="status">
              正在核对供应商欠款流水…
            </div>
          )}
          {statement.isError && (
            <div className="customer-statement-state error" role="alert">
              <strong>对账单加载失败</strong>
              <span>{statement.error.message}</span>
              <button onClick={() => statement.refetch()}>重新加载</button>
            </div>
          )}
          {statement.data && (
            <>
              <section className="customer-statement-customer">
                <div>
                  <strong>{statement.data.supplier.name}</strong>
                  <span>
                    {statement.data.supplier.code}
                    {statement.data.supplier.phone
                      ? ` · ${statement.data.supplier.phone}`
                      : ""}
                  </span>
                </div>
                <div className="statement-customer-right">
                  <small>
                    对账期间 {statement.data.period.dateFrom} 至{" "}
                    {statement.data.period.dateTo}
                  </small>
                  {closingBalanceNum > 0 && (
                    <button
                      type="button"
                      className="statement-pay-btn"
                      onClick={() => setPaymentOpen(true)}
                    >
                      <Banknote size={14} /> 登记付款核销
                    </button>
                  )}
                </div>
              </section>
              <section className="customer-statement-summary">
                {[
                  ["期初欠款", statement.data.summary.openingBalance],
                  ["本期增加", statement.data.summary.increases],
                  ["本期减少", statement.data.summary.decreases],
                  ["期末欠款", statement.data.summary.closingBalance],
                ].map(([label, value], index) => (
                  <article className={index === 3 ? "closing" : ""} key={label}>
                    <span>{label}</span>
                    <strong>¥{financialMoney(value)}</strong>
                  </article>
                ))}
              </section>
              <section
                className="customer-statement-ledger"
                aria-label="对账明细"
              >
                <div className="heading">
                  <span>日期与业务</span>
                  <span>欠款增加</span>
                  <span>欠款减少</span>
                  <span>结余</span>
                </div>
                {statement.data.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <time>{item.businessDate}</time>
                      <strong>{item.label}</strong>
                      <small>
                        {item.documentNumber}
                        {item.sourceDocumentNumber
                          ? ` · 原单 ${item.sourceDocumentNumber}`
                          : ""}
                      </small>
                    </div>
                    <span data-label="增加">
                      {Number(item.increase)
                        ? `¥${financialMoney(item.increase)}`
                        : "—"}
                    </span>
                    <span data-label="减少">
                      {Number(item.decrease)
                        ? `¥${financialMoney(item.decrease)}`
                        : "—"}
                    </span>
                    <b data-label="结余">¥{financialMoney(item.balance)}</b>
                  </article>
                ))}
                {!statement.data.items.length && (
                  <div className="customer-statement-empty">
                    所选日期内没有供应商欠款变动，期初与期末余额保持一致。
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {(feedback || error) && (
          <p
            className={`customer-statement-feedback ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {error || feedback}
          </p>
        )}
        <footer className="customer-statement-actions">
          {closingBalanceNum > 0 && (
            <button
              type="button"
              className="statement-action-pay"
              onClick={() => setPaymentOpen(true)}
            >
              <Banknote size={15} /> 立即付款结算 (¥
              {financialMoney(statement.data?.summary.closingBalance)})
            </button>
          )}
          <button
            type="button"
            disabled={!statement.data || Boolean(busy)}
            onClick={() => {
              try {
                openSupplierStatementPrint(statement.data!, profile.data);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "打印失败。",
                );
              }
            }}
          >
            <Printer aria-hidden="true" /> 打印
          </button>
          <button
            type="button"
            disabled={!statement.data || Boolean(busy)}
            onClick={saveImage}
          >
            <Download aria-hidden="true" />
            {busy === "save" ? "生成中…" : "保存图片"}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!statement.data || Boolean(busy)}
            onClick={share}
          >
            <Share2 aria-hidden="true" />
            {busy === "share" ? "生成中…" : "分享/微信"}
          </button>
        </footer>

        {paymentOpen && (
          <CreateSupplierPaymentDialog
            open={paymentOpen}
            initialSupplierId={supplierId}
            onClose={() => setPaymentOpen(false)}
            onPosted={(postedPayment) => {
              statement.refetch();
              setVoucherPayment(postedPayment);
            }}
          />
        )}

        {voucherPayment && (
          <Suspense fallback={null}>
            <SupplierPaymentVoucherDialog
              payment={voucherPayment}
              onClose={() => setVoucherPayment(null)}
            />
          </Suspense>
        )}
      </section>
    </div>,
    document.body,
  );
}
