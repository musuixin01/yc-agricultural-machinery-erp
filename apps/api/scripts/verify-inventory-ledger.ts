import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";

const prisma = new PrismaService();
const inventory = new InventoryService(prisma);

async function verify() {
  const firstPage = await inventory.listLedger({ page: 1, pageSize: 12 });
  assert.equal(firstPage.pagination.page, 1);
  assert.equal(firstPage.pagination.pageSize, 12);
  assert.ok(firstPage.items.length <= 12);
  assert.ok(firstPage.pagination.total >= firstPage.items.length);

  const sample = firstPage.items[0];
  if (sample) {
    assert.ok(sample.product.id);
    assert.ok(sample.product.unitName);
    assert.ok(sample.warehouse.id);
    assert.ok(sample.sourceDocumentType);
    assert.match(sample.businessDate, /^\d{4}-\d{2}-\d{2}$/);

    const filtered = await inventory.listLedger({
      keyword: sample.product.code,
      page: 1,
      pageSize: 12,
    });
    assert.ok(filtered.items.length > 0);
    assert.ok(
      filtered.items.every((item) => item.product.id === sample.product.id),
    );
  }

  process.stdout.write(
    `库存流水验证通过：当前共 ${firstPage.pagination.total} 条，首屏 ${firstPage.items.length} 条。\n`,
  );
}

verify()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
