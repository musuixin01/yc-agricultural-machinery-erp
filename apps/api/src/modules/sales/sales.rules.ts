import { Prisma } from "../../generated/prisma/client.js";

const MONEY_SCALE = 4;

export function salesPostingEffects(settlementType: "IMMEDIATE" | "CREDIT") {
  return {
    createCashInflow: settlementType === "IMMEDIATE",
    createReceivable: settlementType === "CREDIT",
  } as const;
}

export function calculateSalesLineAmount(quantity: string, unitPrice: string) {
  return new Prisma.Decimal(quantity)
    .mul(unitPrice)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateSalesCost(
  quantity: Prisma.Decimal,
  averageCost: Prisma.Decimal,
) {
  return quantity
    .mul(averageCost)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateGrossProfit(
  salesAmount: Prisma.Decimal,
  costAmount: Prisma.Decimal,
) {
  return salesAmount
    .sub(costAmount)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}
