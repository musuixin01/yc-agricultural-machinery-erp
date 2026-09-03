import { useState, useRef } from "react";
import {
  Printer,
  X,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  FileCheck,
  Building,
  Phone,
  Landmark,
  FileSpreadsheet,
} from "lucide-react";
import { useBusinessProfile } from "../administration/use-administration";
import {
  buildDunningNotice,
  type CustomerAgingSummary,
  type DunningTone,
} from "./receivables-aging";

export function CustomerDunningNoticeDialog({
  summary,
  open,
  onClose,
}: {
  summary: CustomerAgingSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const profileQuery = useBusinessProfile();
  const [tone, setTone] = useState<DunningTone>("FORMAL");
  const [copied, setCopied] = useState(false);
  const [showSeal, setShowSeal] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !summary) return null;

  const notice = buildDunningNotice(summary, profileQuery.data ?? null, tone);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const overdueStr =
      notice.maxOverdueMonths >= 1
        ? `${notice.maxOverdueMonths} 个月 (${notice.maxOverdueDays} 天)`
        : `${notice.maxOverdueDays} 天`;

    const text = [
      `【${notice.letterTitle}】`,
      `致：${notice.customerName}`,
      `发函日期：${notice.noticeDate}`,
      `----------------------------------------`,
      ...notice.letterBody,
      `----------------------------------------`,
      `【未结款项单据明细】：`,
      ...notice.entries.map((e, i) => {
        const itemOverdue =
          e.overdueMonths >= 1
            ? `${e.overdueMonths} 个月 (${e.overdueDays} 天)`
            : `${e.overdueDays} 天`;
        return `${i + 1}. 单号: ${e.documentNumber} | 销售日: ${e.soldAt} | 到期: ${e.dueDate} | 未结: ¥${e.outstandingAmount.toFixed(2)}${e.overdueDays > 0 ? ` [逾期 ${itemOverdue}]` : " [未到期]"}`;
      }),
      `合计应收欠款金额：¥${notice.totalDue.toFixed(2)} 元 (最长逾期: ${overdueStr})`,
      `----------------------------------------`,
      `【官方收款账户及结算说明】：`,
      `开户名称：${notice.companyName}`,
      `开户银行：${notice.bankName}`,
      `银行账号：${notice.bankAccount}`,
      `财务联系电话：${notice.contactPhone} (${notice.contactPerson})`,
      `----------------------------------------`,
      notice.warningNote,
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const overdueDurationLabel =
    notice.maxOverdueMonths >= 1
      ? `${notice.maxOverdueMonths}个月 (${notice.maxOverdueDays}天)`
      : `${notice.maxOverdueDays}天`;

  return (
    <div
      className="catalog-dialog-backdrop print-dialog-backdrop"
      role="presentation"
    >
      <div
        className="catalog-dialog print-dialog-wrapper dunning-dialog-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dunning-dialog-title"
      >
        <header className="print-dialog-header no-print">
          <div className="print-header-left">
            <ShieldAlert className="text-amber-600" size={20} />
            <div>
              <h2 id="dunning-dialog-title" className="print-dialog-heading">
                客户催款对账函生成中心
              </h2>
              <p className="print-dialog-subheading">
                客户：{notice.customerName} · 欠款合计：¥
                {notice.totalDue.toFixed(2)} · 最长逾期 {overdueDurationLabel}
              </p>
            </div>
          </div>
          <div className="print-header-controls">
            {/* Tone Selector */}
            <div className="print-format-segmented">
              <button
                type="button"
                className={`format-tab ${tone === "FRIENDLY" ? "active" : ""}`}
                onClick={() => setTone("FRIENDLY")}
                title="适用于账期刚到或友好常规对账"
              >
                <FileCheck size={14} /> 友好对账
              </button>
              <button
                type="button"
                className={`format-tab ${tone === "FORMAL" ? "active" : ""}`}
                onClick={() => setTone("FORMAL")}
                title="适用于超期款项正式催收"
              >
                <AlertTriangle size={14} /> 正式催款
              </button>
              <button
                type="button"
                className={`format-tab ${tone === "URGENT" ? "active text-red-600 font-bold" : ""}`}
                onClick={() => setTone("URGENT")}
                title="适用于长期呆账法务诉讼警示"
              >
                <ShieldAlert size={14} /> 法务警告
              </button>
            </div>

            <div className="print-options-toggles">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showSeal}
                  onChange={(e) => setShowSeal(e.target.checked)}
                />
                显示印章
              </label>
            </div>

            <button
              type="button"
              className="outline-button print-action-btn"
              onClick={handleCopyText}
              title="复制文本发送给微信或短信"
            >
              {copied ? (
                <Check size={14} className="text-emerald-600" />
              ) : (
                <Copy size={14} />
              )}
              {copied ? "已复制全文" : "复制文字"}
            </button>
            <button
              type="button"
              className="primary-button print-action-btn"
              onClick={handlePrint}
            >
              <Printer size={16} /> 打印发函
            </button>
            <button
              type="button"
              className="outline-button print-close-btn"
              onClick={onClose}
              aria-label="关闭催款函预览"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Printable Viewport */}
        <div className="print-dialog-body" ref={printRef}>
          <div
            className={`document-sheet sheet-a4 dunning-sheet printable-area tone-${tone.toLowerCase()}`}
          >
            {/* Top Header */}
            <div className="sheet-header">
              <div className="sheet-company">
                <h1 className="company-name">{notice.companyName}</h1>
                <span
                  className={`document-title-badge ${tone === "URGENT" ? "badge-urgent" : ""}`}
                >
                  {notice.letterTitle}
                </span>
              </div>
              <div className="dunning-date-box">
                <span>发函日期：{notice.noticeDate}</span>
                <span>
                  编号：催-{notice.noticeDate.replace(/-/g, "")}-
                  {summary.customerCode}
                </span>
              </div>
            </div>

            {/* Letter Body */}
            <div className="dunning-letter-content">
              {notice.letterBody.map((paragraph, index) => (
                <p key={index} className="dunning-p">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Table of Due Invoices */}
            <div className="dunning-invoices-section">
              <h4 className="dunning-section-title">【未清货款单据清单】</h4>
              <table className="sheet-table dunning-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>序号</th>
                    <th>业务单号</th>
                    <th style={{ width: 90 }}>销售日期</th>
                    <th style={{ width: 90 }}>约定到期日</th>
                    <th style={{ width: 90, textAlign: "center" }}>逾期状态</th>
                    <th style={{ width: 110, textAlign: "right" }}>
                      未付金额(元)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notice.entries.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td className="font-mono font-medium">
                        {item.documentNumber}
                      </td>
                      <td>{item.soldAt}</td>
                      <td>{item.dueDate}</td>
                      <td style={{ textAlign: "center" }}>
                        {item.overdueDays > 0 ? (
                          <span className="text-red-600 font-bold">
                            逾期{" "}
                            {item.overdueMonths >= 1
                              ? `${item.overdueMonths}月`
                              : `${item.overdueDays}天`}
                          </span>
                        ) : (
                          <span className="text-slate-500">正常未到期</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        ¥{item.outstandingAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="sheet-total-row">
                    <td
                      colSpan={4}
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      应收账款总额合计：
                    </td>
                    <td
                      colSpan={2}
                      style={{
                        textAlign: "right",
                        fontWeight: 800,
                        fontSize: 15,
                        color: "#b91c1c",
                      }}
                    >
                      ¥{notice.totalDue.toFixed(2)} 元
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bank Accounts & Payment Instructions */}
            <div className="dunning-bank-box">
              <div className="bank-title">
                <Landmark size={15} />{" "}
                官方结算收款账户信息（请汇款后备注单号或客户名称）：
              </div>
              <div className="bank-grid">
                <div>
                  <b>开户名称：</b>
                  {notice.companyName}
                </div>
                <div>
                  <b>开户银行：</b>
                  {notice.bankName}
                </div>
                <div>
                  <b>银行账号：</b>
                  <span className="font-mono font-bold text-blue-900">
                    {notice.bankAccount}
                  </span>
                </div>
                <div>
                  <b>财务电话：</b>
                  {notice.contactPhone} ({notice.contactPerson})
                </div>
              </div>
            </div>

            {/* Warning Note */}
            <div
              className={`dunning-warning-callout ${tone === "URGENT" ? "callout-urgent" : ""}`}
            >
              <AlertTriangle size={15} />
              <span>{notice.warningNote}</span>
            </div>

            {/* Footer with Seal */}
            <div className="sheet-footer dunning-footer">
              <div className="signature-col">
                <span>发函单位：{notice.companyName}</span>
                <span style={{ marginTop: 8, display: "block" }}>
                  财务负责人：_______________
                </span>
              </div>
              <div className="signature-col">
                <span>签收单位（盖章/签字）：_______________</span>
                <span style={{ marginTop: 8, display: "block" }}>
                  签收日期：____年__月__日
                </span>
              </div>
              {showSeal && (
                <div className="sheet-seal-stamp">
                  <div className="seal-circle seal-finance">
                    <span className="seal-org">
                      {notice.companyName.slice(0, 8)}
                    </span>
                    <span className="seal-star">★</span>
                    <span className="seal-type">财务结算章</span>
                  </div>
                </div>
              )}
            </div>

            <div className="sheet-bottom-tip">
              <span>本函一式两份，发函单位与收函单位各执一份。</span>
              <span>打印时间：{new Date().toLocaleString("zh-CN")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
