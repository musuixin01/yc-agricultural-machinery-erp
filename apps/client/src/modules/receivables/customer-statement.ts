import type { BusinessProfile } from "../administration/administration-api";
import type { CustomerStatement } from "./receivables-api";

export function statementMoney(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function statementFileName(statement: CustomerStatement) {
  return `玉春客户对账单-${safeName(statement.customer.name)}-${statement.period.dateFrom}-${statement.period.dateTo}.png`;
}

export function statementPrintHtml(
  statement: CustomerStatement,
  profile?: BusinessProfile,
) {
  const storeName = profile?.storeName || "玉春农机";
  const rows = statement.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.businessDate)}</td><td><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.documentNumber)}${item.sourceDocumentNumber ? ` · 原单 ${escapeHtml(item.sourceDocumentNumber)}` : ""}</small></td><td class="number">${Number(item.increase) ? `¥${statementMoney(item.increase)}` : "—"}</td><td class="number">${Number(item.decrease) ? `¥${statementMoney(item.decrease)}` : "—"}</td><td class="number balance">¥${statementMoney(item.balance)}</td></tr>`,
    )
    .join("");
  const contact = [profile?.phone, profile?.address]
    .filter(Boolean)
    .join(" · ");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(statement.customer.name)}客户对账单</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#17231d;font:12px/1.5 "Microsoft YaHei","PingFang SC",sans-serif}header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #235b46}h1{margin:0;font-size:25px}header p{margin:4px 0 0;color:#6b7871}.period{padding:7px 11px;border:1px solid #b9c9c0;border-radius:8px;color:#315846;font-weight:700}.customer{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;padding:13px 0}.customer span{display:flex;gap:8px}.customer b{min-width:64px;color:#69766f;font-weight:500}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.summary div{padding:9px;border-radius:7px;background:#f2f6f3}.summary small{display:block;color:#6a7770}.summary strong{display:block;margin-top:3px;font-size:17px}.summary .closing{background:#e7f2eb;color:#174f39}table{width:100%;border-collapse:collapse}th{padding:8px 6px;background:#eaf3ee;color:#355849;text-align:left}td{padding:8px 6px;border-bottom:1px solid #dce6e0;vertical-align:top}td small{display:block;color:#718078}.number{text-align:right;font-variant-numeric:tabular-nums}.balance{font-weight:700}footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:10px;border-top:1px solid #dce5e0;color:#718078}.empty{padding:34px;text-align:center;color:#718078}</style></head><body>
  <header><div><h1>${escapeHtml(storeName)}客户对账单</h1><p>${escapeHtml(contact || profile?.shortName || "YC")}</p></div><span class="period">${escapeHtml(statement.period.dateFrom)} 至 ${escapeHtml(statement.period.dateTo)}</span></header>
  <section class="customer"><span><b>客户</b>${escapeHtml(statement.customer.name)}</span><span><b>客户编号</b>${escapeHtml(statement.customer.code)}</span><span><b>联系电话</b>${escapeHtml(statement.customer.phone || "—")}</span><span><b>地址</b>${escapeHtml(statement.customer.address || "—")}</span></section>
  <section class="summary"><div><small>期初欠款</small><strong>¥${statementMoney(statement.summary.openingBalance)}</strong></div><div><small>本期增加</small><strong>¥${statementMoney(statement.summary.increases)}</strong></div><div><small>本期减少</small><strong>¥${statementMoney(statement.summary.decreases)}</strong></div><div class="closing"><small>期末欠款</small><strong>¥${statementMoney(statement.summary.closingBalance)}</strong></div></section>
  ${rows ? `<table><thead><tr><th>日期</th><th>业务与单号</th><th class="number">欠款增加</th><th class="number">欠款减少</th><th class="number">结余</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">所选日期内没有客户欠款变动。</div>'}
  <footer><span>生成时间：${escapeHtml(new Date(statement.generatedAt).toLocaleString("zh-CN"))}</span><span>本单用于经营往来核对，不是法定会计账簿。</span></footer></body></html>`;
}

export function openStatementPrint(
  statement: CustomerStatement,
  profile?: BusinessProfile,
) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow)
    throw new Error("浏览器阻止了打印窗口，请允许弹出窗口后重试。");
  printWindow.document.open();
  printWindow.document.write(statementPrintHtml(statement, profile));
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

export async function createStatementPng(
  statement: CustomerStatement,
  profile?: BusinessProfile,
) {
  if (statement.items.length > 180)
    throw new Error(
      "明细超过 180 行，请缩短日期范围后保存图片；打印不受影响。",
    );
  const scale = 2;
  const width = 1080;
  const rowHeight = 58;
  const height = Math.max(1240, 590 + statement.items.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成对账单图片。");
  context.scale(scale, scale);
  context.fillStyle = "#f2f6f3";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(40, 40, width - 80, height - 80);
  context.fillStyle = "#235b46";
  context.fillRect(40, 40, 8, height - 80);
  context.font = '700 34px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#17382b";
  context.fillText(`${profile?.storeName || "玉春农机"}客户对账单`, 82, 105);
  context.font = '16px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#718078";
  context.fillText(
    `${statement.period.dateFrom} 至 ${statement.period.dateTo}`,
    82,
    138,
  );
  context.font = '700 22px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#213c31";
  context.fillText(statement.customer.name, 82, 195);
  context.font = '15px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#718078";
  context.fillText(
    [
      statement.customer.code,
      statement.customer.phone,
      statement.customer.address,
    ]
      .filter(Boolean)
      .join(" · "),
    82,
    223,
  );
  const summaries = [
    ["期初欠款", statement.summary.openingBalance],
    ["本期增加", statement.summary.increases],
    ["本期减少", statement.summary.decreases],
    ["期末欠款", statement.summary.closingBalance],
  ];
  summaries.forEach(([label, value], index) => {
    const x = 82 + index * 225;
    context.fillStyle = index === 3 ? "#e5f2e9" : "#f3f6f4";
    context.fillRect(x, 255, 205, 88);
    context.font = '14px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#6c7a73";
    context.fillText(label, x + 14, 281);
    context.font = '700 22px "Microsoft YaHei", sans-serif';
    context.fillStyle = index === 3 ? "#174f39" : "#213c31";
    context.fillText(`¥${statementMoney(value)}`, x + 14, 318);
  });
  let y = 390;
  context.fillStyle = "#e9f2ed";
  context.fillRect(82, y, 916, 42);
  context.font = '700 14px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#355849";
  [
    ["日期", 94],
    ["业务与单号", 230],
    ["增加", 690],
    ["减少", 810],
    ["结余", 930],
  ].forEach(([text, x]) => context.fillText(String(text), Number(x), y + 27));
  y += 42;
  context.font = '14px "Microsoft YaHei", sans-serif';
  for (const item of statement.items) {
    context.fillStyle = "#223c31";
    context.fillText(item.businessDate, 94, y + 23);
    context.font = '700 14px "Microsoft YaHei", sans-serif';
    context.fillText(item.label, 230, y + 20);
    context.font = '12px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#74817a";
    context.fillText(item.documentNumber, 230, y + 41);
    context.font = '14px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#223c31";
    context.textAlign = "right";
    context.fillText(
      Number(item.increase) ? `¥${statementMoney(item.increase)}` : "—",
      770,
      y + 29,
    );
    context.fillText(
      Number(item.decrease) ? `¥${statementMoney(item.decrease)}` : "—",
      890,
      y + 29,
    );
    context.font = '700 14px "Microsoft YaHei", sans-serif';
    context.fillText(`¥${statementMoney(item.balance)}`, 986, y + 29);
    context.textAlign = "left";
    context.strokeStyle = "#e0e8e3";
    context.beginPath();
    context.moveTo(82, y + rowHeight - 1);
    context.lineTo(998, y + rowHeight - 1);
    context.stroke();
    y += rowHeight;
  }
  context.font = '13px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#77837d";
  context.fillText("本单用于经营往来核对，不是法定会计账簿。", 82, height - 78);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("生成对账单图片失败。");
  return blob;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40);
}
