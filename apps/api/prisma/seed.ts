import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const units = [
  { code: "PCS", name: "个", decimalScale: 0 },
  { code: "PIECE", name: "片", decimalScale: 0 },
  { code: "SET", name: "台", decimalScale: 0 },
  { code: "BOX", name: "箱", decimalScale: 0 },
];
const categories = [
  { code: "MACHINE", name: "农机整机", sortOrder: 10 },
  { code: "PART", name: "农机配件", sortOrder: 20 },
  { code: "FASTENER", name: "螺丝标准件", sortOrder: 30 },
  { code: "CONSUMABLE", name: "油品耗材", sortOrder: 40 },
];
const brands = [
  { code: "DFH", name: "东方红" },
  { code: "LOVOL", name: "雷沃" },
  { code: "GENERIC", name: "通用" },
];

async function seed() {
  for (const item of units)
    await prisma.unit.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  for (const item of categories)
    await prisma.productCategory.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  for (const item of brands)
    await prisma.brand.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });

  const refs = {
    unit: Object.fromEntries(
      (await prisma.unit.findMany()).map((x) => [x.code, x.id]),
    ),
    category: Object.fromEntries(
      (await prisma.productCategory.findMany()).map((x) => [x.code, x.id]),
    ),
    brand: Object.fromEntries(
      (await prisma.brand.findMany()).map((x) => [x.code, x.id]),
    ),
  };
  const products = [
    {
      code: "ZJ-DFH-LX904",
      name: "东方红 LX904 拖拉机",
      type: "MACHINE" as const,
      model: "LX904",
      categoryId: refs.category.MACHINE,
      brandId: refs.brand.DFH,
      baseUnitId: refs.unit.SET,
      retailPrice: "126800",
      safetyStock: "1",
      barcode: "ZJDFHLX904",
    },
    {
      code: "PJ-XG-0245",
      name: "旋耕机刀片 245 型",
      type: "PART" as const,
      specification: "锰钢 / 右弯",
      categoryId: refs.category.PART,
      brandId: refs.brand.GENERIC,
      baseUnitId: refs.unit.PIECE,
      retailPrice: "28",
      safetyStock: "100",
      barcode: "PXXG0245",
    },
    {
      code: "LS-M12-045",
      name: "高强度螺栓 M12×45",
      type: "STANDARD_PART" as const,
      specification: "10.9 级 / 镀锌",
      categoryId: refs.category.FASTENER,
      brandId: refs.brand.GENERIC,
      baseUnitId: refs.unit.PCS,
      retailPrice: "1.80",
      safetyStock: "500",
      barcode: "LSM12045",
    },
    {
      code: "PJ-LX-0708",
      name: "柴油滤芯 CX0708",
      type: "CONSUMABLE" as const,
      model: "CX0708",
      categoryId: refs.category.CONSUMABLE,
      brandId: refs.brand.GENERIC,
      baseUnitId: refs.unit.PCS,
      retailPrice: "36",
      safetyStock: "30",
      barcode: "PJLX0708",
    },
  ];
  for (const { barcode, ...product } of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: product,
      create: {
        ...product,
        barcodes: { create: { barcode, isPrimary: true } },
      },
    });
  }
}

seed().finally(() => prisma.$disconnect());
