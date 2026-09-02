import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";

const prisma = new PrismaService();
const service = new InventoryService(prisma);

async function verify() {
  const actor = await prisma.user.create({
    data: {
      username: "initial-stock-verifier",
      displayName: "建档入库验证员",
      passwordHash: "not-used-in-verification",
    },
  });
  const unit = await prisma.unit.findFirstOrThrow({ where: { code: "PCS" } });
  const category = await prisma.productCategory.findFirstOrThrow({
    where: { code: "PART" },
  });
  const product = await prisma.product.create({
    data: {
      code: "VERIFY-INITIAL-STOCK",
      name: "建档入库验证商品",
      type: "PART",
      categoryId: category.id,
      baseUnitId: unit.id,
      retailPrice: "12.50",
      safetyStock: "2",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      code: "VERIFY-WH",
      name: "建档入库验证仓",
    },
  });
  const authenticatedActor = {
    id: actor.id,
    username: actor.username,
    displayName: actor.displayName,
    roles: ["OWNER"],
    permissions: ["inventory.post"],
    sessionId: "verification-session",
  };
  const input = {
    productId: product.id,
    warehouseId: warehouse.id,
    businessDate: "2026-08-31",
    quantity: "7",
    unitCost: "8.7654",
  };
  const idempotencyKey = "verify-initial-stock-0001";
  const first = await service.createInitialStock(
    input,
    idempotencyKey,
    authenticatedActor,
  );
  const retry = await service.createInitialStock(
    input,
    idempotencyKey,
    authenticatedActor,
  );
  assert.equal(first.id, retry.id);
  assert.equal(first.status, "POSTED");
  assert.equal(first.type, "INITIAL_STOCK");

  const [balance, ledgerCount, requestCount, auditCount, outboxCount] =
    await Promise.all([
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.inventoryLedgerEntry.count({
        where: { productId: product.id, warehouseId: warehouse.id },
      }),
      prisma.inventoryPostingRequest.count({ where: { idempotencyKey } }),
      prisma.auditEvent.count({
        where: { action: "inventory.initial_stock.post" },
      }),
      prisma.outboxEvent.count({
        where: { eventType: "inventory.initial_stock.posted" },
      }),
    ]);
  assert.equal(balance.quantity.toString(), "7");
  assert.equal(balance.averageCost.toString(), "8.7654");
  assert.equal(balance.totalCost.toString(), "61.3578");
  assert.equal(ledgerCount, 1);
  assert.equal(requestCount, 1);
  assert.equal(auditCount, 1);
  assert.equal(outboxCount, 1);

  await assert.rejects(
    () =>
      service.createInitialStock(
        input,
        "verify-initial-stock-0002",
        authenticatedActor,
      ),
    (error: unknown) => error instanceof ConflictException,
  );
  console.log(
    "建档入库验证通过：一次正式入库、幂等重试不重复、重复建档被拒绝。",
  );
}

verify().finally(() => prisma.$disconnect());
