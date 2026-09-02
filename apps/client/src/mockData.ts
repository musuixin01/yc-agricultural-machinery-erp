export type Screen =
  | "dashboard"
  | "sales"
  | "purchasing"
  | "payables"
  | "inventory"
  | "stock"
  | "warehouses"
  | "parties"
  | "debts"
  | "staff";

export const metrics = [
  { label: "今日销售", value: "¥ 18,640", delta: "+12.8%", tone: "green" },
  { label: "今日收款", value: "¥ 12,380", delta: "4 笔待核销", tone: "blue" },
  {
    label: "客户欠款",
    value: "¥ 86,420",
    delta: "逾期 ¥ 18,960",
    tone: "amber",
  },
  {
    label: "库存金额",
    value: "¥ 428,760",
    delta: "38 项低库存",
    tone: "violet",
  },
] as const;

export const quickProducts = [
  {
    name: "东方红 LX904 拖拉机",
    sku: "ZJ-DFH-LX904",
    stock: "2 台",
    price: "¥ 126,800",
    tag: "整机",
    color: "#dfe9df",
  },
  {
    name: "旋耕机刀片 245 型",
    sku: "PJ-XG-0245",
    stock: "86 片",
    price: "¥ 28",
    tag: "配件",
    color: "#e8e1d4",
  },
  {
    name: "高强度螺栓 M12×45",
    sku: "LS-M12-045",
    stock: "1,260 个",
    price: "¥ 1.80",
    tag: "标准件",
    color: "#dfe5ea",
  },
  {
    name: "柴油滤芯 CX0708",
    sku: "PJ-LX-0708",
    stock: "24 个",
    price: "¥ 36",
    tag: "易损件",
    color: "#e5e1d9",
  },
] as const;

export const activities = [
  {
    time: "09:42",
    title: "销售单 XS-20260812-0018",
    meta: "王建国 · ¥ 3,860 · 微信收款",
    type: "sale",
  },
  {
    time: "09:18",
    title: "采购入库 CG-20260812-0006",
    meta: "宏达农机配件 · 46 项商品",
    type: "purchase",
  },
  {
    time: "08:56",
    title: "客户收款 SK-20260812-0009",
    meta: "李明农场 · ¥ 8,000 · 核销 2 笔",
    type: "payment",
  },
  {
    time: "08:31",
    title: "库存预警",
    meta: "柴油滤芯 CX0708 低于安全库存",
    type: "warning",
  },
] as const;

export const debts = [
  {
    name: "李明农场",
    amount: "¥ 18,600",
    due: "逾期 23 天",
    contact: "138****2268",
    level: "danger",
  },
  {
    name: "王建国",
    amount: "¥ 12,350",
    due: "7 天后到期",
    contact: "136****5071",
    level: "warning",
  },
  {
    name: "丰收合作社",
    amount: "¥ 9,820",
    due: "今日到期",
    contact: "159****3046",
    level: "warning",
  },
  {
    name: "赵师傅",
    amount: "¥ 6,400",
    due: "正常账期",
    contact: "137****8853",
    level: "safe",
  },
] as const;

export const salesLines = [
  {
    name: "旋耕机刀片 245 型",
    spec: "锰钢 / 右弯",
    qty: 12,
    unit: "片",
    price: 28,
    total: 336,
  },
  {
    name: "高强度螺栓 M12×45",
    spec: "10.9 级 / 镀锌",
    qty: 50,
    unit: "个",
    price: 1.8,
    total: 90,
  },
  {
    name: "柴油滤芯 CX0708",
    spec: "适配东方红 / 雷沃",
    qty: 2,
    unit: "个",
    price: 36,
    total: 72,
  },
] as const;
