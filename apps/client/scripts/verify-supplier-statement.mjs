import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
]
  .filter(Boolean)
  .find(existsSync);
if (!executablePath) throw new Error("未找到 Chromium 浏览器。");

const supplierId = "11111111-1111-4111-8111-111111111111";
const statement = {
  supplier: {
    id: supplierId,
    code: "GYS-001",
    name: "宏达农机<script>",
    phone: "13800000000",
    contactName: "李经理",
    address: "河南省测试地址 1 号",
  },
  period: { dateFrom: "2026-09-01", dateTo: "2026-09-30" },
  summary: {
    openingBalance: "100",
    increases: "210",
    decreases: "90",
    closingBalance: "220",
  },
  items: [
    [
      "purchase",
      "2026-09-01",
      "CREDIT_PURCHASE",
      "采购入库欠款",
      "CG-001",
      null,
      "200",
      "0",
      "300",
    ],
    [
      "payment",
      "2026-09-02",
      "SUPPLIER_PAYMENT",
      "供应商付款",
      "FK-001",
      null,
      "0",
      "50",
      "250",
    ],
    [
      "return",
      "2026-09-03",
      "PURCHASE_RETURN",
      "采购退货冲减",
      "CT-001",
      "CG-001",
      "0",
      "25",
      "225",
    ],
    [
      "reverse",
      "2026-09-04",
      "PAYMENT_REVERSAL",
      "付款反核销",
      "FF-001",
      "FK-001",
      "10",
      "0",
      "235",
    ],
    [
      "advance",
      "2026-09-05",
      "ADVANCE_APPLICATION",
      "预付款抵扣",
      "YFK-DK-001",
      "YFK-001",
      "0",
      "15",
      "220",
    ],
  ].map(
    ([
      id,
      businessDate,
      kind,
      label,
      documentNumber,
      sourceDocumentNumber,
      increase,
      decrease,
      balance,
    ]) => ({
      id,
      businessDate,
      kind,
      label,
      documentNumber,
      sourceDocumentNumber,
      increase,
      decrease,
      balance,
      note: null,
    }),
  ),
  generatedAt: "2026-09-02T04:00:00.000Z",
};
const profile = {
  id: "primary",
  storeName: "玉春农机",
  shortName: "YC",
  phone: "0371-12345678",
  address: "河南省门店地址",
  receiptFooter: null,
  defaultPaperSize: "A4",
  version: 1,
  updatedAt: "2026-09-02T03:00:00.000Z",
  updatedBy: null,
};

mkdirSync("../../artifacts", { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({
  viewport: { width: 375, height: 760 },
  reducedMotion: "reduce",
  acceptDownloads: true,
});
page.setDefaultTimeout(10_000);
page.on("pageerror", (error) => process.stderr.write(`${error.stack}\n`));
await page.route("**/api/v1/parties?**", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      items: [
        {
          id: supplierId,
          code: "GYS-001",
          name: "宏达农机",
          roles: ["SUPPLIER"],
          contacts: [],
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    }),
  }),
);
await page.route("**/api/v1/payables/statements/**", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(statement),
  }),
);
await page.route("**/api/v1/administration/business-profile", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(profile),
  }),
);
await page.goto("http://localhost:4174/?screen=payables", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async (id) => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { SupplierStatementHarness } =
    await import("/src/testing/SupplierStatementHarness.tsx");
  document.body.innerHTML =
    '<nav class="c-nav">底部导航</nav><div id="statement-test-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#statement-test-root")).render(
    createElement(SupplierStatementHarness, { supplierId: id }),
  );
}, supplierId);
await page.getByRole("heading", { name: "供应商对账单" }).waitFor();
await page.getByText("¥220.00").first().waitFor();
assert.equal(
  await page.locator(".customer-statement-ledger article").count(),
  5,
);

const mobile = await page.evaluate(() => {
  const dialog = document.querySelector(".customer-statement-dialog");
  const actions = [
    ...document.querySelectorAll(".customer-statement-actions button"),
  ];
  return {
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    dialogWidth: dialog.getBoundingClientRect().width,
    dialogHeight: dialog.getBoundingClientRect().height,
    minimumActionHeight: Math.min(
      ...actions.map((item) => item.getBoundingClientRect().height),
    ),
    navDisplay: getComputedStyle(document.querySelector(".c-nav")).display,
  };
});
assert.equal(mobile.documentWidth, mobile.viewport);
assert.ok(mobile.dialogWidth <= mobile.viewport);
assert.ok(mobile.dialogHeight <= 740);
assert.ok(mobile.minimumActionHeight >= 48);
assert.equal(mobile.navDisplay, "none");

await page.setViewportSize({ width: 760, height: 375 });
await page.waitForTimeout(150);
const landscape = await page.evaluate(() => {
  const dialog = document.querySelector(".customer-statement-dialog");
  const actions = document.querySelector(".customer-statement-actions");
  return {
    dialogHeight: dialog.getBoundingClientRect().height,
    actionsBottom: actions.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  };
});
assert.ok(landscape.dialogHeight <= landscape.viewportHeight - 20);
assert.ok(landscape.actionsBottom <= landscape.viewportHeight);
assert.equal(landscape.documentWidth, landscape.viewportWidth);
await page.setViewportSize({ width: 375, height: 760 });

const rendered = await page.evaluate(
  async ({ statement, profile }) => {
    const module = await import("/src/modules/payables/supplier-statement.ts");
    const blob = await module.createSupplierStatementPng(statement, profile);
    const bitmap = await createImageBitmap(blob);
    const html = module.supplierStatementPrintHtml(statement, profile);
    return {
      type: blob.type,
      size: blob.size,
      width: bitmap.width,
      height: bitmap.height,
      escaped: html.includes("宏达农机&lt;script&gt;"),
      rawScript: html.includes("宏达农机<script>"),
      labels: [
        "采购入库欠款",
        "供应商付款",
        "采购退货冲减",
        "付款反核销",
        "预付款抵扣",
      ].every((label) => html.includes(label)),
      html,
    };
  },
  { statement, profile },
);
assert.equal(rendered.type, "image/png");
assert.ok(rendered.size > 20_000);
assert.equal(rendered.width, 2160);
assert.ok(rendered.height >= 2480);
assert.equal(rendered.escaped, true);
assert.equal(rendered.rawScript, false);
assert.equal(rendered.labels, true);

const download = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "保存图片" }).click(),
]).then(([value]) => value);
await download.saveAs("../../artifacts/supplier-statement-verification.png");
await page.screenshot({
  path: "../../artifacts/supplier-statement-mobile.png",
  fullPage: false,
});
const printPage = await browser.newPage();
await printPage.setContent(rendered.html, { waitUntil: "load" });
const pdf = await printPage.pdf({
  printBackground: true,
  preferCSSPageSize: true,
});
assert.ok(pdf.byteLength > 10_000);
await printPage.close();

await page.setViewportSize({ width: 1280, height: 900 });
const desktop = await page
  .locator(".customer-statement-dialog")
  .evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
  }));
assert.ok(desktop.width <= 1080 && desktop.width < 1280);
assert.ok(desktop.height <= 860);
await browser.close();
process.stdout.write(
  `供应商对账单验证通过：5 笔正式流水，手机竖屏/横屏无溢出，PNG ${rendered.width}×${rendered.height}，A4 ${pdf.byteLength} 字节，桌面宽 ${Math.round(desktop.width)}px。\n`,
);
