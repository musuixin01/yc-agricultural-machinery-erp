import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import { SupplierStatementsService } from "../src/modules/payables/supplier-statements.service.js";

const decimal = (value: string | number) => new Prisma.Decimal(value);
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function prismaFixture() {
  return {
    party: {
      findFirst: vi.fn().mockResolvedValue({
        id: "supplier-1",
        code: "GYS-001",
        name: "宏达农机",
        address: "测试地址",
        contacts: [{ name: "李经理", phone: "13800000000" }],
      }),
    },
    payableEntry: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "entry-opening",
          originalAmount: decimal(100),
          dueDate: day("2026-08-31"),
          postedAt: day("2026-08-01"),
          sourceDocument: {
            documentNumber: "CG-OPENING",
            businessDate: day("2026-08-01"),
          },
        },
        {
          id: "entry-period",
          originalAmount: decimal(200),
          dueDate: day("2026-10-01"),
          postedAt: day("2026-09-01"),
          sourceDocument: {
            documentNumber: "CG-2026-000001",
            businessDate: day("2026-09-01"),
          },
        },
      ]),
    },
    purchaseReturn: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "return-1",
          documentNumber: "CT-2026-000001",
          businessDate: day("2026-09-03"),
          returnedAt: day("2026-09-03"),
          payableReduction: decimal(25),
          reason: "商品退回",
          sourcePurchaseDocument: { documentNumber: "CG-2026-000001" },
        },
      ]),
    },
    paymentAllocation: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "allocation-1",
          amount: decimal(20),
          supplierPayment: {
            id: "payment-1",
            documentNumber: "FK-2026-000001",
            businessDate: day("2026-09-02"),
            postedAt: day("2026-09-02"),
            notes: "银行付款",
          },
        },
        {
          id: "allocation-2",
          amount: decimal(30),
          supplierPayment: {
            id: "payment-1",
            documentNumber: "FK-2026-000001",
            businessDate: day("2026-09-02"),
            postedAt: day("2026-09-02"),
            notes: "银行付款",
          },
        },
      ]),
    },
    supplierPaymentReversalAllocation: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "reversal-line-1",
          amount: decimal(10),
          reversal: {
            id: "payment-reversal-1",
            documentNumber: "FF-2026-000001",
            businessDate: day("2026-09-04"),
            reversedAt: day("2026-09-04"),
            reason: "付款录错",
            sourceSupplierPayment: { documentNumber: "FK-2026-000001" },
          },
        },
      ]),
    },
    supplierAdvanceApplicationLine: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "advance-line-1",
          amount: decimal(15),
          application: {
            id: "advance-application-1",
            documentNumber: "YFK-DK-2026-000001",
            businessDate: day("2026-09-05"),
            postedAt: day("2026-09-05"),
            advancePayment: { documentNumber: "YFK-2026-000001" },
          },
        },
      ]),
    },
  };
}

describe("SupplierStatementsService", () => {
  it("按采购、付款、退货、反核销和预付款抵扣重建余额", async () => {
    const service = new SupplierStatementsService(prismaFixture() as never);

    const result = await service.get(
      "11111111-1111-4111-8111-111111111111",
      "2026-09-01",
      "2026-09-30",
    );

    expect(result.summary).toEqual({
      openingBalance: "100",
      increases: "210",
      decreases: "90",
      closingBalance: "220",
    });
    expect(result.items).toHaveLength(5);
    expect(
      result.items.find((item) => item.kind === "SUPPLIER_PAYMENT"),
    ).toMatchObject({ decrease: "50", balance: "250" });
    expect(result.items.at(-1)).toMatchObject({
      kind: "ADVANCE_APPLICATION",
      balance: "220",
    });
  });

  it("拒绝超过 366 天的查询范围", async () => {
    const service = new SupplierStatementsService(prismaFixture() as never);
    await expect(
      service.get(
        "11111111-1111-4111-8111-111111111111",
        "2025-01-01",
        "2026-09-01",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
