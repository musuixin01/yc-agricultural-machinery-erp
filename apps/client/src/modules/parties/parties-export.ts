import type { Party } from "./parties-api";

export function exportPartiesToCsv(
  parties: Party[],
  filenamePrefix = "往来单位档案",
) {
  const headers = [
    "单位编码",
    "单位名称",
    "简称",
    "业务身份",
    "主要联系人",
    "手机/电话",
    "电子邮箱",
    "信用额度(元)",
    "默认账期(天)",
    "省份",
    "城市",
    "详细地址",
    "统一社会信用代码",
    "状态",
  ];

  const rows = parties.map((p) => {
    const primary = p.contacts?.find((c) => c.isPrimary) || p.contacts?.[0];
    const roleStr =
      p.roles.includes("CUSTOMER") && p.roles.includes("SUPPLIER")
        ? "客户·供应商"
        : p.roles.includes("CUSTOMER")
          ? "客户"
          : "供应商";

    return [
      `"${(p.code || "").replace(/"/g, '""')}"`,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${(p.shortName || "").replace(/"/g, '""')}"`,
      `"${roleStr}"`,
      `"${(primary?.name || "").replace(/"/g, '""')}"`,
      `"${(primary?.phone || (p as any).phone || "").replace(/"/g, '""')}"`,
      `"${(primary?.email || "").replace(/"/g, '""')}"`,
      p.creditLimit || "0.00",
      p.paymentTermsDays || "0",
      `"${(p.province || "").replace(/"/g, '""')}"`,
      `"${(p.city || "").replace(/"/g, '""')}"`,
      `"${(p.address || "").replace(/"/g, '""')}"`,
      `"${(p.taxId || "").replace(/"/g, '""')}"`,
      p.status === "ACTIVE" ? "正常" : "已停用",
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
