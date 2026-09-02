import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { InventoryDamageService } from "../src/modules/inventory/inventory-damage.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";

const prisma = new PrismaService();
const inventory = new InventoryService(prisma);
const damages = new InventoryDamageService(prisma);

async function verify() {
  const actor = await prisma.user.create({
    data: {
      username: "damage-verifier",
      displayName: "报损验证员",
      passwordHash: "not-used-in-verification",
    },
  });
  const unit = await prisma.unit.findFirstOrThrow({ where: { code: "PCS" } });
  const category = await prisma.productCategory.findFirstOrThrow({
    where: { code: "PART" },
  });
  const warehouse = await prisma.warehouse.create({
    data: { code: "VERIFY-DAMAGE-WH", name: "报损验证仓" },
  });
  const products = await Promise.all(
    ["A", "B"].map((suffix) =>
      prisma.product.create({
        data: {
          code: `VERIFY-DAMAGE-${suffix}`,
          name: `报损验证商品${suffix}`,
          type: "PART",
          categoryId: category.id,
          baseUnitId: unit.id,
          retailPrice: "10",
        },
      }),
    ),
  );
  const authenticatedActor = {
    id: actor.id,
    username: actor.username,
    displayName: actor.displayName,
    roles: ["OWNER"],
    permissions: ["inventory.post"],
    sessionId: "damage-verification-session",
  };
  await inventory.createInitialStock(
    {
      productId: products[0].id,
      warehouseId: warehouse.id,
      businessDate: "2026-09-02",
      quantity: "10",
      unitCost: "5",
    },
    "verify-damage-initial-a-0001",
    authenticatedActor,
  );
  await inventory.createInitialStock(
    {
      productId: products[1].id,
      warehouseId: warehouse.id,
      businessDate: "2026-09-02",
      quantity: "1",
      unitCost: "8",
    },
    "verify-damage-initial-b-0001",
    authenticatedActor,
  );

  const draft = await damages.create(
    {
      warehouseId: warehouse.id,
      businessDate: "2026-09-02",
      lines: [
        {
          productId: products[0].id,
          quantity: "3",
          reason: "DAMAGED",
          reasonDetail: "外壳破损",
        },
      ],
    },
    authenticatedActor,
  );
  assert.equal(draft.status, "DRAFT");
  const submitted = await damages.submit(
    draft.id,
    draft.version,
    authenticatedActor,
  );
  const idempotencyKey = "verify-damage-post-0001";
  const posted = await damages.post(
    submitted.id,
    idempotencyKey,
    authenticatedActor,
  );
  const retry = await damages.post(
    submitted.id,
    idempotencyKey,
    authenticatedActor,
  );
  assert.equal(posted.id, retry.id);
  assert.equal(posted.status, "POSTED");
  assert.equal(posted.totalCost, "15");

  const [balanceA, entries, requestCount, auditCount, outboxCount] =
    await Promise.all([
      prisma.inventoryBalance.findUniqueOrThrow({
        where: {
          productId_warehouseId: {
            productId: products[0].id,
            warehouseId: warehouse.id,
          },
        },
      }),
      prisma.inventoryLedgerEntry.findMany({
        where: { sourceDocumentId: posted.id },
      }),
      prisma.inventoryDamagePostingRequest.count({
        where: { idempotencyKey },
      }),
      prisma.auditEvent.count({
        where: { action: "inventory.damage.post", entityId: posted.id },
      }),
      prisma.outboxEvent.count({
        where: {
          eventType: "inventory.damage.posted",
          aggregateId: posted.id,
        },
      }),
    ]);
  assert.equal(balanceA.quantity.toString(), "7");
  assert.equal(balanceA.totalCost.toString(), "35");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].quantityChange.toString(), "-3");
  assert.equal(entries[0].costAmount.toString(), "-15");
  assert.equal(requestCount, 1);
  assert.equal(auditCount, 1);
  assert.equal(outboxCount, 1);

  const conflictDraft = await damages.create(
    {
      warehouseId: warehouse.id,
      businessDate: "2026-09-02",
      lines: [
        {
          productId: products[0].id,
          quantity: "1",
          reason: "RUSTED",
        },
        {
          productId: products[1].id,
          quantity: "2",
          reason: "DAMAGED",
        },
      ],
    },
    authenticatedActor,
  );
  const conflictSubmitted = await damages.submit(
    conflictDraft.id,
    conflictDraft.version,
    authenticatedActor,
  );
  await assert.rejects(
    () =>
      damages.post(
        conflictSubmitted.id,
        "verify-damage-conflict-0001",
        authenticatedActor,
      ),
    (error: unknown) => error instanceof ConflictException,
  );
  const unchangedBalance = await prisma.inventoryBalance.findUniqueOrThrow({
    where: {
      productId_warehouseId: {
        productId: products[0].id,
        warehouseId: warehouse.id,
      },
    },
  });
  assert.equal(unchangedBalance.quantity.toString(), "7");
  assert.equal(
    await prisma.inventoryLedgerEntry.count({
      where: { sourceDocumentId: conflictSubmitted.id },
    }),
    0,
  );
  assert.equal(
    (
      await prisma.inventoryDamageDocument.findUniqueOrThrow({
        where: { id: conflictSubmitted.id },
      })
    ).status,
    "SUBMITTED",
  );

  console.log(
    "库存报损验证通过：成本出库、余额与流水一致、幂等重试不重复、任一商品库存不足时整单回滚。",
  );
}

verify().finally(() => prisma.$disconnect());
