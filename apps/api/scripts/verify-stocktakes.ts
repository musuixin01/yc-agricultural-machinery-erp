import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { StocktakeService } from "../src/modules/inventory/stocktake.service.js";

const prisma = new PrismaService();
const inventory = new InventoryService(prisma);
const stocktakes = new StocktakeService(prisma);

async function verify() {
  const actor = await prisma.user.create({
    data: {
      username: "stocktake-verifier",
      displayName: "盘点验证员",
      passwordHash: "not-used-in-verification",
    },
  });
  const unit = await prisma.unit.findFirstOrThrow({ where: { code: "PCS" } });
  const category = await prisma.productCategory.findFirstOrThrow({
    where: { code: "PART" },
  });
  const product = await prisma.product.create({
    data: {
      code: "VERIFY-STOCKTAKE",
      name: "盘点验证商品",
      type: "PART",
      categoryId: category.id,
      baseUnitId: unit.id,
      retailPrice: "10",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "VERIFY-ST-WH", name: "盘点验证仓" },
  });
  const authenticatedActor = {
    id: actor.id,
    username: actor.username,
    displayName: actor.displayName,
    roles: ["OWNER"],
    permissions: ["inventory.post"],
    sessionId: "stocktake-verification-session",
  };
  await inventory.createInitialStock(
    {
      productId: product.id,
      warehouseId: warehouse.id,
      businessDate: "2026-09-02",
      quantity: "10",
      unitCost: "5",
    },
    "verify-stocktake-initial-0001",
    authenticatedActor,
  );

  const draft = await stocktakes.create(
    { warehouseId: warehouse.id, businessDate: "2026-09-02" },
    authenticatedActor,
  );
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.lines.length, 1);
  assert.equal(draft.lines[0].baselineQuantity, "10");

  const counted = await stocktakes.saveCounts(
    draft.id,
    {
      version: draft.version,
      lines: [
        {
          lineId: draft.lines[0].id,
          countedQuantity: "8",
          reason: "验证盘亏",
        },
      ],
    },
    authenticatedActor,
  );
  const submitted = await stocktakes.submit(
    counted.id,
    counted.version,
    authenticatedActor,
  );
  const idempotencyKey = "verify-stocktake-post-0001";
  const posted = await stocktakes.post(
    submitted.id,
    idempotencyKey,
    authenticatedActor,
  );
  const retry = await stocktakes.post(
    submitted.id,
    idempotencyKey,
    authenticatedActor,
  );
  assert.equal(posted.id, retry.id);
  assert.equal(posted.status, "POSTED");

  const [balance, entries, requestCount, auditCount, outboxCount] =
    await Promise.all([
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.inventoryLedgerEntry.findMany({
        where: { sourceDocumentId: posted.id },
      }),
      prisma.inventoryStocktakePostingRequest.count({
        where: { idempotencyKey },
      }),
      prisma.auditEvent.count({
        where: { action: "inventory.stocktake.post", entityId: posted.id },
      }),
      prisma.outboxEvent.count({
        where: {
          eventType: "inventory.stocktake.posted",
          aggregateId: posted.id,
        },
      }),
    ]);
  assert.equal(balance.quantity.toString(), "8");
  assert.equal(balance.totalCost.toString(), "40");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].quantityChange.toString(), "-2");
  assert.equal(entries[0].costAmount.toString(), "-10");
  assert.equal(requestCount, 1);
  assert.equal(auditCount, 1);
  assert.equal(outboxCount, 1);

  const staleDraft = await stocktakes.create(
    { warehouseId: warehouse.id, businessDate: "2026-09-02" },
    authenticatedActor,
  );
  const staleCounted = await stocktakes.saveCounts(
    staleDraft.id,
    {
      version: staleDraft.version,
      lines: [
        {
          lineId: staleDraft.lines[0].id,
          countedQuantity: "8",
          reason: "无差异",
        },
      ],
    },
    authenticatedActor,
  );
  const staleSubmitted = await stocktakes.submit(
    staleCounted.id,
    staleCounted.version,
    authenticatedActor,
  );
  await prisma.inventoryBalance.update({
    where: { id: balance.id },
    data: { version: { increment: 1 } },
  });
  await assert.rejects(
    () =>
      stocktakes.post(
        staleSubmitted.id,
        "verify-stocktake-stale-0001",
        authenticatedActor,
      ),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.equal(
    await prisma.inventoryLedgerEntry.count({
      where: { sourceDocumentId: staleSubmitted.id },
    }),
    0,
  );
  assert.equal(
    (
      await prisma.inventoryStocktake.findUniqueOrThrow({
        where: { id: staleSubmitted.id },
      })
    ).status,
    "SUBMITTED",
  );

  console.log(
    "库存盘点验证通过：实盘差异过账、余额与流水一致、幂等重试不重复、过期快照整笔回滚。",
  );
}

verify().finally(() => prisma.$disconnect());
