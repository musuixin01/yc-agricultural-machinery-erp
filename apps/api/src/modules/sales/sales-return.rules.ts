import { Prisma } from "../../generated/prisma/client.js";

export function calculateReturnSettlement(
  settlementType: "IMMEDIATE" | "CREDIT",
  totalAmount: Prisma.Decimal,
  outstandingAmount: Prisma.Decimal,
) {
  const receivableReduction =
    settlementType === "CREDIT"
      ? Prisma.Decimal.min(totalAmount, outstandingAmount)
      : new Prisma.Decimal(0);
  return {
    receivableReduction,
    refundAmount: totalAmount.sub(receivableReduction),
  };
}

export function remainingReturnQuantity(
  soldQuantity: Prisma.Decimal,
  returnedQuantity: Prisma.Decimal,
) {
  return soldQuantity.sub(returnedQuantity);
}
