import type { SalesDocument } from "./sales-api";
import type {
  BusinessProfile,
  ReceiptPaperSize,
} from "../administration/administration-api";

const moneyFormat = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function receiptMoney(value: string | number) {
  return moneyFormat.format(Number(value));
}

export function receiptStatus(document: SalesDocument) {
  if (document.status === "REVERSED") return "已冲销";
  if (document.status === "POSTED") return "已过账";
  return document.status === "SUBMITTED" ? "待过账" : "草稿";
}

export function receiptCustomerName(document: SalesDocument) {
  return document.customerNameSnapshot || document.customer.name || "散客";
}

export function receiptSettlement(document: SalesDocument) {
  return document.settlementType === "CREDIT" ? "客户赊账" : "现结销售";
}

export function receiptSoldAt(document: SalesDocument) {
  return new Date(document.soldAt).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function receiptFileName(document: SalesDocument) {
  return `玉春销售单-${document.documentNumber}.png`;
}

function profileValue(profile?: BusinessProfile) {
  return {
    storeName: profile?.storeName || "玉春农机",
    shortName: profile?.shortName || "YC",
    phone: profile?.phone || "",
    address: profile?.address || "",
    receiptFooter: profile?.receiptFooter || "请当面核对商品、数量和金额。",
  };
}

export function receiptPrintHtml(
  document: SalesDocument,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const business = profileValue(profile);
  const status = receiptStatus(document);
  const lines = document.lines
    .map(
      (line, index) => `<tr>
        <td>${index + 1}</td>
        <td><b>${escapeHtml(line.product.name)}</b><small>${escapeHtml(line.product.code)}</small></td>
        <td class="number">${escapeHtml(line.quantity)} ${escapeHtml(line.unitNameSnapshot)}</td>
        <td class="number">¥${receiptMoney(line.unitPrice)}</td>
        <td class="number">¥${receiptMoney(line.lineAmount)}</td>
      </tr>`,
    )
    .join("");
  const compactCss =
    paperSize === "RECEIPT_80MM"
      ? `@page{size:80mm auto;margin:4mm}body{width:72mm;font-size:10px}header{display:block;padding-bottom:9px;text-align:center}h1{font-size:18px}.status{display:inline-block;margin-top:7px;padding:3px 8px}.meta{grid-template-columns:1fr;gap:3px;margin:10px 0}.meta span{justify-content:space-between}.meta b{min-width:56px}th,td{padding:6px 3px}th:nth-child(1),td:nth-child(1){display:none}td small{display:none}.total div{width:100%}.notice{margin-top:12px;padding:7px}.watermark{font-size:45px}footer{display:block;margin-top:13px;text-align:center}footer span{display:block;margin-top:3px}`
      : "";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(business.storeName)}销售单 ${escapeHtml(document.documentNumber)}</title>
  <style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#17231d;font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:12px}header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #235b46}h1{margin:0 0 5px;font-size:25px;letter-spacing:1px}header p{margin:0;color:#68766f;line-height:1.55}.status{padding:6px 12px;border:1px solid #95ad9f;border-radius:999px;color:#235b46;font-weight:700}.status.reversed{border-color:#c98e83;color:#a33c2f}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 28px;margin:17px 0}.meta span{display:flex;gap:7px}.meta b{min-width:68px;color:#66756d;font-weight:500}table{width:100%;border-collapse:collapse}th{padding:9px 7px;background:#eef5f1;color:#36584a;text-align:left}td{padding:10px 7px;border-bottom:1px solid #dde6e1;vertical-align:top}td small{display:block;margin-top:3px;color:#77837d}.number{text-align:right;font-variant-numeric:tabular-nums}.total{display:flex;justify-content:flex-end;margin-top:15px}.total div{width:265px}.total p{display:flex;justify-content:space-between;margin:5px 0}.total .grand{margin-top:9px;padding-top:10px;border-top:1px solid #b8c8bf;font-size:18px;font-weight:800}.notice{margin-top:24px;padding:11px 13px;border-radius:8px;background:#f5f8f6;color:#596860;line-height:1.65}footer{display:flex;justify-content:space-between;margin-top:28px;padding-top:12px;border-top:1px solid #d9e2dd;color:#758078}.watermark{position:fixed;inset:42% 0 auto;text-align:center;color:rgba(164,55,43,.09);font-size:82px;font-weight:900;transform:rotate(-18deg);pointer-events:none}@media print{button{display:none}}${compactCss}
  </style></head><body>${document.status === "REVERSED" ? '<div class="watermark">已冲销</div>' : ""}
  <header><div><h1>${escapeHtml(business.storeName)}销售单</h1><p>${escapeHtml(business.shortName)} Agricultural Machinery${business.phone ? `<br>电话：${escapeHtml(business.phone)}` : ""}${business.address ? `<br>${escapeHtml(business.address)}` : ""}</p></div><span class="status ${document.status === "REVERSED" ? "reversed" : ""}">${status}</span></header>
  <section class="meta"><span><b>销售单号</b>${escapeHtml(document.documentNumber)}</span><span><b>销售时间</b>${escapeHtml(receiptSoldAt(document))}</span><span><b>客户</b>${escapeHtml(receiptCustomerName(document))}</span><span><b>结算方式</b>${receiptSettlement(document)}</span><span><b>联系电话</b>${escapeHtml(document.customerPhoneSnapshot || "—")}</span><span><b>约定付款</b>${document.settlementType === "CREDIT" ? escapeHtml(document.dueDate) : "已现结"}</span></section>
  <table><thead><tr><th>#</th><th>商品</th><th class="number">数量</th><th class="number">单价</th><th class="number">金额</th></tr></thead><tbody>${lines}</tbody></table>
  <section class="total"><div><p><span>商品种类</span><b>${document.lines.length} 种</b></p><p class="grand"><span>销售总额</span><b>¥${receiptMoney(document.totalAmount)}</b></p>${document.settlementType === "CREDIT" ? `<p><span>当前原单欠款</span><b>¥${receiptMoney(document.receivableEntry?.outstandingAmount ?? document.totalAmount)}</b></p>` : `<p><span>收款账户</span><b>${escapeHtml(document.cashAccount?.name ?? "门店现金")}</b></p>`}</div></section>
  <p class="notice">${escapeHtml(business.receiptFooter)}<br>本单据为经营销售凭证，不是增值税发票；发生退货或错单冲销时，以系统中的关联正式单据为准。</p>
  <footer><span>出库仓库：${escapeHtml(document.warehouse.name)}</span><span>经办人：${escapeHtml(document.postedBy?.displayName ?? "系统")}</span></footer></body></html>`;
}

export function openReceiptPrint(
  document: SalesDocument,
  profile?: BusinessProfile,
  paperSize: ReceiptPaperSize = "A4",
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow)
    throw new Error("浏览器阻止了打印窗口，请允许弹出窗口后重试。");
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(receiptPrintHtml(document, profile, paperSize));
  printWindow.document.close();
  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

function canvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let visible = text;
  while (
    visible.length > 1 &&
    context.measureText(`${visible}…`).width > maxWidth
  )
    visible = visible.slice(0, -1);
  context.fillText(`${visible}…`, x, y);
}

export async function createReceiptPng(
  document: SalesDocument,
  profile?: BusinessProfile,
) {
  const business = profileValue(profile);
  await globalThis.document.fonts?.ready;
  const width = 1080;
  const rowHeight = 72;
  const height = Math.max(1080, 850 + document.lines.length * rowHeight);
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成销售单图片。");

  context.fillStyle = "#f3f7f4";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(40, 40, width - 80, height - 80);
  context.fillStyle = "#1f5c46";
  context.fillRect(40, 40, 10, height - 80);
  context.textBaseline = "middle";
  context.fillStyle = "#173128";
  context.font = '700 42px "Microsoft YaHei", sans-serif';
  context.fillText(`${business.storeName}销售单`, 88, 105);
  context.fillStyle = "#68766f";
  context.font = '24px "Microsoft YaHei", sans-serif';
  context.fillText(`${business.shortName} Agricultural Machinery`, 90, 148);
  const contact = [business.phone, business.address]
    .filter(Boolean)
    .join(" · ");
  if (contact) {
    context.font = '17px "Microsoft YaHei", sans-serif';
    canvasText(context, contact, 90, 180, 690);
  }
  context.textAlign = "right";
  context.fillStyle = document.status === "REVERSED" ? "#a33c2f" : "#235b46";
  context.font = '700 26px "Microsoft YaHei", sans-serif';
  context.fillText(receiptStatus(document), 984, 125);
  context.textAlign = "left";
  context.strokeStyle = "#cddbd3";
  context.beginPath();
  context.moveTo(88, 215);
  context.lineTo(984, 215);
  context.stroke();

  const meta = [
    ["销售单号", document.documentNumber],
    ["销售时间", receiptSoldAt(document)],
    ["客户", receiptCustomerName(document)],
    ["结算方式", receiptSettlement(document)],
    ["联系电话", document.customerPhoneSnapshot || "—"],
    [
      "约定付款",
      document.settlementType === "CREDIT" ? document.dueDate : "已现结",
    ],
  ];
  context.font = '22px "Microsoft YaHei", sans-serif';
  meta.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 90 + column * 455;
    const y = 262 + row * 48;
    context.fillStyle = "#758078";
    context.fillText(label, x, y);
    context.fillStyle = "#223a30";
    canvasText(context, value, x + 112, y, 325);
  });

  let y = 437;
  context.fillStyle = "#eaf3ee";
  context.fillRect(88, y, 896, 52);
  context.fillStyle = "#36584a";
  context.font = '700 21px "Microsoft YaHei", sans-serif';
  context.fillText("商品", 108, y + 26);
  context.textAlign = "right";
  context.fillText("数量", 700, y + 26);
  context.fillText("单价", 835, y + 26);
  context.fillText("金额", 964, y + 26);
  context.textAlign = "left";
  y += 52;
  for (const line of document.lines) {
    context.fillStyle = "#1f332a";
    context.font = '700 22px "Microsoft YaHei", sans-serif';
    canvasText(context, line.product.name, 108, y + 25, 400);
    context.fillStyle = "#7b8781";
    context.font = '18px "Microsoft YaHei", sans-serif';
    canvasText(context, line.product.code, 108, y + 52, 400);
    context.textAlign = "right";
    context.fillStyle = "#253c32";
    context.font = '21px "Microsoft YaHei", sans-serif';
    context.fillText(`${line.quantity} ${line.unitNameSnapshot}`, 700, y + 36);
    context.fillText(`¥${receiptMoney(line.unitPrice)}`, 835, y + 36);
    context.font = '700 21px "Microsoft YaHei", sans-serif';
    context.fillText(`¥${receiptMoney(line.lineAmount)}`, 964, y + 36);
    context.textAlign = "left";
    context.strokeStyle = "#e0e8e3";
    context.beginPath();
    context.moveTo(88, y + rowHeight);
    context.lineTo(984, y + rowHeight);
    context.stroke();
    y += rowHeight;
  }
  y += 34;
  context.textAlign = "right";
  context.fillStyle = "#65736c";
  context.font = '22px "Microsoft YaHei", sans-serif';
  context.fillText("销售总额", 760, y);
  context.fillStyle = "#173128";
  context.font = '800 38px "Microsoft YaHei", sans-serif';
  context.fillText(`¥${receiptMoney(document.totalAmount)}`, 964, y);
  if (document.settlementType === "CREDIT") {
    context.fillStyle = "#986335";
    context.font = '20px "Microsoft YaHei", sans-serif';
    context.fillText(
      `当前原单欠款 ¥${receiptMoney(document.receivableEntry?.outstandingAmount ?? document.totalAmount)}`,
      964,
      y + 43,
    );
  }
  context.textAlign = "left";
  y += document.settlementType === "CREDIT" ? 100 : 70;
  context.fillStyle = "#f3f7f4";
  context.fillRect(88, y, 896, 112);
  context.fillStyle = "#5f6e66";
  context.font = '19px "Microsoft YaHei", sans-serif';
  canvasText(context, business.receiptFooter, 112, y + 34, 820);
  context.fillText("本单据为经营销售凭证，不是增值税发票。", 112, y + 70);
  context.fillStyle = "#7a867f";
  context.font = '18px "Microsoft YaHei", sans-serif';
  context.fillText(`出库：${document.warehouse.name}`, 90, height - 90);
  context.textAlign = "right";
  context.fillText(
    `经办：${document.postedBy?.displayName ?? "系统"}`,
    984,
    height - 90,
  );
  if (document.status === "REVERSED") {
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-0.28);
    context.textAlign = "center";
    context.fillStyle = "rgba(163,60,47,.12)";
    context.font = '900 130px "Microsoft YaHei", sans-serif';
    context.fillText("已冲销", 0, 0);
    context.restore();
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("销售单图片生成失败。")),
      "image/png",
    ),
  );
}
