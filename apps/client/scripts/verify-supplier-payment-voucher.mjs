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

const payment = {
  id: "33333333-3333-4333-8333-333333333333",
  documentNumber: "FK-2026-000021",
  status: "POSTED",
  businessDate: "2026-09-02",
  amount: "1268.50",
  notes: "货款结算<script>",
  version: 3,
  postedAt: "2026-09-02T06:18:20.000Z",
  supplier: { id: "supplier-1", code: "GYS-001", name: "宏达农机<script>" },
  cashAccount: {
    id: "account-1",
    code: "BANK",
    name: "农业银行",
    type: "BANK",
  },
  postedBy: { id: "user-1", displayName: "玉春店员" },
  reversal: null,
  allocations: [
    ["allocation-1", "CG-2026-000031", "2026-09-15", "1000"],
    ["allocation-2", "CG-2026-000036", "2026-09-20", "268.50"],
  ].map(([id, documentNumber, dueDate, amount]) => ({
    id,
    amount,
    payableEntry: {
      id: `${id}-entry`,
      supplier: { id: "supplier-1", code: "GYS-001", name: "宏达农机" },
      sourceDocument: { documentNumber, businessDate: "2026-09-01" },
      originalAmount: amount,
      outstandingAmount: "0",
      dueDate,
      status: "SETTLED",
    },
  })),
};
const profile = {
  id: "primary",
  storeName: "玉春农机",
  shortName: "YC",
  phone: "0371-12345678",
  address: "河南省门店地址",
  receiptFooter: "付款已登记，请及时核对。",
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
await page.route("**/api/v1/administration/business-profile", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(profile),
  }),
);
await page.goto("http://localhost:4174/?screen=payables", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async (fixture) => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { SupplierPaymentVoucherHarness } =
    await import("/src/testing/SupplierPaymentVoucherHarness.tsx");
  document.body.innerHTML =
    '<nav class="c-nav">底部导航</nav><div id="voucher-test-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#voucher-test-root")).render(
    createElement(SupplierPaymentVoucherHarness, { payment: fixture }),
  );
}, payment);
await page.getByRole("heading", { name: "供应商付款凭证" }).waitFor();
await page.getByText("¥1,268.50").first().waitFor();
assert.equal(
  await page.locator(".customer-receipt-voucher-lines .line").count(),
  2,
);

const portrait = await page.evaluate(() => {
  const dialog = document.querySelector(".customer-receipt-voucher-dialog");
  const actions = [
    ...document.querySelectorAll(".customer-receipt-voucher-actions button"),
  ];
  return {
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    dialogWidth: dialog.getBoundingClientRect().width,
    dialogHeight: dialog.getBoundingClientRect().height,
    minimumActionHeight: Math.min(
      ...actions.map((item) => item.getBoundingClientRect().height),
    ),
    navDisplay: getComputedStyle(document.querySelector(".c-nav")).display,
  };
});
assert.equal(portrait.documentWidth, portrait.viewportWidth);
assert.ok(portrait.dialogWidth <= portrait.viewportWidth);
assert.ok(portrait.dialogHeight <= 744);
assert.ok(portrait.minimumActionHeight >= 48);
assert.equal(portrait.navDisplay, "none");

const a4Width = await page
  .locator(".customer-receipt-voucher-paper")
  .evaluate((node) => node.getBoundingClientRect().width);
await page.getByText("80mm 小票").click();
const receiptWidth = await page
  .locator(".customer-receipt-voucher-paper")
  .evaluate((node) => node.getBoundingClientRect().width);
assert.ok(receiptWidth <= a4Width);

const rendered = await page.evaluate(
  async ({ payment, profile }) => {
    const module =
      await import("/src/modules/payables/supplier-payment-voucher.ts");
    const blob = await module.createSupplierPaymentVoucherPng(payment, profile);
    const bitmap = await createImageBitmap(blob);
    const a4 = module.supplierPaymentVoucherPrintHtml(payment, profile, "A4");
    const small = module.supplierPaymentVoucherPrintHtml(
      payment,
      profile,
      "RECEIPT_80MM",
    );
    const reversed = module.supplierPaymentVoucherPrintHtml(
      {
        ...payment,
        status: "REVERSED",
        reversal: {
          id: "reversal-1",
          documentNumber: "FF-2026-000001",
          businessDate: "2026-09-02",
          reversedAt: "2026-09-02T07:00:00.000Z",
          amount: payment.amount,
          reason: "核销错采购单",
          postedAt: "2026-09-02T07:00:00.000Z",
        },
      },
      profile,
      "A4",
    );
    return {
      type: blob.type,
      size: blob.size,
      width: bitmap.width,
      height: bitmap.height,
      escaped: a4.includes("宏达农机&lt;script&gt;"),
      rawScript: a4.includes("宏达农机<script>"),
      uppercase: a4.includes("壹仟贰佰陆拾捌元伍角"),
      a4Page: a4.includes("size:A4"),
      smallPage: small.includes("size:80mm auto"),
      reversedMarked:
        reversed.includes("已反核销") &&
        reversed.includes("不能作为有效付款证明"),
      a4,
      small,
    };
  },
  { payment, profile },
);
assert.equal(rendered.type, "image/png");
assert.ok(rendered.size > 15_000);
assert.equal(rendered.width, 1080);
assert.ok(rendered.height >= 1180);
assert.equal(rendered.escaped, true);
assert.equal(rendered.rawScript, false);
assert.equal(rendered.uppercase, true);
assert.equal(rendered.a4Page, true);
assert.equal(rendered.smallPage, true);
assert.equal(rendered.reversedMarked, true);

const download = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "保存图片" }).click(),
]).then(([value]) => value);
await download.saveAs(
  "../../artifacts/supplier-payment-voucher-verification.png",
);
await page.screenshot({
  path: "../../artifacts/supplier-payment-voucher-mobile.png",
  fullPage: false,
});

for (const [name, html] of [
  ["a4", rendered.a4],
  ["80mm", rendered.small],
]) {
  const printPage = await browser.newPage();
  await printPage.setContent(html, { waitUntil: "load" });
  const pdf = await printPage.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });
  assert.ok(pdf.byteLength > 8_000, `${name} PDF 输出异常`);
  await printPage.close();
}

await page.setViewportSize({ width: 760, height: 375 });
await page.waitForTimeout(150);
const landscape = await page.evaluate(() => {
  const dialog = document.querySelector(".customer-receipt-voucher-dialog");
  const actions = document.querySelector(".customer-receipt-voucher-actions");
  return {
    dialogBottom: dialog.getBoundingClientRect().bottom,
    actionsBottom: actions.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  };
});
assert.ok(landscape.dialogBottom <= landscape.viewportHeight);
assert.ok(landscape.actionsBottom <= landscape.viewportHeight);
assert.equal(landscape.documentWidth, landscape.viewportWidth);

await page.setViewportSize({ width: 1280, height: 900 });
const desktopWidth = await page
  .locator(".customer-receipt-voucher-dialog")
  .evaluate((node) => node.getBoundingClientRect().width);
assert.ok(desktopWidth <= 900 && desktopWidth < 1280);

const flowPage = await browser.newPage({
  viewport: { width: 375, height: 760 },
});
const submittedPayment = {
  ...payment,
  status: "SUBMITTED",
  postedAt: null,
  postedBy: null,
};
await flowPage.route("**/api/v1/administration/business-profile", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(profile),
  }),
);
await flowPage.route("**/api/v1/payables/cash-accounts", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }),
);
await flowPage.route("**/api/v1/payables/entries**", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }),
);
await flowPage.route("**/api/v1/payables/advances", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      items: [],
      summary: { originalAmount: "0", availableAmount: "0" },
    }),
  }),
);
await flowPage.route("**/api/v1/cash/transfers", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }),
);
await flowPage.route("**/api/v1/payables/payments/*/post", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(payment),
  }),
);
await flowPage.route("**/api/v1/payables/payments", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ items: [submittedPayment] }),
  }),
);
flowPage.on("dialog", (dialog) => dialog.accept());
await flowPage.goto("http://localhost:4174/?screen=payables", {
  waitUntil: "domcontentloaded",
});
await flowPage.evaluate(async () => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { PayablesWorkspaceHarness } =
    await import("/src/testing/PayablesWorkspaceHarness.tsx");
  document.body.innerHTML = '<div id="payables-flow-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#payables-flow-root")).render(
    createElement(PayablesWorkspaceHarness),
  );
});
await flowPage.getByRole("button", { name: "确认付款并过账" }).click();
await flowPage.getByRole("heading", { name: "供应商付款凭证" }).waitFor();
assert.equal(
  await flowPage.getByText("付款已入账").first().isVisible(),
  true,
  "正式过账后应自动打开付款凭证",
);
await flowPage.close();
await browser.close();
process.stdout.write(
  `供应商付款凭证验证通过：正式过账后自动预览，2 笔核销，手机竖屏/横屏无溢出，PNG ${rendered.width}×${rendered.height}，A4/80mm 可输出，桌面宽 ${Math.round(desktopWidth)}px。\n`,
);
