import { Prisma } from "../../generated/prisma/client.js";

export function sumAllocations(amounts: string[]) {
  return amounts.reduce(
    (sum, amount) => sum.add(new Prisma.Decimal(amount)),
    new Prisma.Decimal(0),
  );
}

export function nextPayableStatus(outstanding: Prisma.Decimal) {
  return outstanding.eq(0) ? "SETTLED" : "PARTIALLY_SETTLED";
}

export function restoredPayableStatus(
  outstanding: Prisma.Decimal,
  original: Prisma.Decimal,
) {
  return outstanding.eq(original) ? "OPEN" : "PARTIALLY_SETTLED";
}
