import { useState, useRef, type ChangeEvent } from "react";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useBatchImportParties } from "./use-parties";
import type { CreatePartyInput, PartyRole } from "./parties-api";

const CSV_HEADER =
  "单位编码,单位名称,简称,身份(客户/供应商),主要联系人,联系电话,信用额度,默认账期(天),省份,城市,详细地址,备注";
const SAMPLE_CSV = `${CSV_HEADER}
KH-8001,临沂金秋果品种植合作社,金秋合作社,客户,张金秋,13953901122,60000,30,山东省,临沂市,河东区汤头镇金秋基地,水果采摘运输机具采购
KH-8002,莒南县鲁南农机维修站,鲁南维修,客户,王工,13705398877,20000,15,山东省,临沂市,莒南县天湖路88号,常订齿轮轴承配件
GYS-8001,常州东风柴油机配件有限公司,常州东风,供应商,陈经理,0519-86691122,150000,45,江苏省,常州市,钟楼区柴油机工业园,单缸柴油机四配套原厂供货`;

export function BatchImportPartiesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const batchImport = useBatchImportParties();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<
    Array<CreatePartyInput & { _valid: boolean; _errors: string[] }>
  >([]);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!open) return null;

  function handleDownloadTemplate() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `往来单位批量导入模板_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvContent(text: string) {
    setError("");
    setSuccessCount(null);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    // Determine if first line is header
    const firstLine = lines[0];
    const startIndex =
      firstLine.includes("编码") || firstLine.includes("名称") ? 1 : 0;
    const dataLines = lines.slice(startIndex);

    const rows: Array<
      CreatePartyInput & { _valid: boolean; _errors: string[] }
    > = [];

    dataLines.forEach((line, idx) => {
      // Split by comma taking basic quoting into account
      const cols = line
        .split(",")
        .map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length < 2 || !cols.some((c) => c)) return;

      const code =
        cols[0] || `DW-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
      const name = cols[1] || "";
      const shortName = cols[2] || undefined;
      const roleStr = cols[3] || "客户";
      const contactName = cols[4] || "";
      const phone = cols[5] || undefined;
      const creditLimit = cols[6] || "0";
      const paymentTermsDays = Number(cols[7] || 0);
      const province = cols[8] || undefined;
      const city = cols[9] || undefined;
      const address = cols[10] || undefined;
      const notes = cols[11] || undefined;

      const roles: PartyRole[] = [];
      if (roleStr.includes("客")) roles.push("CUSTOMER");
      if (roleStr.includes("供")) roles.push("SUPPLIER");
      if (roles.length === 0) roles.push("CUSTOMER");

      const errors: string[] = [];
      if (!name) errors.push("单位名称必填");
      if (isNaN(paymentTermsDays) || paymentTermsDays < 0)
        errors.push("账期需为有效天数");

      rows.push({
        code,
        name,
        shortName,
        roles,
        creditLimit: isNaN(Number(creditLimit)) ? "0" : creditLimit,
        paymentTermsDays: isNaN(paymentTermsDays) ? 0 : paymentTermsDays,
        province,
        city,
        address,
        notes,
        contacts: contactName
          ? [
              {
                name: contactName,
                phone,
                isPrimary: true,
              },
            ]
          : undefined,
        _valid: errors.length === 0,
        _errors: errors,
      });
    });

    setParsedRows(rows);
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      setCsvText(content);
      parseCsvContent(content);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImportSubmit() {
    const validItems = parsedRows.filter((r) => r._valid);
    if (validItems.length === 0) {
      setError("没有可导入的有效行数据，请检查。");
      return;
    }

    try {
      const payload: CreatePartyInput[] = validItems.map((r) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _valid, _errors, ...rest } = r;
        return rest;
      });
      const res = await batchImport.mutateAsync(payload);
      setSuccessCount(res.count);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量导入失败");
    }
  }

  const validCount = parsedRows.filter((r) => r._valid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div
      className="catalog-dialog-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="catalog-dialog party-dialog batch-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-import-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div className="party-dialog-head-left">
            <span className="party-dialog-badge">
              <FileSpreadsheet size={16} />
            </span>
            <div>
              <small>档案管理 / 批量操作</small>
              <h2 id="batch-import-title">批量导入客户与供应商</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="batch-import-body">
          {/* Action Row */}
          <div className="batch-import-toolbar">
            <button
              type="button"
              className="outline-button"
              onClick={handleDownloadTemplate}
            >
              <Download size={15} />
              下载标准 CSV / Excel 模板
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            <button
              type="button"
              className="outline-button import-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} />
              选择本地 CSV 文件
            </button>
          </div>

          {/* Direct text paste or dropzone */}
          <div className="batch-paste-zone">
            <label>
              <span>或直接在此粘贴表格文本 (CSV 格式，支持逗号分隔)：</span>
              <textarea
                rows={4}
                value={csvText}
                placeholder={`可直接从 Excel 复制粘贴，或输入如：\nKH-9001,向阳红农场,客户,李强,13812345678,50000,30,山东省,临沂市,向阳村`}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  parseCsvContent(e.target.value);
                }}
              />
            </label>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="batch-preview-section">
              <div className="batch-preview-header">
                <strong>数据预览 ({parsedRows.length} 条)</strong>
                <div className="batch-preview-stats">
                  <span className="stat-valid">
                    <CheckCircle2 size={13} /> {validCount} 条有效
                  </span>
                  {invalidCount > 0 && (
                    <span className="stat-invalid">
                      <AlertTriangle size={13} /> {invalidCount} 条格式异常
                    </span>
                  )}
                </div>
              </div>

              <div className="batch-table-wrapper">
                <table className="batch-preview-table">
                  <thead>
                    <tr>
                      <th>状态</th>
                      <th>编码</th>
                      <th>单位名称</th>
                      <th>身份</th>
                      <th>联系人</th>
                      <th>电话</th>
                      <th>授信额度</th>
                      <th>账期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className={row._valid ? "row-ok" : "row-err"}>
                        <td>
                          {row._valid ? (
                            <span className="tag-ok">有效</span>
                          ) : (
                            <span
                              className="tag-err"
                              title={row._errors.join(", ")}
                            >
                              异常
                            </span>
                          )}
                        </td>
                        <td>{row.code}</td>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>
                          {row.roles.includes("CUSTOMER") &&
                          row.roles.includes("SUPPLIER")
                            ? "客户·供应商"
                            : row.roles.includes("CUSTOMER")
                              ? "客户"
                              : "供应商"}
                        </td>
                        <td>{row.contacts?.[0]?.name || "—"}</td>
                        <td>{row.contacts?.[0]?.phone || "—"}</td>
                        <td>
                          ¥{" "}
                          {Number(row.creditLimit || 0).toLocaleString("zh-CN")}
                        </td>
                        <td>
                          {row.paymentTermsDays
                            ? `${row.paymentTermsDays} 天`
                            : "现结"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 15 && (
                  <p className="batch-more-hint">
                    还有 {parsedRows.length - 15} 条数据未在预览区完全列出…
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="catalog-form-error" role="alert">
              {error}
            </p>
          )}

          {successCount !== null && (
            <p className="batch-success-msg">
              <CheckCircle2 size={16} /> 成功导入 {successCount}{" "}
              位往来单位档案！
            </p>
          )}

          <footer>
            <button type="button" className="outline-button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              disabled={validCount === 0 || batchImport.isPending}
              onClick={handleImportSubmit}
            >
              {batchImport.isPending
                ? "正在导入…"
                : `确认导入 (${validCount} 条)`}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
