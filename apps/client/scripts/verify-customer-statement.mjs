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

const customerId = "11111111-1111-4111-8111-111111111111";
const statementFixture = {
  customer: {
    id: customerId,
    code: "KH-001",
    name: "王师傅<script>",
    phone: "13800000000",
    contactName: "王师傅",
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
      "sale",
      "2026-09-01",
      "CREDIT_SALE",
      "赊账销售",
      "XS-001",
      null,
      "200",
      "0",
      "300",
    ],
    [
      "receipt",
      "2026-09-02",
      "CUSTOMER_RECEIPT",
      "客户收款",
      "SK-001",
      null,
      "0",
      "50",
      "250",
    ],
    [
      "return",
      "2026-09-03",
      "SALES_RETURN",
      "销售退货冲减",
      "XT-001",
      "XS-001",
      "0",
      "25",
      "225",
    ],
    [
      "reverse",
      "2026-09-04",
      "RECEIPT_REVERSAL",
      "收款反核销",
      "SF-001",
      "SK-001",
      "10",
      "0",
      "235",
    ],
    [
      "advance",
      "2026-09-05",
      "ADVANCE_APPLICATION",
      "预收款抵扣",
      "YSK-DK-001",
      "YSK-001",
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
const profileFixture = {
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
});
page.setDefaultTimeout(10_000);
page.on("pageerror", (error) => process.stderr.write(`${error.stack}\n`));
await page.route("**/api/v1/parties?**", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      items: [
        {
          id: customerId,
          code: "KH-001",
          name: "王师傅",
          roles: ["CUSTOMER"],
          contacts: [],
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    }),
  }),
);
await page.route("**/api/v1/receivables/statements/**", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(statementFixture),
  }),
);
await page.route("**/api/v1/administration/business-profile", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(profileFixture),
  }),
);
await page.goto("http://localhost:4174/?screen=debts", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async (id) => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { CustomerStatementHarness } =
    await import("/src/testing/CustomerStatementHarness.tsx");
  document.body.innerHTML =
    '<nav class="c-nav">底部导航</nav><div id="statement-test-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#statement-test-root")).render(
    createElement(CustomerStatementHarness, { customerId: id }),
  );
}, customerId);
await page.getByRole("heading", { name: "客户对账单" }).waitFor();
await page.getByText("¥220.00").first().waitFor();
assert.equal(
  await page.locator(".customer-statement-ledger article").count(),
  5,
);
const mobile = await page.evaluate(() => {
  const dialog = document.querySelector(".customer-statement-dialog");
  const save = Array.from(
    document.querySelectorAll(".customer-statement-actions button"),
  ).find((button) => button.textContent.includes("保存图片"));
  return {
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    dialogWidth: dialog.getBoundingClientRect().width,
    dialogHeight: dialog.getBoundingClientRect().height,
    saveHeight: save.getBoundingClientRect().height,
    navDisplay: getComputedStyle(document.querySelector(".c-nav")).display,
  };
});
assert.equal(mobile.documentWidth, mobile.viewport);
assert.ok(mobile.dialogWidth <= mobile.viewport);
assert.ok(mobile.dialogHeight <= 740);
assert.ok(mobile.saveHeight >= 48);
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
    width: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    maxHeight: getComputedStyle(dialog).maxHeight,
  };
});
assert.ok(
  landscape.dialogHeight <= landscape.viewportHeight - 20,
  JSON.stringify(landscape),
);
assert.ok(landscape.actionsBottom <= landscape.viewportHeight);
assert.equal(landscape.width, landscape.viewportWidth);

await page.setViewportSize({ width: 375, height: 760 });

const rendered = await page.evaluate(
  async ({ statement, profile }) => {
    const module =
      await import("/src/modules/receivables/customer-statement.ts");
    const blob = await module.createStatementPng(statement, profile);
    const bitmap = await createImageBitmap(blob);
    const html = module.statementPrintHtml(statement, profile);
    return {
      size: blob.size,
      type: blob.type,
      width: bitmap.width,
      height: bitmap.height,
      escaped: html.includes("王师傅&lt;script&gt;"),
      rawScript: html.includes("王师傅<script>"),
    };
  },
  { statement: statementFixture, profile: profileFixture },
);
assert.equal(rendered.type, "image/png");
assert.ok(rendered.size > 20_000);
assert.equal(rendered.width, 2160);
assert.ok(rendered.height >= 2480);
assert.equal(rendered.escaped, true);
assert.equal(rendered.rawScript, false);

const download = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "保存图片" }).click(),
]).then(([value]) => value);
await download.saveAs("../../artifacts/customer-statement-verification.png");
await page.screenshot({
  path: "../../artifacts/customer-statement-mobile.png",
  fullPage: false,
});

const printHtml = await page.evaluate(
  async ({ statement, profile }) => {
    const module =
      await import("/src/modules/receivables/customer-statement.ts");
    return module.statementPrintHtml(statement, profile);
  },
  { statement: statementFixture, profile: profileFixture },
);
const printPage = await browser.newPage();
await printPage.setContent(printHtml, { waitUntil: "load" });
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
    viewport: innerWidth,
  }));
assert.ok(desktop.width <= 1080 && desktop.width < desktop.viewport);
assert.ok(desktop.height <= 860);
await browser.close();
process.stdout.write(
  `客户对账单验证通过：5 笔正式流水，手机竖屏/横屏无溢出，PNG ${rendered.width}×${rendered.height}，A4 ${pdf.byteLength} 字节，桌面宽 ${Math.round(desktop.width)}px。\n`,
);
