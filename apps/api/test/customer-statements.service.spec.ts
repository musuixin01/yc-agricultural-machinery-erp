import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../src/generated/prisma/client.js";
import { CustomerStatementsService } from "../src/modules/receivables/customer-statements.service.js";

const decimal = (value: string | number) => new Prisma.Decimal(value);
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function prismaFixture() {
  return {
    party: {
      findFirst: vi.fn().mockResolvedValue({
        id: "customer-1",
        code: "KH-001",
        name: "王师傅",
        address: "测试地址",
        contacts: [{ name: "王师傅", phone: "13800000000" }],
      }),
    },
    receivableEntry: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "entry-opening",
          originalAmount: decimal(100),
          dueDate: day("2026-08-31"),
          postedAt: day("2026-08-01"),
          sourceDocument: {
            documentNumber: "XS-OPENING",
            businessDate: day("2026-08-01"),
            soldAt: day("2026-08-01"),
          },
        },
        {
          id: "entry-period",
          originalAmount: decimal(200),
          dueDate: day("2026-10-01"),
          postedAt: day("2026-09-01"),
          sourceDocument: {
            documentNumber: "XS-2026-000001",
            businessDate: day("2026-09-01"),
            soldAt: day("2026-09-01"),
          },
        },
      ]),
    },
    salesReturn: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "return-1",
          documentNumber: "XT-2026-000001",
          businessDate: day("2026-09-03"),
          returnedAt: day("2026-09-03"),
          receivableReduction: decimal(25),
          reason: "商品退回",
          sourceSalesDocument: { documentNumber: "XS-2026-000001" },
        },
      ]),
    },
    salesReversal: { findMany: vi.fn().mockResolvedValue([]) },
    receiptAllocation: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "allocation-1",
          amount: decimal(20),
          customerReceipt: {
            id: "receipt-1",
            documentNumber: "SK-2026-000001",
            businessDate: day("2026-09-02"),
            postedAt: day("2026-09-02"),
            notes: "微信收款",
          },
        },
        {
          id: "allocation-2",
          amount: decimal(30),
          customerReceipt: {
            id: "receipt-1",
            documentNumber: "SK-2026-000001",
            businessDate: day("2026-09-02"),
            postedAt: day("2026-09-02"),
            notes: "微信收款",
          },
        },
      ]),
    },
    customerReceiptReversalAllocation: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "reversal-line-1",
          amount: decimal(10),
          reversal: {
            id: "receipt-reversal-1",
            documentNumber: "SF-2026-000001",
            businessDate: day("2026-09-04"),
            reversedAt: day("2026-09-04"),
            reason: "收款录错",
            sourceCustomerReceipt: { documentNumber: "SK-2026-000001" },
          },
        },
      ]),
    },
    customerAdvanceApplicationLine: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "advance-line-1",
          amount: decimal(15),
          application: {
            id: "advance-application-1",
            documentNumber: "YSK-DK-2026-000001",
            businessDate: day("2026-09-05"),
            postedAt: day("2026-09-05"),
            advanceReceipt: { documentNumber: "YSK-2026-000001" },
          },
        },
      ]),
    },
  };
}

describe("CustomerStatementsService", () => {
  it("按正式发生、收款、退货、反核销和预收抵扣重建余额", async () => {
    const prisma = prismaFixture();
    const service = new CustomerStatementsService(prisma as never);

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
      result.items.find((item) => item.kind === "CUSTOMER_RECEIPT"),
    ).toMatchObject({ decrease: "50", balance: "250" });
    expect(result.items.at(-1)).toMatchObject({
      kind: "ADVANCE_APPLICATION",
      balance: "220",
    });
  });

  it("拒绝超过 366 天的查询范围", async () => {
    const service = new CustomerStatementsService(prismaFixture() as never);
    await expect(
      service.get(
        "11111111-1111-4111-8111-111111111111",
        "2025-01-01",
        "2026-09-01",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
