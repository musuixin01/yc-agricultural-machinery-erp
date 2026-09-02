import { Prisma } from "../../generated/prisma/client.js";

export function nextReceivableStatus(outstanding: Prisma.Decimal) {
  return outstanding.eq(0) ? "SETTLED" : "PARTIALLY_SETTLED";
}

export function restoredReceivableStatus(
  outstanding: Prisma.Decimal,
  original: Prisma.Decimal,
) {
  return outstanding.eq(original) ? "OPEN" : "PARTIALLY_SETTLED";
}

export function sumReceiptAllocations(amounts: string[]) {
  return amounts.reduce(
    (sum, amount) => sum.add(new Prisma.Decimal(amount)),
    new Prisma.Decimal(0),
  );
}
