import type { BusinessProfile } from "../administration/administration-api";
import type { PurchaseReceipt } from "./purchasing-api";

export type PrintFormat = "A4" | "TRIPLICATE" | "THERMAL_80";

export type PurchaseReceiptPrintViewModel = {
  format: PrintFormat;
  companyName: string;
  taxNumber?: string;
  contactPhone?: string;
  address?: string;
  documentNumber: string;
  businessDate: string;
  receivedAt: string;
  supplierName: string;
  supplierPhone?: string;
  warehouseName: string;
  postedByName: string;
  notes?: string;
  lines: {
    id: string;
    index: number;
    productCode: string;
    productName: string;
    unitName: string;
    quantity: string;
    unitPrice: string;
    lineAmount: string;
  }[];
  totalQuantity: number;
  totalAmount: string;
  totalAmountChinese: string;
};

export function convertNumberToChineseMoney(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "零元整";
  if (num === 0) return "零元整";

  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [
    ["元", "万", "亿"],
    ["", "拾", "佰", "仟"],
  ];

  const head = num < 0 ? "欠" : "";
  const absNum = Math.abs(num);
  const intPart = Math.floor(absNum);
  const cents = Math.round(absNum * 100) % 100;
  const jiao = Math.floor(cents / 10);
  const fen = cents % 10;

  let fracStr = "";
  if (jiao > 0) fracStr += digit[jiao] + "角";
  if (fen > 0) fracStr += digit[fen] + "分";
  if (cents === 0) fracStr = "整";

  let intStr = "";
  let tempInt = intPart;
  for (let i = 0; i < unit[0].length && tempInt > 0; i++) {
    let p = "";
    for (let j = 0; j < unit[1].length && tempInt > 0; j++) {
      p = digit[tempInt % 10] + unit[1][j] + p;
      tempInt = Math.floor(tempInt / 10);
    }
    intStr =
      p.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][i] + intStr;
  }

  const result = (intStr + fracStr)
    .replace(/(零.)*零元/, "元")
    .replace(/(零.)+/g, "零")
    .replace(/^整$/, "零元整")
    .replace(/^元/, "");

  return (
    head +
    (result.startsWith("角") || result.startsWith("分")
      ? "零元" + result
      : result)
  );
}

export function buildPurchaseReceiptPrintModel(
  receipt: PurchaseReceipt,
  profile?: BusinessProfile | null,
  format: PrintFormat = "A4",
): PurchaseReceiptPrintViewModel {
  const companyName =
    profile?.companyName || profile?.legalName || "工业级标准进销存仓储中心";
  const taxNumber = profile?.taxNumber || undefined;
  const contactPhone =
    profile?.phone || profile?.emergencyPhone || "400-800-6688";
  const address =
    profile?.registeredAddress || profile?.operatingAddress || undefined;

  let totalQty = 0;
  let totalAmt = 0;

  const lines = (receipt.lines || []).map((l, idx) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const lineAmt = Number(l.lineAmount) || qty * price;
    totalQty += qty;
    totalAmt += lineAmt;

    return {
      id: l.id || `line-${idx}`,
      index: idx + 1,
      productCode: l.product?.code || "-",
      productName: l.product?.name || "未知商品",
      unitName: l.unitNameSnapshot || "件",
      quantity: String(l.quantity),
      unitPrice: Number(l.unitPrice).toFixed(2),
      lineAmount: lineAmt.toFixed(2),
    };
  });

  const finalTotalAmount = Number(receipt.totalAmount || totalAmt).toFixed(2);

  return {
    format,
    companyName,
    taxNumber,
    contactPhone,
    address,
    documentNumber: receipt.documentNumber,
    businessDate: receipt.businessDate,
    receivedAt:
      receipt.receivedAt || receipt.postedAt || new Date().toISOString(),
    supplierName: receipt.supplier?.name || "未知供应商",
    supplierPhone: receipt.supplier?.phone,
    warehouseName: receipt.warehouse?.name || "默认仓库",
    postedByName: receipt.postedBy?.displayName || "仓库管理员",
    notes: receipt.notes || undefined,
    lines,
    totalQuantity: totalQty,
    totalAmount: finalTotalAmount,
    totalAmountChinese: convertNumberToChineseMoney(finalTotalAmount),
  };
}
