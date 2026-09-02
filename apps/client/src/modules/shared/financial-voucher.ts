export function financialMoney(value: string | number) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function financialUppercase(value: string | number) {
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999_999_999_999)
    return "金额超出大写转换范围";
  if (amount === 0) return "零元整";
  const digits = "零壹贰叁肆伍陆柒捌玖";
  const sectionUnits = ["", "万", "亿"];
  const integer = Math.floor(amount / 100);
  const jiao = Math.floor((amount % 100) / 10);
  const fen = amount % 10;
  let result = integer ? `${integerUppercase(integer)}元` : "";
  if (jiao) result += `${digits[jiao]}角`;
  if (fen) {
    if (integer && !jiao) result += "零";
    result += `${digits[fen]}分`;
  }
  if (!jiao && !fen) result += "整";
  return result;

  function integerUppercase(integerValue: number) {
    let remaining = integerValue;
    let sectionPosition = 0;
    let output = "";
    let needsZero = false;
    while (remaining > 0) {
      const section = remaining % 10_000;
      if (needsZero && output) output = `零${output}`;
      if (section)
        output = `${sectionUppercase(section)}${sectionUnits[sectionPosition]}${output}`;
      needsZero = section < 1000;
      remaining = Math.floor(remaining / 10_000);
      sectionPosition += 1;
    }
    return output.replace(/零+/g, "零").replace(/零(万|亿)/g, "$1");
  }

  function sectionUppercase(sectionValue: number) {
    const units = ["", "拾", "佰", "仟"];
    let remaining = sectionValue;
    let unitPosition = 0;
    let output = "";
    let zero = true;
    while (remaining > 0) {
      const digit = remaining % 10;
      if (!digit) {
        if (!zero) output = `零${output}`;
        zero = true;
      } else {
        zero = false;
        output = `${digits[digit]}${units[unitPosition]}${output}`;
      }
      unitPosition += 1;
      remaining = Math.floor(remaining / 10);
    }
    return output.replace(/零+$/g, "");
  }
}

export function financialAccountType(type: string) {
  return (
    {
      CASH: "现金",
      BANK: "银行卡",
      WECHAT: "微信",
      ALIPAY: "支付宝",
      OTHER: "其他",
    }[type] ?? type
  );
}

export function escapeVoucherHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeVoucherName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40);
}
