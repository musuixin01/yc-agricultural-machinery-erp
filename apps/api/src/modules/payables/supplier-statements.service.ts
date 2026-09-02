import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type MovementKind =
  | "CREDIT_PURCHASE"
  | "PURCHASE_RETURN"
  | "SUPPLIER_PAYMENT"
  | "PAYMENT_REVERSAL"
  | "ADVANCE_APPLICATION";

type Movement = {
  id: string;
  businessDate: string;
  occurredAt: Date;
  kind: MovementKind;
  label: string;
  documentNumber: string;
  sourceDocumentNumber: string | null;
  increase: Prisma.Decimal;
  decrease: Prisma.Decimal;
  note: string | null;
};

@Injectable()
export class SupplierStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(supplierId: string, dateFrom: string, dateTo: string) {
    const from = this.date(dateFrom);
    const to = this.date(dateTo);
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (spanDays < 0)
      throw new BadRequestException({
        code: "SUPPLIER_STATEMENT_DATE_RANGE_INVALID",
        detail: "对账开始日期不能晚于结束日期。",
      });
    if (spanDays > 366)
      throw new BadRequestException({
        code: "SUPPLIER_STATEMENT_DATE_RANGE_TOO_LARGE",
        detail: "单次对账范围不能超过 366 天，请缩小日期范围。",
      });

    const [
      supplier,
      entries,
      returns,
      paymentLines,
      paymentReversalLines,
      advanceLines,
    ] = await Promise.all([
      this.prisma.party.findFirst({
        where: {
          id: supplierId,
          roles: { some: { type: "SUPPLIER" } },
        },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          contacts: {
            where: { isPrimary: true },
            select: { name: true, phone: true },
            take: 1,
          },
        },
      }),
      this.prisma.payableEntry.findMany({
        where: { supplierId, sourceDocument: { businessDate: { lte: to } } },
        select: {
          id: true,
          originalAmount: true,
          dueDate: true,
          postedAt: true,
          sourceDocument: {
            select: { documentNumber: true, businessDate: true },
          },
        },
      }),
      this.prisma.purchaseReturn.findMany({
        where: {
          supplierId,
          businessDate: { lte: to },
          payableReduction: { gt: 0 },
        },
        select: {
          id: true,
          documentNumber: true,
          businessDate: true,
          returnedAt: true,
          payableReduction: true,
          reason: true,
          sourcePurchaseDocument: { select: { documentNumber: true } },
        },
      }),
      this.prisma.paymentAllocation.findMany({
        where: {
          supplierPayment: {
            supplierId,
            businessDate: { lte: to },
            status: { in: ["POSTED", "REVERSED"] },
          },
        },
        select: {
          id: true,
          amount: true,
          supplierPayment: {
            select: {
              id: true,
              documentNumber: true,
              businessDate: true,
              postedAt: true,
              notes: true,
            },
          },
        },
      }),
      this.prisma.supplierPaymentReversalAllocation.findMany({
        where: { reversal: { supplierId, businessDate: { lte: to } } },
        select: {
          id: true,
          amount: true,
          reversal: {
            select: {
              id: true,
              documentNumber: true,
              businessDate: true,
              reversedAt: true,
              reason: true,
              sourceSupplierPayment: { select: { documentNumber: true } },
            },
          },
        },
      }),
      this.prisma.supplierAdvanceApplicationLine.findMany({
        where: {
          application: {
            businessDate: { lte: to },
            advancePayment: { supplierId },
          },
        },
        select: {
          id: true,
          amount: true,
          application: {
            select: {
              id: true,
              documentNumber: true,
              businessDate: true,
              postedAt: true,
              advancePayment: { select: { documentNumber: true } },
            },
          },
        },
      }),
    ]);
    if (!supplier)
      throw new NotFoundException({
        code: "SUPPLIER_STATEMENT_SUPPLIER_NOT_FOUND",
        detail: "供应商不存在或没有供应商身份。",
      });

    const movements: Movement[] = entries.map((entry) => ({
      id: `purchase:${entry.id}`,
      businessDate: this.isoDate(entry.sourceDocument.businessDate),
      occurredAt: entry.postedAt,
      kind: "CREDIT_PURCHASE",
      label: "采购入库欠款",
      documentNumber: entry.sourceDocument.documentNumber,
      sourceDocumentNumber: null,
      increase: entry.originalAmount,
      decrease: new Prisma.Decimal(0),
      note: `约定付款 ${this.isoDate(entry.dueDate)}`,
    }));

    for (const item of returns)
      movements.push({
        id: `return:${item.id}`,
        businessDate: this.isoDate(item.businessDate),
        occurredAt: item.returnedAt,
        kind: "PURCHASE_RETURN",
        label: "采购退货冲减",
        documentNumber: item.documentNumber,
        sourceDocumentNumber: item.sourcePurchaseDocument.documentNumber,
        increase: new Prisma.Decimal(0),
        decrease: item.payableReduction,
        note: item.reason,
      });

    this.groupLines(
      paymentLines,
      (line) => line.supplierPayment,
      (parent, amount) => ({
        id: `payment:${parent.id}`,
        businessDate: this.isoDate(parent.businessDate),
        occurredAt: parent.postedAt ?? parent.businessDate,
        kind: "SUPPLIER_PAYMENT",
        label: "供应商付款",
        documentNumber: parent.documentNumber,
        sourceDocumentNumber: null,
        increase: new Prisma.Decimal(0),
        decrease: amount,
        note: parent.notes,
      }),
      movements,
    );
    this.groupLines(
      paymentReversalLines,
      (line) => line.reversal,
      (parent, amount) => ({
        id: `payment-reversal:${parent.id}`,
        businessDate: this.isoDate(parent.businessDate),
        occurredAt: parent.reversedAt,
        kind: "PAYMENT_REVERSAL",
        label: "付款反核销",
        documentNumber: parent.documentNumber,
        sourceDocumentNumber: parent.sourceSupplierPayment.documentNumber,
        increase: amount,
        decrease: new Prisma.Decimal(0),
        note: parent.reason,
      }),
      movements,
    );
    this.groupLines(
      advanceLines,
      (line) => line.application,
      (parent, amount) => ({
        id: `advance-application:${parent.id}`,
        businessDate: this.isoDate(parent.businessDate),
        occurredAt: parent.postedAt,
        kind: "ADVANCE_APPLICATION",
        label: "预付款抵扣",
        documentNumber: parent.documentNumber,
        sourceDocumentNumber: parent.advancePayment.documentNumber,
        increase: new Prisma.Decimal(0),
        decrease: amount,
        note: null,
      }),
      movements,
    );

    movements.sort(
      (a, b) =>
        a.businessDate.localeCompare(b.businessDate) ||
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    const openingBalance = this.balance(
      movements.filter((item) => item.businessDate < dateFrom),
    );
    const items = movements.filter(
      (item) => item.businessDate >= dateFrom && item.businessDate <= dateTo,
    );
    const increases = this.sum(items.map((item) => item.increase));
    const decreases = this.sum(items.map((item) => item.decrease));
    const closingBalance = openingBalance.add(increases).sub(decreases);
    let running = openingBalance;

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        phone: supplier.contacts[0]?.phone ?? null,
        contactName: supplier.contacts[0]?.name ?? null,
        address: supplier.address,
      },
      period: { dateFrom, dateTo },
      summary: {
        openingBalance: openingBalance.toString(),
        increases: increases.toString(),
        decreases: decreases.toString(),
        closingBalance: closingBalance.toString(),
      },
      items: items.map((item) => {
        running = running.add(item.increase).sub(item.decrease);
        return {
          id: item.id,
          businessDate: item.businessDate,
          kind: item.kind,
          label: item.label,
          documentNumber: item.documentNumber,
          sourceDocumentNumber: item.sourceDocumentNumber,
          increase: item.increase.toString(),
          decrease: item.decrease.toString(),
          balance: running.toString(),
          note: item.note,
        };
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  private groupLines<
    T extends { amount: Prisma.Decimal },
    P extends { id: string },
  >(
    lines: T[],
    parentOf: (line: T) => P,
    movementOf: (parent: P, amount: Prisma.Decimal) => Movement,
    target: Movement[],
  ) {
    const grouped = new Map<string, { parent: P; amount: Prisma.Decimal }>();
    for (const line of lines) {
      const parent = parentOf(line);
      const current = grouped.get(parent.id);
      grouped.set(parent.id, {
        parent,
        amount: (current?.amount ?? new Prisma.Decimal(0)).add(line.amount),
      });
    }
    for (const value of grouped.values())
      target.push(movementOf(value.parent, value.amount));
  }

  private balance(items: Movement[]) {
    return this.sum(items.map((item) => item.increase)).sub(
      this.sum(items.map((item) => item.decrease)),
    );
  }

  private sum(values: Prisma.Decimal[]) {
    return values.reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));
  }

  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private isoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
