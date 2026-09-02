import type {
  BusinessProfile,
  ReceiptPaperSize,
} from "../administration/administration-api";
import {
  escapeVoucherHtml,
  financialAccountType,
  financialMoney,
  financialUppercase,
  safeVoucherName,
} from "../shared/financial-voucher";
import type { SupplierPayment } from "./payables-api";

export function supplierPaymentVoucherFileName(payment: SupplierPayment) {
  return `玉春供应商付款凭证-${safeVoucherName(payment.supplier.name)}-${payment.documentNumber}.png`;
}

export function supplierPaymentVoucherPrintHtml(
  payment: SupplierPayment,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const business = paymentVoucherBusiness(profile);
  const compact = paperSize === "RECEIPT_80MM";
  const reversed = Boolean(payment.reversal);
  const rows = payment.allocations
    .map(
      (allocation) =>
        `<tr><td>${escapeVoucherHtml(allocation.payableEntry.sourceDocument.documentNumber)}<small>到期 ${escapeVoucherHtml(allocation.payableEntry.dueDate)}</small></td><td class="number">¥${financialMoney(allocation.amount)}</td></tr>`,
    )
    .join("");
  const compactCss = compact
    ? `@page{size:80mm auto;margin:4mm}body{width:72mm;font-size:10px}.sheet{padding:0;border:0}.brand{text-align:center}.brand h1{font-size:18px}.amount strong{font-size:25px}.meta{grid-template-columns:1fr}.voucher-footer{display:block;text-align:center}.voucher-footer span{display:block;margin-top:3px}`
    : `@page{size:A4;margin:16mm}.sheet{max-width:165mm;margin:0 auto;padding:16mm;border:1px solid #d9e3dd}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeVoucherHtml(payment.documentNumber)}供应商付款凭证</title><style>
  *{box-sizing:border-box}body{margin:0;color:#172c22;font:12px/1.55 "Microsoft YaHei","PingFang SC",sans-serif}.sheet{position:relative}.brand{padding-bottom:12px;border-bottom:2px solid #235b46}.brand h1{margin:0;font-size:24px}.brand p{margin:3px 0 0;color:#6e7c74}.status{position:absolute;top:0;right:0;padding:5px 10px;border:1px solid #a8c2b2;border-radius:99px;color:#286246;font-weight:700}.status.reversed{border-color:#d9a59d;color:#a03c31}.amount{padding:18px 0;text-align:center}.amount span{display:block;color:#718078}.amount strong{display:block;margin:3px 0;font-size:32px}.amount em{color:#53645b;font-style:normal}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;padding:12px;border-radius:9px;background:#f2f6f3}.meta span{display:flex;justify-content:space-between;gap:10px}.meta b{color:#6b7871;font-weight:500}h2{margin:18px 0 7px;font-size:14px}table{width:100%;border-collapse:collapse}th{padding:7px;background:#eaf3ee;color:#365849;text-align:left}td{padding:8px 7px;border-bottom:1px solid #e0e8e3}td small{display:block;color:#77847d}.number{text-align:right;font-variant-numeric:tabular-nums}.notes{margin:13px 0 0;padding:9px 11px;border-radius:7px;background:#f6f8f6;color:#5d6c64}.reversal{margin:13px 0 0;padding:10px;border:1px solid #e7bcb5;border-radius:8px;color:#983d33;background:#fff0ee}.watermark{position:fixed;inset:44% 0 auto;text-align:center;color:rgba(163,55,43,.1);font-size:65px;font-weight:900;transform:rotate(-17deg);pointer-events:none}.voucher-footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:10px;border-top:1px solid #dae4de;color:#738078}${compactCss}</style></head><body><section class="sheet">
  ${reversed ? '<div class="watermark">已反核销</div>' : ""}<header class="brand"><h1>${escapeVoucherHtml(business.storeName)}供应商付款凭证</h1><p>${escapeVoucherHtml([business.phone, business.address].filter(Boolean).join(" · ") || business.shortName)}</p></header><span class="status ${reversed ? "reversed" : ""}">${reversed ? "已反核销" : "付款已入账"}</span>
  <section class="amount"><span>本次实付</span><strong>¥${financialMoney(payment.amount)}</strong><em>人民币（大写）${escapeVoucherHtml(financialUppercase(payment.amount))}</em></section>
  <section class="meta"><span><b>收款供应商</b>${escapeVoucherHtml(payment.supplier.name)}</span><span><b>付款单号</b>${escapeVoucherHtml(payment.documentNumber)}</span><span><b>付款方式</b>${escapeVoucherHtml(financialAccountType(payment.cashAccount.type))} · ${escapeVoucherHtml(payment.cashAccount.name)}</span><span><b>付款日期</b>${escapeVoucherHtml(payment.businessDate)}</span><span><b>入账时间</b>${escapeVoucherHtml(payment.postedAt ? new Date(payment.postedAt).toLocaleString("zh-CN") : "—")}</span><span><b>经办人</b>${escapeVoucherHtml(payment.postedBy?.displayName || "系统")}</span></section>
  <h2>本次核销明细</h2><table><thead><tr><th>采购单</th><th class="number">本次核销</th></tr></thead><tbody>${rows}</tbody></table>
  ${payment.notes ? `<p class="notes">备注：${escapeVoucherHtml(payment.notes)}</p>` : ""}
  ${payment.reversal ? `<p class="reversal"><b>该付款已反核销，不能作为有效付款证明。</b><br>${escapeVoucherHtml(payment.reversal.documentNumber)} · ${escapeVoucherHtml(payment.reversal.businessDate)} · ${escapeVoucherHtml(payment.reversal.reason)}</p>` : ""}
  <footer class="voucher-footer"><span>${escapeVoucherHtml(business.receiptFooter)}</span><span>请妥善保存，核对有误请联系门店。</span></footer></section></body></html>`;
}

export function openSupplierPaymentVoucherPrint(
  payment: SupplierPayment,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow)
    throw new Error("浏览器阻止了打印窗口，请允许弹出窗口后重试。");
  printWindow.document.open();
  printWindow.document.write(
    supplierPaymentVoucherPrintHtml(payment, profile, paperSize),
  );
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

export async function createSupplierPaymentVoucherPng(
  payment: SupplierPayment,
  profile?: BusinessProfile,
) {
  const business = paymentVoucherBusiness(profile);
  const rowHeight = 66;
  const width = 1080;
  const height = Math.max(1180, 790 + payment.allocations.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成付款凭证图片。");
  context.fillStyle = "#f1f5f2";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#fff";
  context.fillRect(40, 40, width - 80, height - 80);
  context.fillStyle = "#235b46";
  context.fillRect(40, 40, 8, height - 80);
  context.font = '700 34px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#17382b";
  context.fillText(`${business.storeName}供应商付款凭证`, 84, 108);
  context.font = '16px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#718078";
  context.fillText(
    [business.phone, business.address].filter(Boolean).join(" · ") ||
      business.shortName,
    84,
    140,
  );
  context.textAlign = "right";
  context.font = '700 18px "Microsoft YaHei", sans-serif';
  context.fillStyle = payment.reversal ? "#a03d32" : "#236247";
  context.fillText(payment.reversal ? "已反核销" : "付款已入账", 986, 104);
  context.textAlign = "center";
  context.font = '15px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#748078";
  context.fillText("本次实付", width / 2, 215);
  context.font = '700 46px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#183d2d";
  context.fillText(`¥${financialMoney(payment.amount)}`, width / 2, 272);
  context.font = '16px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#596961";
  context.fillText(
    `人民币（大写）${financialUppercase(payment.amount)}`,
    width / 2,
    310,
  );
  context.textAlign = "left";
  const meta = [
    ["收款供应商", payment.supplier.name],
    ["付款单号", payment.documentNumber],
    [
      "付款方式",
      `${financialAccountType(payment.cashAccount.type)} · ${payment.cashAccount.name}`,
    ],
    ["付款日期", payment.businessDate],
    [
      "入账时间",
      payment.postedAt
        ? new Date(payment.postedAt).toLocaleString("zh-CN")
        : "—",
    ],
    ["经办人", payment.postedBy?.displayName || "系统"],
  ];
  meta.forEach(([label, value], index) => {
    const x = 84 + (index % 2) * 455;
    const y = 368 + Math.floor(index / 2) * 48;
    context.font = '14px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#75817a";
    context.fillText(label, x, y);
    context.font = '700 16px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#273d32";
    context.fillText(value, x + 92, y);
  });
  let y = 530;
  context.font = '700 18px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#263e33";
  context.fillText("本次核销明细", 84, y);
  y += 25;
  context.fillStyle = "#eaf3ee";
  context.fillRect(84, y, 902, 42);
  context.font = '700 14px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#355849";
  context.fillText("采购单与到期日", 100, y + 27);
  context.textAlign = "right";
  context.fillText("本次核销", 968, y + 27);
  context.textAlign = "left";
  y += 42;
  for (const allocation of payment.allocations) {
    context.font = '700 15px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#263e33";
    context.fillText(
      allocation.payableEntry.sourceDocument.documentNumber,
      100,
      y + 24,
    );
    context.font = '13px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#78847d";
    context.fillText(`到期 ${allocation.payableEntry.dueDate}`, 100, y + 47);
    context.textAlign = "right";
    context.font = '700 16px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#214b38";
    context.fillText(`¥${financialMoney(allocation.amount)}`, 968, y + 35);
    context.textAlign = "left";
    context.strokeStyle = "#e1e8e3";
    context.beginPath();
    context.moveTo(84, y + rowHeight - 1);
    context.lineTo(986, y + rowHeight - 1);
    context.stroke();
    y += rowHeight;
  }
  if (payment.notes) {
    context.font = '14px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#617068";
    context.fillText(`备注：${payment.notes.slice(0, 70)}`, 84, y + 40);
  }
  if (payment.reversal) {
    context.fillStyle = "#fff0ee";
    context.fillRect(84, height - 215, 902, 82);
    context.font = '700 15px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#9c3f35";
    context.fillText(
      "该付款已反核销，不能作为有效付款证明。",
      102,
      height - 180,
    );
    context.font = '13px "Microsoft YaHei", sans-serif';
    context.fillText(
      `${payment.reversal.documentNumber} · ${payment.reversal.reason}`,
      102,
      height - 153,
    );
  }
  context.font = '13px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#77837d";
  context.fillText(business.receiptFooter, 84, height - 78);
  context.textAlign = "right";
  context.fillText("请妥善保存，核对有误请联系门店。", 986, height - 78);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("生成付款凭证图片失败。");
  return blob;
}

function paymentVoucherBusiness(profile?: BusinessProfile) {
  return {
    storeName: profile?.storeName || "玉春农机",
    shortName: profile?.shortName || "YC",
    phone: profile?.phone || "",
    address: profile?.address || "",
    receiptFooter: profile?.receiptFooter || "付款已登记，请及时核对。",
  };
}
