import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, Share2, ShieldCheck, X } from "lucide-react";
import type { ReceiptPaperSize } from "../administration/administration-api";
import { useBusinessProfile } from "../administration/use-administration";
import {
  financialAccountType,
  financialMoney,
  financialUppercase,
} from "../shared/financial-voucher";
import type { SupplierPayment } from "./payables-api";
import {
  createSupplierPaymentVoucherPng,
  openSupplierPaymentVoucherPrint,
  supplierPaymentVoucherFileName,
} from "./supplier-payment-voucher";

export function SupplierPaymentVoucherDialog({
  payment,
  onClose,
}: {
  payment: SupplierPayment | null;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [paper, setPaper] = useState<ReceiptPaperSize>("A4");
  const [busy, setBusy] = useState<"save" | "share" | "">("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const profile = useBusinessProfile(Boolean(payment));

  useEffect(() => {
    if (profile.data) setPaper(profile.data.defaultPaperSize);
  }, [profile.data]);

  useEffect(() => {
    if (!payment) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.body.classList.add("financial-voucher-open");
    window.setTimeout(() => closeButton.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("financial-voucher-open");
      window.removeEventListener("keydown", onKeyDown);
      returnFocus.current?.focus();
    };
  }, [payment, onClose]);

  if (!payment) return null;

  async function makeFile() {
    const blob = await createSupplierPaymentVoucherPng(payment!, profile.data);
    return new File([blob], supplierPaymentVoucherFileName(payment!), {
      type: "image/png",
    });
  }

  async function saveImage() {
    setBusy("save");
    setFeedback("");
    setError("");
    try {
      const file = await makeFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("付款凭证图片已保存。手机端通常会进入系统下载目录。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存图片失败。");
    } finally {
      setBusy("");
    }
  }

  async function share() {
    setBusy("share");
    setFeedback("");
    setError("");
    try {
      const file = await makeFile();
      const data = {
        title: `${payment!.supplier.name}供应商付款凭证`,
        text: `${payment!.documentNumber}，已付款 ¥${financialMoney(payment!.amount)}`,
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

  return createPortal(
    <div
      className="customer-receipt-voucher-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="customer-receipt-voucher-dialog supplier-payment-voucher-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-payment-voucher-title"
      >
        <header className="customer-receipt-voucher-toolbar">
          <div>
            <span>正式供应商付款记录</span>
            <h2 id="supplier-payment-voucher-title">供应商付款凭证</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="关闭供应商付款凭证"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="customer-receipt-voucher-scroll">
          <article
            className={`customer-receipt-voucher-paper ${paper === "RECEIPT_80MM" ? "paper-80mm" : ""} ${payment.reversal ? "reversed" : ""}`}
          >
            {payment.reversal && (
              <strong className="customer-receipt-voucher-watermark">
                已反核销
              </strong>
            )}
            <header>
              <div>
                <strong>
                  {profile.data?.storeName || "玉春农机"}供应商付款凭证
                </strong>
                <small>
                  {[profile.data?.phone, profile.data?.address]
                    .filter(Boolean)
                    .join(" · ") ||
                    profile.data?.shortName ||
                    "YC"}
                </small>
              </div>
              <span className={payment.reversal ? "reversed" : ""}>
                {payment.reversal ? "已反核销" : "付款已入账"}
              </span>
            </header>
            <section className="customer-receipt-voucher-amount">
              <span>本次实付</span>
              <strong>¥{financialMoney(payment.amount)}</strong>
              <small>人民币（大写）{financialUppercase(payment.amount)}</small>
            </section>
            <dl className="customer-receipt-voucher-meta">
              <div>
                <dt>收款供应商</dt>
                <dd>{payment.supplier.name}</dd>
              </div>
              <div>
                <dt>付款单号</dt>
                <dd>{payment.documentNumber}</dd>
              </div>
              <div>
                <dt>付款方式</dt>
                <dd>
                  {financialAccountType(payment.cashAccount.type)} ·{" "}
                  {payment.cashAccount.name}
                </dd>
              </div>
              <div>
                <dt>付款日期</dt>
                <dd>{payment.businessDate}</dd>
              </div>
              <div>
                <dt>入账时间</dt>
                <dd>
                  {payment.postedAt
                    ? new Date(payment.postedAt).toLocaleString("zh-CN")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>经办人</dt>
                <dd>{payment.postedBy?.displayName || "系统"}</dd>
              </div>
            </dl>
            <section className="customer-receipt-voucher-lines">
              <h3>本次核销明细</h3>
              <div className="heading">
                <span>采购单</span>
                <span>本次核销</span>
              </div>
              {payment.allocations.map((allocation) => (
                <div className="line" key={allocation.id}>
                  <span>
                    <b>
                      {allocation.payableEntry.sourceDocument.documentNumber}
                    </b>
                    <small>到期 {allocation.payableEntry.dueDate}</small>
                  </span>
                  <strong>¥{financialMoney(allocation.amount)}</strong>
                </div>
              ))}
            </section>
            {payment.notes && (
              <p className="customer-receipt-voucher-notes">
                备注：{payment.notes}
              </p>
            )}
            {payment.reversal && (
              <p className="customer-receipt-voucher-reversal">
                <b>该付款已反核销，不能作为有效付款证明。</b>
                <span>
                  {payment.reversal.documentNumber} ·{" "}
                  {payment.reversal.businessDate} · {payment.reversal.reason}
                </span>
              </p>
            )}
            <footer>
              <ShieldCheck aria-hidden="true" />
              <span>
                {profile.data?.receiptFooter || "付款已登记，请及时核对。"}
              </span>
            </footer>
          </article>
        </div>
        <fieldset className="customer-receipt-voucher-format">
          <legend>打印尺寸</legend>
          <label className={paper === "A4" ? "active" : ""}>
            <input
              type="radio"
              name="supplierVoucherPaper"
              checked={paper === "A4"}
              onChange={() => setPaper("A4")}
            />
            A4 凭证
          </label>
          <label className={paper === "RECEIPT_80MM" ? "active" : ""}>
            <input
              type="radio"
              name="supplierVoucherPaper"
              checked={paper === "RECEIPT_80MM"}
              onChange={() => setPaper("RECEIPT_80MM")}
            />
            80mm 小票
          </label>
        </fieldset>
        {(feedback || error) && (
          <p
            className={`customer-receipt-voucher-feedback ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {error || feedback}
          </p>
        )}
        <footer className="customer-receipt-voucher-actions">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              try {
                openSupplierPaymentVoucherPrint(payment, profile.data, paper);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "打印失败。",
                );
              }
            }}
          >
            <Printer aria-hidden="true" /> 打印
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={saveImage}>
            <Download aria-hidden="true" />
            {busy === "save" ? "生成中…" : "保存图片"}
          </button>
          <button
            type="button"
            className="primary"
            disabled={Boolean(busy)}
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
