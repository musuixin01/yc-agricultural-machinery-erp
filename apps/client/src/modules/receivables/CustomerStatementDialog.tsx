import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  Printer,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { useBusinessProfile } from "../administration/use-administration";
import { useParties } from "../parties/use-parties";
import {
  createStatementPng,
  openStatementPrint,
  statementFileName,
  statementMoney,
} from "./customer-statement";
import { useCustomerStatement } from "./use-receivables";

function todayInChina() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

export function CustomerStatementDialog({
  open,
  initialCustomerId,
  onClose,
}: {
  open: boolean;
  initialCustomerId?: string;
  onClose: () => void;
}) {
  const today = todayInChina();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [dateFrom, setDateFrom] = useState(monthStart(today));
  const [dateTo, setDateTo] = useState(today);
  const [busy, setBusy] = useState<"save" | "share" | "">("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const customers = useParties("", "CUSTOMER");
  const statement = useCustomerStatement(customerId, dateFrom, dateTo);
  const profile = useBusinessProfile(open);

  useEffect(() => {
    if (!open) return;
    setCustomerId(initialCustomerId ?? "");
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
  }, [open, initialCustomerId, onClose]);

  if (!open) return null;

  async function makeFile() {
    if (!statement.data) throw new Error("请先选择客户并加载对账单。");
    const blob = await createStatementPng(statement.data, profile.data);
    return new File([blob], statementFileName(statement.data), {
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
      setFeedback("客户对账单图片已保存。手机端通常会进入系统下载目录。");
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
        title: `${statement.data!.customer.name}客户对账单`,
        text: `${statement.data!.customer.name} ${dateFrom} 至 ${dateTo}，期末欠款 ¥${statementMoney(statement.data!.summary.closingBalance)}`,
        files: [file],
      };
      if (!navigator.share || (navigator.canShare && !navigator.canShare(data)))
        throw new Error(
          "当前浏览器不能直接调起微信分享，请先保存图片，再从微信发送。",
        );
      await navigator.share(data);
      setFeedback("已交给系统分享面板处理；手机上可选择微信。 ");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      setError(reason instanceof Error ? reason.message : "分享失败。");
    } finally {
      setBusy("");
    }
  }

  return createPortal(
    <div
      className="customer-statement-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="customer-statement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-statement-title"
      >
        <header className="customer-statement-toolbar">
          <div>
            <span>正式客户欠款流水</span>
            <h2 id="customer-statement-title">客户对账单</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="关闭客户对账单"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="customer-statement-filters">
          <label>
            <span>客户</span>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">请选择需要对账的客户</option>
              {customers.data?.items.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.code}
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
            aria-label="刷新客户对账单"
            disabled={!customerId || statement.isFetching}
            onClick={() => statement.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            刷新
          </button>
        </div>

        <div className="customer-statement-content">
          {!customerId && (
            <div className="customer-statement-state">
              <FileText aria-hidden="true" />
              <strong>先选择客户</strong>
              <span>系统会根据正式销售、退货和收款流水生成对账单。</span>
            </div>
          )}
          {customerId && statement.isLoading && (
            <div className="customer-statement-state" role="status">
              正在核对客户欠款流水…
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
                  <strong>{statement.data.customer.name}</strong>
                  <span>
                    {statement.data.customer.code}
                    {statement.data.customer.phone
                      ? ` · ${statement.data.customer.phone}`
                      : ""}
                  </span>
                </div>
                <small>
                  对账期间 {statement.data.period.dateFrom} 至{" "}
                  {statement.data.period.dateTo}
                </small>
              </section>
              <section className="customer-statement-summary">
                <article>
                  <span>期初欠款</span>
                  <strong>
                    ¥{statementMoney(statement.data.summary.openingBalance)}
                  </strong>
                </article>
                <article>
                  <span>本期增加</span>
                  <strong>
                    ¥{statementMoney(statement.data.summary.increases)}
                  </strong>
                </article>
                <article>
                  <span>本期减少</span>
                  <strong>
                    ¥{statementMoney(statement.data.summary.decreases)}
                  </strong>
                </article>
                <article className="closing">
                  <span>期末欠款</span>
                  <strong>
                    ¥{statementMoney(statement.data.summary.closingBalance)}
                  </strong>
                </article>
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
                        ? `¥${statementMoney(item.increase)}`
                        : "—"}
                    </span>
                    <span data-label="减少">
                      {Number(item.decrease)
                        ? `¥${statementMoney(item.decrease)}`
                        : "—"}
                    </span>
                    <b data-label="结余">¥{statementMoney(item.balance)}</b>
                  </article>
                ))}
                {!statement.data.items.length && (
                  <div className="customer-statement-empty">
                    所选日期内没有客户欠款变动，期初与期末余额保持一致。
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
          <button
            type="button"
            disabled={!statement.data || Boolean(busy)}
            onClick={() => {
              try {
                openStatementPrint(statement.data!, profile.data);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "打印失败。",
                );
              }
            }}
          >
            <Printer aria-hidden="true" />
            打印
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
      </section>
    </div>,
    document.body,
  );
}
