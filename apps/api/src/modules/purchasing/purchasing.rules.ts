import { Prisma } from "../../generated/prisma/client.js";
import { calculateLineAmount } from "../inventory/inventory.rules.js";

export { calculateLineAmount };

export function calculateMovingAverage(
  currentQuantity: Prisma.Decimal,
  currentTotalCost: Prisma.Decimal,
  incomingQuantity: Prisma.Decimal,
  incomingAmount: Prisma.Decimal,
) {
  const quantity = currentQuantity.add(incomingQuantity);
  const totalCost = currentTotalCost.add(incomingAmount);
  if (quantity.lte(0)) return new Prisma.Decimal(0);
  return totalCost
    .div(quantity)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function remainingPurchaseReturnQuantity(
  purchased: Prisma.Decimal,
  returned: Prisma.Decimal,
) {
  return Prisma.Decimal.max(purchased.sub(returned), 0);
}

export function calculatePurchaseReturnSettlement(
  totalAmount: Prisma.Decimal,
  outstanding: Prisma.Decimal,
) {
  const payableReduction = Prisma.Decimal.min(totalAmount, outstanding);
  return {
    payableReduction,
    refundAmount: totalAmount.sub(payableReduction),
  };
}
