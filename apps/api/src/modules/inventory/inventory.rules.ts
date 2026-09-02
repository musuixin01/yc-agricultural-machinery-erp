import { Prisma } from "../../generated/prisma/client.js";

export type InventoryWorkflowStatus =
  "DRAFT" | "SUBMITTED" | "POSTED" | "REVERSED" | "CANCELLED";

export function canInventoryTransition(
  from: InventoryWorkflowStatus,
  to: InventoryWorkflowStatus,
) {
  return (
    (from === "DRAFT" && (to === "SUBMITTED" || to === "CANCELLED")) ||
    (from === "SUBMITTED" && (to === "POSTED" || to === "DRAFT")) ||
    (from === "POSTED" && to === "REVERSED")
  );
}

export function calculateLineAmount(quantity: string, unitCost: string) {
  return new Prisma.Decimal(quantity)
    .mul(new Prisma.Decimal(unitCost))
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function canEstablishInitialStock(
  existingLedgerEntries: number,
  quantity: string,
) {
  return (
    existingLedgerEntries === 0 && new Prisma.Decimal(quantity).greaterThan(0)
  );
}

export function calculateStocktakeVariance(
  baselineQuantity: string,
  countedQuantity: string,
) {
  return new Prisma.Decimal(countedQuantity).sub(
    new Prisma.Decimal(baselineQuantity),
  );
}

export function calculateStocktakeCost(
  countedQuantity: string,
  baselineAverageCost: string,
  baselineTotalCost: string,
) {
  const nextTotalCost = new Prisma.Decimal(countedQuantity)
    .mul(new Prisma.Decimal(baselineAverageCost))
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  return {
    nextTotalCost,
    costChange: nextTotalCost.sub(new Prisma.Decimal(baselineTotalCost)),
  };
}

export function calculateInventoryDamageCost(
  quantity: string,
  balanceQuantity: string,
  balanceTotalCost: string,
  balanceAverageCost: string,
) {
  const issueQuantity = new Prisma.Decimal(quantity);
  const currentQuantity = new Prisma.Decimal(balanceQuantity);
  return issueQuantity.eq(currentQuantity)
    ? new Prisma.Decimal(balanceTotalCost)
    : new Prisma.Decimal(balanceAverageCost)
        .mul(issueQuantity)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}
