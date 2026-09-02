import type {
  BusinessProfile,
  ReceiptPaperSize,
} from "../administration/administration-api";
import type { CustomerReceipt } from "./receivables-api";
import {
  escapeVoucherHtml as escapeHtml,
  financialAccountType as voucherAccountType,
  financialMoney as voucherMoney,
  financialUppercase as voucherUppercase,
  safeVoucherName as safeName,
} from "../shared/financial-voucher";

export { voucherAccountType, voucherMoney, voucherUppercase };

export function voucherFileName(receipt: CustomerReceipt) {
  return `玉春客户收款凭证-${safeName(receipt.customer.name)}-${receipt.documentNumber}.png`;
}

export function voucherPrintHtml(
  receipt: CustomerReceipt,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const business = businessProfile(profile);
  const compact = paperSize === "RECEIPT_80MM";
  const rows = receipt.allocations
    .map(
      (allocation) =>
        `<tr><td>${escapeHtml(allocation.receivableEntry.sourceDocument.documentNumber)}<small>${escapeHtml(new Date(allocation.receivableEntry.sourceDocument.soldAt).toLocaleString("zh-CN"))}</small></td><td class="number">¥${voucherMoney(allocation.amount)}</td></tr>`,
    )
    .join("");
  const reversed = Boolean(receipt.reversal);
  const compactCss = compact
    ? `@page{size:80mm auto;margin:4mm}body{width:72mm;font-size:10px}.sheet{padding:0;border:0}.brand{text-align:center}.brand h1{font-size:18px}.amount strong{font-size:25px}.meta{grid-template-columns:1fr}.voucher-footer{display:block;text-align:center}.voucher-footer span{display:block;margin-top:3px}`
    : `@page{size:A4;margin:16mm}.sheet{max-width:165mm;margin:0 auto;padding:16mm;border:1px solid #d9e3dd}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(receipt.documentNumber)}客户收款凭证</title><style>
  *{box-sizing:border-box}body{margin:0;color:#172c22;font:12px/1.55 "Microsoft YaHei","PingFang SC",sans-serif}.sheet{position:relative}.brand{padding-bottom:12px;border-bottom:2px solid #235b46}.brand h1{margin:0;font-size:24px}.brand p{margin:3px 0 0;color:#6e7c74}.status{position:absolute;top:0;right:0;padding:5px 10px;border:1px solid #a8c2b2;border-radius:99px;color:#286246;font-weight:700}.status.reversed{border-color:#d9a59d;color:#a03c31}.amount{padding:18px 0;text-align:center}.amount span{display:block;color:#718078}.amount strong{display:block;margin:3px 0;font-size:32px}.amount em{color:#53645b;font-style:normal}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;padding:12px;border-radius:9px;background:#f2f6f3}.meta span{display:flex;justify-content:space-between;gap:10px}.meta b{color:#6b7871;font-weight:500}h2{margin:18px 0 7px;font-size:14px}table{width:100%;border-collapse:collapse}th{padding:7px;background:#eaf3ee;color:#365849;text-align:left}td{padding:8px 7px;border-bottom:1px solid #e0e8e3}td small{display:block;color:#77847d}.number{text-align:right;font-variant-numeric:tabular-nums}.notes{margin:13px 0 0;padding:9px 11px;border-radius:7px;background:#f6f8f6;color:#5d6c64}.reversal{margin:13px 0 0;padding:10px;border:1px solid #e7bcb5;border-radius:8px;color:#983d33;background:#fff0ee}.watermark{position:fixed;inset:44% 0 auto;text-align:center;color:rgba(163,55,43,.1);font-size:65px;font-weight:900;transform:rotate(-17deg);pointer-events:none}.voucher-footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:10px;border-top:1px solid #dae4de;color:#738078}${compactCss}</style></head><body><section class="sheet">
  ${reversed ? '<div class="watermark">已反核销</div>' : ""}<header class="brand"><h1>${escapeHtml(business.storeName)}客户收款凭证</h1><p>${escapeHtml([business.phone, business.address].filter(Boolean).join(" · ") || business.shortName)}</p></header><span class="status ${reversed ? "reversed" : ""}">${reversed ? "已反核销" : "收款已入账"}</span>
  <section class="amount"><span>本次实收</span><strong>¥${voucherMoney(receipt.amount)}</strong><em>人民币（大写）${escapeHtml(voucherUppercase(receipt.amount))}</em></section>
  <section class="meta"><span><b>付款客户</b>${escapeHtml(receipt.customer.name)}</span><span><b>收款单号</b>${escapeHtml(receipt.documentNumber)}</span><span><b>收款方式</b>${escapeHtml(voucherAccountType(receipt.cashAccount.type))} · ${escapeHtml(receipt.cashAccount.name)}</span><span><b>收款日期</b>${escapeHtml(receipt.businessDate)}</span><span><b>入账时间</b>${escapeHtml(new Date(receipt.postedAt).toLocaleString("zh-CN"))}</span><span><b>经办人</b>${escapeHtml(receipt.postedBy.displayName)}</span></section>
  <h2>本次核销明细</h2><table><thead><tr><th>销售单</th><th class="number">本次核销</th></tr></thead><tbody>${rows}</tbody></table>
  ${receipt.notes ? `<p class="notes">备注：${escapeHtml(receipt.notes)}</p>` : ""}
  ${receipt.reversal ? `<p class="reversal"><b>该收款已反核销，不能作为有效收款证明。</b><br>${escapeHtml(receipt.reversal.documentNumber)} · ${escapeHtml(receipt.reversal.businessDate)} · ${escapeHtml(receipt.reversal.reason)}</p>` : ""}
  <footer class="voucher-footer"><span>${escapeHtml(business.receiptFooter)}</span><span>请妥善保存，核对有误请联系门店。</span></footer></section></body></html>`;
}

export function openVoucherPrint(
  receipt: CustomerReceipt,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow)
    throw new Error("浏览器阻止了打印窗口，请允许弹出窗口后重试。");
  printWindow.document.open();
  printWindow.document.write(voucherPrintHtml(receipt, profile, paperSize));
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

export async function createVoucherPng(
  receipt: CustomerReceipt,
  profile?: BusinessProfile,
) {
  const business = businessProfile(profile);
  const rowHeight = 66;
  const width = 1080;
  const height = Math.max(1180, 790 + receipt.allocations.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成收款凭证图片。");
  context.fillStyle = "#f1f5f2";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#fff";
  context.fillRect(40, 40, width - 80, height - 80);
  context.fillStyle = "#235b46";
  context.fillRect(40, 40, 8, height - 80);
  context.font = '700 34px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#17382b";
  context.fillText(`${business.storeName}客户收款凭证`, 84, 108);
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
  context.fillStyle = receipt.reversal ? "#a03d32" : "#236247";
  context.fillText(receipt.reversal ? "已反核销" : "收款已入账", 986, 104);
  context.textAlign = "center";
  context.font = '15px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#748078";
  context.fillText("本次实收", width / 2, 215);
  context.font = '700 46px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#183d2d";
  context.fillText(`¥${voucherMoney(receipt.amount)}`, width / 2, 272);
  context.font = '16px "Microsoft YaHei", sans-serif';
  context.fillStyle = "#596961";
  context.fillText(
    `人民币（大写）${voucherUppercase(receipt.amount)}`,
    width / 2,
    310,
  );
  context.textAlign = "left";
  const meta = [
    ["付款客户", receipt.customer.name],
    ["收款单号", receipt.documentNumber],
    [
      "收款方式",
      `${voucherAccountType(receipt.cashAccount.type)} · ${receipt.cashAccount.name}`,
    ],
    ["收款日期", receipt.businessDate],
    ["入账时间", new Date(receipt.postedAt).toLocaleString("zh-CN")],
    ["经办人", receipt.postedBy.displayName],
  ];
  meta.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 84 + column * 455;
    const y = 368 + row * 48;
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
  context.fillText("销售单与销售时间", 100, y + 27);
  context.textAlign = "right";
  context.fillText("本次核销", 968, y + 27);
  context.textAlign = "left";
  y += 42;
  for (const allocation of receipt.allocations) {
    context.font = '700 15px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#263e33";
    context.fillText(
      allocation.receivableEntry.sourceDocument.documentNumber,
      100,
      y + 24,
    );
    context.font = '13px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#78847d";
    context.fillText(
      new Date(allocation.receivableEntry.sourceDocument.soldAt).toLocaleString(
        "zh-CN",
      ),
      100,
      y + 47,
    );
    context.textAlign = "right";
    context.font = '700 16px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#214b38";
    context.fillText(`¥${voucherMoney(allocation.amount)}`, 968, y + 35);
    context.textAlign = "left";
    context.strokeStyle = "#e1e8e3";
    context.beginPath();
    context.moveTo(84, y + rowHeight - 1);
    context.lineTo(986, y + rowHeight - 1);
    context.stroke();
    y += rowHeight;
  }
  if (receipt.notes) {
    context.font = '14px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#617068";
    context.fillText(`备注：${receipt.notes.slice(0, 70)}`, 84, y + 40);
  }
  if (receipt.reversal) {
    context.fillStyle = "#fff0ee";
    context.fillRect(84, height - 215, 902, 82);
    context.font = '700 15px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#9c3f35";
    context.fillText(
      "该收款已反核销，不能作为有效收款证明。",
      102,
      height - 180,
    );
    context.font = '13px "Microsoft YaHei", sans-serif';
    context.fillText(
      `${receipt.reversal.documentNumber} · ${receipt.reversal.reason}`,
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
  if (!blob) throw new Error("生成收款凭证图片失败。");
  return blob;
}

function businessProfile(profile?: BusinessProfile) {
  return {
    storeName: profile?.storeName || "玉春农机",
    shortName: profile?.shortName || "YC",
    phone: profile?.phone || "",
    address: profile?.address || "",
    receiptFooter: profile?.receiptFooter || "感谢信任，收到款项后请及时核对。",
  };
}
