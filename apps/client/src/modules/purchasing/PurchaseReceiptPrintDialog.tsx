import { useState, useRef } from "react";
import {
  Printer,
  X,
  FileText,
  Sliders,
  CheckCircle2,
  Phone,
  MapPin,
  Barcode,
  Building,
  Layers,
} from "lucide-react";
import type { PurchaseReceipt } from "./purchasing-api";
import { useBusinessProfile } from "../administration/use-administration";
import {
  buildPurchaseReceiptPrintModel,
  type PrintFormat,
} from "./purchase-receipt-print";

export function PurchaseReceiptPrintDialog({
  receipt,
  open,
  onClose,
}: {
  receipt: PurchaseReceipt | null;
  open: boolean;
  onClose: () => void;
}) {
  const profileQuery = useBusinessProfile();
  const [format, setFormat] = useState<PrintFormat>("A4");
  const [showSeal, setShowSeal] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !receipt) return null;

  const model = buildPurchaseReceiptPrintModel(
    receipt,
    profileQuery.data ?? null,
    format,
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="catalog-dialog-backdrop print-dialog-backdrop"
      role="presentation"
    >
      <div
        className="catalog-dialog print-dialog-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-dialog-title"
      >
        <header className="print-dialog-header no-print">
          <div className="print-header-left">
            <Printer className="text-blue-600" size={20} />
            <div>
              <h2 id="print-dialog-title" className="print-dialog-heading">
                采购入库单凭证打印中心
              </h2>
              <p className="print-dialog-subheading">
                单号：{model.documentNumber} · 供应商：{model.supplierName}
              </p>
            </div>
          </div>
          <div className="print-header-controls">
            {/* Format Toggle */}
            <div className="print-format-segmented">
              <button
                type="button"
                className={`format-tab ${format === "A4" ? "active" : ""}`}
                onClick={() => setFormat("A4")}
              >
                <FileText size={14} /> A4标准单
              </button>
              <button
                type="button"
                className={`format-tab ${format === "TRIPLICATE" ? "active" : ""}`}
                onClick={() => setFormat("TRIPLICATE")}
              >
                <Layers size={14} /> 针打三联单
              </button>
              <button
                type="button"
                className={`format-tab ${format === "THERMAL_80" ? "active" : ""}`}
                onClick={() => setFormat("THERMAL_80")}
              >
                <Sliders size={14} /> 80mm小票
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
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => setShowBarcode(e.target.checked)}
                />
                条形码
              </label>
            </div>

            <button
              type="button"
              className="primary-button print-action-btn"
              onClick={handlePrint}
            >
              <Printer size={16} /> 立即打印
            </button>
            <button
              type="button"
              className="outline-button print-close-btn"
              onClick={onClose}
              aria-label="关闭打印预览"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Printable Viewport */}
        <div className="print-dialog-body" ref={printRef}>
          {format === "A4" && (
            <div className="document-sheet sheet-a4 printable-area">
              {/* Top Header */}
              <div className="sheet-header">
                <div className="sheet-company">
                  <h1 className="company-name">{model.companyName}</h1>
                  <span className="document-title-badge">
                    采 购 入 库 验 收 单
                  </span>
                </div>
                {showBarcode && (
                  <div className="sheet-barcode-box">
                    <div className="barcode-bars" />
                    <span className="barcode-text">{model.documentNumber}</span>
                  </div>
                )}
              </div>

              {/* Meta Info Grid */}
              <div className="sheet-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">供货单位：</span>
                  <span className="meta-value font-bold">
                    {model.supplierName}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">入库仓库：</span>
                  <span className="meta-value">{model.warehouseName}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">业务日期：</span>
                  <span className="meta-value">{model.businessDate}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">入库单号：</span>
                  <span className="meta-value font-mono">
                    {model.documentNumber}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">经手制单：</span>
                  <span className="meta-value">{model.postedByName}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">联系电话：</span>
                  <span className="meta-value">
                    {model.supplierPhone || model.contactPhone}
                  </span>
                </div>
              </div>

              {/* Table */}
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>序号</th>
                    <th style={{ width: 100 }}>商品编码</th>
                    <th>品名规格</th>
                    <th style={{ width: 60, textAlign: "center" }}>单位</th>
                    <th style={{ width: 80, textAlign: "right" }}>入库数量</th>
                    <th style={{ width: 90, textAlign: "right" }}>
                      含税进价(元)
                    </th>
                    <th style={{ width: 100, textAlign: "right" }}>
                      金额小计(元)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ textAlign: "center" }}>{l.index}</td>
                      <td className="font-mono">{l.productCode}</td>
                      <td className="font-medium">{l.productName}</td>
                      <td style={{ textAlign: "center" }}>{l.unitName}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {l.quantity}
                      </td>
                      <td style={{ textAlign: "right" }}>¥{l.unitPrice}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        ¥{l.lineAmount}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="sheet-total-row">
                    <td
                      colSpan={4}
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      合计金额（大写）：{model.totalAmountChinese}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {model.totalQuantity}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      总计:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      ¥{model.totalAmount}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes */}
              {showNotes && model.notes && (
                <div className="sheet-notes">
                  <span className="notes-label">备注说明：</span>
                  <span>{model.notes}</span>
                </div>
              )}

              {/* Signatures & Seal */}
              <div className="sheet-footer">
                <div className="signature-col">
                  <span>供货方送货人签字：_______________</span>
                </div>
                <div className="signature-col">
                  <span>仓库验收员签字：_______________</span>
                </div>
                <div className="signature-col">
                  <span>财务主管复核：_______________</span>
                </div>
                {showSeal && (
                  <div className="sheet-seal-stamp">
                    <div className="seal-circle">
                      <span className="seal-org">
                        {model.companyName.slice(0, 8)}
                      </span>
                      <span className="seal-star">★</span>
                      <span className="seal-type">采购验收章</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="sheet-bottom-tip">
                <span>
                  注：白联-财务记账联；红联-仓库留存联；黄联-供应商结算联。
                </span>
                <span>打印时间：{new Date().toLocaleString("zh-CN")}</span>
              </div>
            </div>
          )}

          {format === "TRIPLICATE" && (
            <div className="document-sheet sheet-triplicate printable-area">
              <div className="triplicate-paper-cut">
                {/* Visual indicator of 3 plies */}
                <div className="triplicate-copy-tags no-print">
                  <span className="copy-badge c-white">
                    第一联：存根联 (白)
                  </span>
                  <span className="copy-badge c-pink">
                    第二联：客户/供应商联 (红)
                  </span>
                  <span className="copy-badge c-yellow">
                    第三联：财务记账联 (黄)
                  </span>
                </div>

                <div className="triplicate-inner">
                  <div className="triplicate-title-row">
                    <span className="triplicate-code font-mono">
                      {model.documentNumber}
                    </span>
                    <h2 className="triplicate-title">
                      {model.companyName} 采购入库单
                    </h2>
                    <span className="triplicate-ply-name">
                      【 第一联：存根联 】
                    </span>
                  </div>

                  <div className="triplicate-grid">
                    <div>
                      <b>供货商：</b>
                      {model.supplierName}
                    </div>
                    <div>
                      <b>入库仓库：</b>
                      {model.warehouseName}
                    </div>
                    <div>
                      <b>业务日期：</b>
                      {model.businessDate}
                    </div>
                    <div>
                      <b>制单员：</b>
                      {model.postedByName}
                    </div>
                  </div>

                  <table className="triplicate-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>货号</th>
                        <th>品名</th>
                        <th>单位</th>
                        <th style={{ textAlign: "right" }}>数量</th>
                        <th style={{ textAlign: "right" }}>单价</th>
                        <th style={{ textAlign: "right" }}>金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.lines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.index}</td>
                          <td className="font-mono">{l.productCode}</td>
                          <td>{l.productName}</td>
                          <td>{l.unitName}</td>
                          <td style={{ textAlign: "right" }}>{l.quantity}</td>
                          <td style={{ textAlign: "right" }}>{l.unitPrice}</td>
                          <td style={{ textAlign: "right" }}>{l.lineAmount}</td>
                        </tr>
                      ))}
                      <tr className="triplicate-summary-row">
                        <td colSpan={4}>
                          合计(大写)：{model.totalAmountChinese}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {model.totalQuantity}
                        </td>
                        <td style={{ textAlign: "right" }}>合计:</td>
                        <td style={{ textAlign: "right" }}>
                          ¥{model.totalAmount}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="triplicate-signatures">
                    <span>送货方：__________</span>
                    <span>仓管员：__________</span>
                    <span>财务审核：__________</span>
                    {showSeal && (
                      <div className="triplicate-seal">
                        <span>【已验收过账】</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {format === "THERMAL_80" && (
            <div className="document-sheet sheet-thermal printable-area">
              <div className="thermal-inner">
                <div className="thermal-header">
                  <h3 className="thermal-company">{model.companyName}</h3>
                  <div className="thermal-title">== 采购入库小票 ==</div>
                </div>

                <div className="thermal-info">
                  <div>单号: {model.documentNumber}</div>
                  <div>日期: {model.businessDate}</div>
                  <div>供方: {model.supplierName}</div>
                  <div>仓库: {model.warehouseName}</div>
                  <div>制单: {model.postedByName}</div>
                </div>

                <div className="thermal-divider">
                  --------------------------------
                </div>

                <table className="thermal-table">
                  <thead>
                    <tr>
                      <th align="left">品名</th>
                      <th align="right">数量</th>
                      <th align="right">单价</th>
                      <th align="right">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.lines.map((l) => (
                      <tr key={l.id}>
                        <td align="left">{l.productName}</td>
                        <td align="right">{l.quantity}</td>
                        <td align="right">{l.unitPrice}</td>
                        <td align="right">{l.lineAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="thermal-divider">
                  --------------------------------
                </div>

                <div className="thermal-summary">
                  <div>总件数: {model.totalQuantity}</div>
                  <div className="thermal-total">
                    总金额: ¥{model.totalAmount}
                  </div>
                  <div className="thermal-chinese">
                    {model.totalAmountChinese}
                  </div>
                </div>

                {model.notes && (
                  <div className="thermal-notes">备注: {model.notes}</div>
                )}

                <div className="thermal-footer">
                  <div>仓管签字: _____________</div>
                  <div>送货签字: _____________</div>
                  <div className="thermal-time">
                    {new Date().toLocaleString("zh-CN")}
                  </div>
                  <div className="thermal-bye">*** 货物已入库入账 ***</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
