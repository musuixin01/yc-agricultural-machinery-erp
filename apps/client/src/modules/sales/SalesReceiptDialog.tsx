import { useEffect, useRef, useState } from "react";
import {
  Download,
  Printer,
  ReceiptText,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import type { SalesDocument } from "./sales-api";
import type { ReceiptPaperSize } from "../administration/administration-api";
import { useBusinessProfile } from "../administration/use-administration";
import {
  createReceiptPng,
  openReceiptPrint,
  receiptCustomerName,
  receiptFileName,
  receiptMoney,
  receiptSettlement,
  receiptSoldAt,
  receiptStatus,
} from "./sales-receipt";

export function SalesReceiptDialog({
  document,
  onClose,
}: {
  document: SalesDocument | null;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState<"save" | "share" | "">("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [paper, setPaper] = useState<ReceiptPaperSize>("A4");
  const profile = useBusinessProfile(Boolean(document));

  useEffect(() => {
    if (profile.data) setPaper(profile.data.defaultPaperSize);
  }, [profile.data]);

  useEffect(() => {
    if (!document) return;
    returnFocus.current = globalThis.document
      .activeElement as HTMLElement | null;
    globalThis.document.body.classList.add("sales-dialog-open");
    window.setTimeout(() => closeButton.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.document.body.classList.remove("sales-dialog-open");
      window.removeEventListener("keydown", onKeyDown);
      returnFocus.current?.focus();
    };
  }, [document, onClose]);

  if (!document) return null;

  async function makeFile() {
    const blob = await createReceiptPng(document!, profile.data);
    return new File([blob], receiptFileName(document!), { type: "image/png" });
  }

  async function saveImage() {
    setError("");
    setFeedback("");
    setBusy("save");
    try {
      const file = await makeFile();
      const url = URL.createObjectURL(file);
      const link = globalThis.document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("销售单图片已保存。手机端通常会进入系统下载目录。");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存图片失败，请重试。",
      );
    } finally {
      setBusy("");
    }
  }

  async function shareReceipt() {
    setError("");
    setFeedback("");
    setBusy("share");
    try {
      const file = await makeFile();
      const data = {
        title: `玉春销售单 ${document!.documentNumber}`,
        text: `玉春销售单 ${document!.documentNumber}，金额 ¥${receiptMoney(document!.totalAmount)}`,
        files: [file],
      };
      if (!navigator.share || (navigator.canShare && !navigator.canShare(data)))
        throw new Error(
          "当前浏览器不能直接调起微信分享，请先保存图片，再从微信发送该图片。",
        );
      await navigator.share(data);
      setFeedback("已交给系统分享面板处理；可在手机上选择微信。 ");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      setError(
        reason instanceof Error ? reason.message : "分享失败，请改用保存图片。",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className="sales-receipt-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="sales-receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-receipt-title"
      >
        <header className="sales-receipt-toolbar">
          <div>
            <span>正式销售凭证</span>
            <h2 id="sales-receipt-title">销售单预览</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="关闭销售单预览"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="sales-receipt-scroll">
          <article
            className={`sales-receipt-paper ${paper === "RECEIPT_80MM" ? "paper-80mm" : ""} ${document.status === "REVERSED" ? "reversed" : ""}`}
          >
            {document.status === "REVERSED" && (
              <strong className="sales-receipt-watermark">已冲销</strong>
            )}
            <header>
              <div>
                <ReceiptText aria-hidden="true" />
                <span>
                  <h3>{profile.data?.storeName ?? "玉春农机"}销售单</h3>
                  <small>
                    {profile.data?.shortName ?? "YC"} Agricultural Machinery
                  </small>
                  {(profile.data?.phone || profile.data?.address) && (
                    <em>
                      {[profile.data.phone, profile.data.address]
                        .filter(Boolean)
                        .join(" · ")}
                    </em>
                  )}
                </span>
              </div>
              <b>{receiptStatus(document)}</b>
            </header>
            <dl className="sales-receipt-meta">
              <div>
                <dt>销售单号</dt>
                <dd>{document.documentNumber}</dd>
              </div>
              <div>
                <dt>销售时间</dt>
                <dd>{receiptSoldAt(document)}</dd>
              </div>
              <div>
                <dt>客户</dt>
                <dd>{receiptCustomerName(document)}</dd>
              </div>
              <div>
                <dt>结算方式</dt>
                <dd>{receiptSettlement(document)}</dd>
              </div>
              <div>
                <dt>联系电话</dt>
                <dd>{document.customerPhoneSnapshot || "—"}</dd>
              </div>
              <div>
                <dt>约定付款</dt>
                <dd>
                  {document.settlementType === "CREDIT"
                    ? document.dueDate
                    : "已现结"}
                </dd>
              </div>
            </dl>
            <div className="sales-receipt-lines">
              <div className="sales-receipt-line heading">
                <span>商品</span>
                <span>数量</span>
                <span>单价</span>
                <span>金额</span>
              </div>
              {document.lines.map((line) => (
                <div className="sales-receipt-line" key={line.id}>
                  <span>
                    <b>{line.product.name}</b>
                    <small>{line.product.code}</small>
                  </span>
                  <span>
                    {line.quantity} {line.unitNameSnapshot}
                  </span>
                  <span>¥{receiptMoney(line.unitPrice)}</span>
                  <span>¥{receiptMoney(line.lineAmount)}</span>
                </div>
              ))}
            </div>
            <div className="sales-receipt-total">
              <span>销售总额</span>
              <strong>¥{receiptMoney(document.totalAmount)}</strong>
              {document.settlementType === "CREDIT" && (
                <small>
                  当前原单欠款 ¥
                  {receiptMoney(
                    document.receivableEntry?.outstandingAmount ??
                      document.totalAmount,
                  )}
                </small>
              )}
            </div>
            <p className="sales-receipt-notice">
              <ShieldCheck aria-hidden="true" />
              {profile.data?.receiptFooter || "请当面核对商品、数量和金额。"}
              本单据不是增值税发票。
            </p>
            <footer>
              <span>出库：{document.warehouse.name}</span>
              <span>经办：{document.postedBy?.displayName ?? "系统"}</span>
            </footer>
          </article>
        </div>

        <fieldset className="sales-receipt-format">
          <legend>本次打印尺寸</legend>
          <label className={paper === "A4" ? "active" : ""}>
            <input
              type="radio"
              name="receiptPaper"
              checked={paper === "A4"}
              onChange={() => setPaper("A4")}
            />
            A4 销售单
          </label>
          <label className={paper === "RECEIPT_80MM" ? "active" : ""}>
            <input
              type="radio"
              name="receiptPaper"
              checked={paper === "RECEIPT_80MM"}
              onChange={() => setPaper("RECEIPT_80MM")}
            />
            80mm 小票
          </label>
        </fieldset>

        {(error || feedback) && (
          <p
            className={
              error ? "sales-receipt-feedback error" : "sales-receipt-feedback"
            }
            role={error ? "alert" : "status"}
          >
            {error || feedback}
          </p>
        )}
        <footer className="sales-receipt-actions">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setError("");
              try {
                openReceiptPrint(document, profile.data, paper);
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "无法打开打印窗口。",
                );
              }
            }}
          >
            <Printer aria-hidden="true" />
            打印
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={saveImage}>
            <Download aria-hidden="true" />
            {busy === "save" ? "正在生成…" : "保存图片"}
          </button>
          <button
            className="primary"
            type="button"
            disabled={Boolean(busy)}
            onClick={shareReceipt}
          >
            <Share2 aria-hidden="true" />
            {busy === "share" ? "正在生成…" : "分享/微信"}
          </button>
        </footer>
      </section>
    </div>
  );
}
