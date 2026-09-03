import type { ReceivableEntry } from "./receivables-api";
import type { BusinessProfile } from "../administration/administration-api";

export type AgingIntervalMode = "DAYS" | "MONTHS";

export type AgingIntervalConfig = {
  mode: AgingIntervalMode; // "DAYS" 或 "MONTHS"
  tier1: number; // 天数（如 30）或 月数（如 1）
  tier2: number; // 天数（如 60）或 月数（如 3）
  tier3: number; // 天数（如 90）或 月数（如 6）
  // > tier3 自动为第 4 阶梯
};

export const DEFAULT_AGING_CONFIG_DAYS: AgingIntervalConfig = {
  mode: "DAYS",
  tier1: 30,
  tier2: 60,
  tier3: 90,
};

export const DEFAULT_AGING_CONFIG_MONTHS: AgingIntervalConfig = {
  mode: "MONTHS",
  tier1: 1, // 1个月内
  tier2: 3, // 1-3个月
  tier3: 6, // 3-6个月
  // > 6个月 (6个月以上)
};

export const DEFAULT_AGING_CONFIG = DEFAULT_AGING_CONFIG_DAYS;

export type CustomerAgingSummary = {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone?: string | null;
  totalOutstanding: number;
  totalOriginal: number;
  bucket1Amount: number; // 0 ~ tier1
  bucket2Amount: number; // tier1 ~ tier2
  bucket3Amount: number; // tier2 ~ tier3
  bucket4Amount: number; // > tier3
  overdueAmount: number;
  overdueRate: number; // 0 to 100
  maxOverdueDays: number;
  maxOverdueMonths: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  entries: {
    id: string;
    documentNumber: string;
    soldAt: string;
    dueDate: string;
    originalAmount: number;
    outstandingAmount: number;
    overdueDays: number;
    overdueMonths: number;
    bucketIndex: 1 | 2 | 3 | 4;
  }[];
};

export type GlobalAgingOverview = {
  config: AgingIntervalConfig;
  totalOutstanding: number;
  totalOverdue: number;
  totalCustomers: number;
  riskCustomersCount: number;
  tierLabels: {
    t1: string;
    t2: string;
    t3: string;
    t4: string;
  };
  bucketTotals: {
    bucket1: number;
    bucket2: number;
    bucket3: number;
    bucket4: number;
  };
  bucketPercentages: {
    bucket1: number;
    bucket2: number;
    bucket3: number;
    bucket4: number;
  };
  customerSummaries: CustomerAgingSummary[];
};

export type DunningTone = "FRIENDLY" | "FORMAL" | "URGENT";

export type DunningNoticeViewModel = {
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  bankName: string;
  bankAccount: string;
  customerName: string;
  customerPhone?: string;
  noticeDate: string;
  tone: DunningTone;
  totalDue: number;
  maxOverdueDays: number;
  maxOverdueMonths: number;
  entries: {
    documentNumber: string;
    soldAt: string;
    dueDate: string;
    outstandingAmount: number;
    overdueDays: number;
    overdueMonths: number;
  }[];
  letterTitle: string;
  letterBody: string[];
  warningNote: string;
};

export function calculateDaysBetween(
  fromDateStr: string,
  toDateStr: string,
): number {
  const from = new Date(fromDateStr.slice(0, 10)).getTime();
  const to = new Date(toDateStr.slice(0, 10)).getTime();
  if (isNaN(from) || isNaN(to)) return 0;
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

export function calculateMonthsBetween(
  fromDateStr: string,
  toDateStr: string,
): number {
  const from = new Date(fromDateStr.slice(0, 10));
  const to = new Date(toDateStr.slice(0, 10));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;

  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  const dayDiff = to.getDate() - from.getDate();

  let totalMonths = yearDiff * 12 + monthDiff;
  if (dayDiff > 0) {
    totalMonths += Number((dayDiff / 30).toFixed(1));
  }
  return Math.max(0, Math.round(totalMonths * 10) / 10);
}

export function classifyAgingBucket(
  overdueUnits: number,
  config: AgingIntervalConfig = DEFAULT_AGING_CONFIG,
): 1 | 2 | 3 | 4 {
  if (overdueUnits <= config.tier1) return 1;
  if (overdueUnits <= config.tier2) return 2;
  if (overdueUnits <= config.tier3) return 3;
  return 4;
}

export function analyzeReceivablesAging(
  entries: ReceivableEntry[],
  referenceDate: string = new Date().toISOString().slice(0, 10),
  config: AgingIntervalConfig = DEFAULT_AGING_CONFIG,
): GlobalAgingOverview {
  const mode = config.mode || "DAYS";
  let sanitizedConfig: AgingIntervalConfig;

  if (mode === "MONTHS") {
    const t1 = Math.max(1, config.tier1 || 1);
    const t2 = Math.max(t1 + 1, config.tier2 || 3);
    const t3 = Math.max(t2 + 1, config.tier3 || 6);
    sanitizedConfig = { mode: "MONTHS", tier1: t1, tier2: t2, tier3: t3 };
  } else {
    const t1 = Math.max(1, config.tier1 || 30);
    const t2 = Math.max(t1 + 1, config.tier2 || 60);
    const t3 = Math.max(t2 + 1, config.tier3 || 90);
    sanitizedConfig = { mode: "DAYS", tier1: t1, tier2: t2, tier3: t3 };
  }

  const tierLabels =
    mode === "MONTHS"
      ? {
          t1: `0-${sanitizedConfig.tier1}个月`,
          t2: `${sanitizedConfig.tier1}-${sanitizedConfig.tier2}个月`,
          t3: `${sanitizedConfig.tier2}-${sanitizedConfig.tier3}个月`,
          t4: `${sanitizedConfig.tier3}个月以上`,
        }
      : {
          t1: `0-${sanitizedConfig.tier1}天`,
          t2: `${sanitizedConfig.tier1 + 1}-${sanitizedConfig.tier2}天`,
          t3: `${sanitizedConfig.tier2 + 1}-${sanitizedConfig.tier3}天`,
          t4: `${sanitizedConfig.tier3}天以上`,
        };

  const activeEntries = entries.filter(
    (e) =>
      (e.status === "OPEN" || e.status === "PARTIALLY_SETTLED") &&
      Number(e.outstandingAmount) > 0,
  );

  const customerMap = new Map<string, CustomerAgingSummary>();

  for (const entry of activeEntries) {
    const cId = entry.customer.id;
    const outstanding = Number(entry.outstandingAmount) || 0;
    const original = Number(entry.originalAmount) || 0;
    const isOverdue = entry.dueDate < referenceDate;

    const overdueDays = isOverdue
      ? calculateDaysBetween(entry.dueDate, referenceDate)
      : 0;
    const overdueMonths = isOverdue
      ? calculateMonthsBetween(entry.dueDate, referenceDate)
      : 0;

    const unitValue = mode === "MONTHS" ? overdueMonths : overdueDays;
    const bucketIndex = classifyAgingBucket(unitValue, sanitizedConfig);

    let summary = customerMap.get(cId);
    if (!summary) {
      summary = {
        customerId: cId,
        customerCode: entry.customer.code,
        customerName: entry.customer.name,
        customerPhone: entry.customer.phone,
        totalOutstanding: 0,
        totalOriginal: 0,
        bucket1Amount: 0,
        bucket2Amount: 0,
        bucket3Amount: 0,
        bucket4Amount: 0,
        overdueAmount: 0,
        overdueRate: 0,
        maxOverdueDays: 0,
        maxOverdueMonths: 0,
        riskLevel: "LOW",
        entries: [],
      };
      customerMap.set(cId, summary);
    }

    summary.totalOutstanding += outstanding;
    summary.totalOriginal += original;
    if (isOverdue) {
      summary.overdueAmount += outstanding;
    }
    summary.maxOverdueDays = Math.max(summary.maxOverdueDays, overdueDays);
    summary.maxOverdueMonths = Math.max(
      summary.maxOverdueMonths,
      overdueMonths,
    );

    if (bucketIndex === 1) summary.bucket1Amount += outstanding;
    else if (bucketIndex === 2) summary.bucket2Amount += outstanding;
    else if (bucketIndex === 3) summary.bucket3Amount += outstanding;
    else if (bucketIndex === 4) summary.bucket4Amount += outstanding;

    summary.entries.push({
      id: entry.id,
      documentNumber: entry.sourceDocument.documentNumber,
      soldAt: entry.sourceDocument.soldAt,
      dueDate: entry.dueDate,
      originalAmount: original,
      outstandingAmount: outstanding,
      overdueDays,
      overdueMonths,
      bucketIndex,
    });
  }

  const customerSummaries = Array.from(customerMap.values()).map((s) => {
    const rate =
      s.totalOutstanding > 0 ? (s.overdueAmount / s.totalOutstanding) * 100 : 0;
    s.overdueRate = Math.round(rate * 10) / 10;

    const testUnit = mode === "MONTHS" ? s.maxOverdueMonths : s.maxOverdueDays;

    if (s.bucket4Amount > 0 || testUnit > sanitizedConfig.tier3) {
      s.riskLevel = "CRITICAL";
    } else if (s.bucket3Amount > 0 || testUnit > sanitizedConfig.tier2) {
      s.riskLevel = "HIGH";
    } else if (s.bucket2Amount > 0 || testUnit > sanitizedConfig.tier1) {
      s.riskLevel = "MEDIUM";
    } else {
      s.riskLevel = "LOW";
    }
    return s;
  });

  customerSummaries.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let bucket1 = 0;
  let bucket2 = 0;
  let bucket3 = 0;
  let bucket4 = 0;

  for (const s of customerSummaries) {
    totalOutstanding += s.totalOutstanding;
    totalOverdue += s.overdueAmount;
    bucket1 += s.bucket1Amount;
    bucket2 += s.bucket2Amount;
    bucket3 += s.bucket3Amount;
    bucket4 += s.bucket4Amount;
  }

  const calcPct = (amt: number) =>
    totalOutstanding > 0 ? Math.round((amt / totalOutstanding) * 1000) / 10 : 0;

  return {
    config: sanitizedConfig,
    totalOutstanding,
    totalOverdue,
    totalCustomers: customerSummaries.length,
    riskCustomersCount: customerSummaries.filter(
      (c) => c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL",
    ).length,
    tierLabels,
    bucketTotals: {
      bucket1,
      bucket2,
      bucket3,
      bucket4,
    },
    bucketPercentages: {
      bucket1: calcPct(bucket1),
      bucket2: calcPct(bucket2),
      bucket3: calcPct(bucket3),
      bucket4: calcPct(bucket4),
    },
    customerSummaries,
  };
}

export function buildDunningNotice(
  customerSummary: CustomerAgingSummary,
  profile?: BusinessProfile | null,
  tone: DunningTone = "FORMAL",
  referenceDate: string = new Date().toISOString().slice(0, 10),
): DunningNoticeViewModel {
  const companyName = profile?.companyName || "工业级进销存中心";
  const contactPerson = profile?.legalName || "财务结算部";
  const contactPhone =
    profile?.phone || profile?.emergencyPhone || "400-800-6688";
  const bankName = "中国工商银行 工业园区支行";
  const bankAccount = "6222 0210 0001 8888 999";

  const totalDue = customerSummary.totalOutstanding;
  const maxOverdueDays = customerSummary.maxOverdueDays;
  const maxOverdueMonths = customerSummary.maxOverdueMonths;

  let letterTitle = "应收账款对账与结算提醒函";
  let letterBody: string[] = [];
  let warningNote = "";

  const overdueDurationStr =
    maxOverdueMonths >= 1
      ? `${maxOverdueMonths} 个月 (${maxOverdueDays} 天)`
      : `${maxOverdueDays} 天`;

  if (tone === "FRIENDLY") {
    letterTitle = "应收账款友好对账提醒函";
    letterBody = [
      `尊敬的 ${customerSummary.customerName} 贵司负责同志：`,
      `感谢贵司长期以来对我司的信任与支持！为确保双方账目清晰准确，特向贵司发送最新未结应收账款明细。`,
      `截至 ${referenceDate}，贵司尚有未结清款项合计 ¥${totalDue.toFixed(2)} 元，包含下列单据明细。`,
      `请贵司财务人员核对无误后，协助安排资金结算。如已付款或对账目有疑问，请及时与我司联系更正。`,
    ];
    warningNote = "温馨提示：如贵司近期已汇款，请忽略本函或联系我司财务核销。";
  } else if (tone === "FORMAL") {
    letterTitle = "应收账款正式催款通知函";
    letterBody = [
      `致：${customerSummary.customerName}`,
      `根据双方签署之销售购销协议及发货验收单据，截至 ${referenceDate}，贵司累计拖欠货款共计人民币 ¥${totalDue.toFixed(2)} 元，最长逾期已达 ${overdueDurationStr}。`,
      `我司曾多次与贵方沟通付款事宜，但截至发函之日上述款项仍未付清。鉴于上述账款已严重超出约定账期，特正式致函催告。`,
      `请贵司于收到本函之日起 3 个工作日内将上述款项全额汇入我司指定账户，以维护双方良好商业信誉与合作关系。`,
    ];
    warningNote =
      "郑重声明：逾期付款可能影响贵司后续订单信用额度审批及发货安排。";
  } else {
    letterTitle = "逾期应收账款法务催收警告函";
    letterBody = [
      `严正致告：${customerSummary.customerName} 法定代表人及经营管理层`,
      `贵司采购我司物资所产生的货款 ¥${totalDue.toFixed(2)} 元已严重逾期达 ${overdueDurationStr}，经我司多次催告仍未履行清偿义务。`,
      `贵司之长期拖欠行为已构成实质性商业违约，严重侵害了我司合法经济权益。`,
      `现限贵司自收到本函之日起 48 小时内全额结清所有拖欠本金及违约利息。逾期未付者，我司将立即启动司法诉讼程序，申请财产保全并主张包括本金、违约金、诉讼费及律师费在内的全部损失。`,
    ];
    warningNote =
      "特别警示：本函已由法务部归档，到期未清偿将正式呈递人民法院诉讼立案。";
  }

  const entries = customerSummary.entries.map((e) => ({
    documentNumber: e.documentNumber,
    soldAt: e.soldAt,
    dueDate: e.dueDate,
    outstandingAmount: e.outstandingAmount,
    overdueDays: e.overdueDays,
    overdueMonths: e.overdueMonths,
  }));

  return {
    companyName,
    contactPerson,
    contactPhone,
    bankName,
    bankAccount,
    customerName: customerSummary.customerName,
    customerPhone: customerSummary.customerPhone || undefined,
    noticeDate: referenceDate,
    tone,
    totalDue,
    maxOverdueDays,
    maxOverdueMonths,
    entries,
    letterTitle,
    letterBody,
    warningNote,
  };
}
