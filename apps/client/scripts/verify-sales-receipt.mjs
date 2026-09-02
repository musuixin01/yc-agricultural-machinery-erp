import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const candidates = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const executablePath = candidates.find(existsSync);
if (!executablePath) throw new Error("未找到可用于销售单验证的 Chromium 浏览器。");

const documentFixture = {
  id: "00000000-0000-0000-0000-000000000001",
  documentNumber: "XS-2026-000001",
  status: "POSTED",
  settlementType: "CREDIT",
  businessDate: "2026-09-02",
  soldAt: "2026-09-02T02:30:45.000Z",
  dueDate: "2026-10-02",
  totalAmount: "382.50",
  totalCost: "240.00",
  grossProfit: "142.50",
  version: 3,
  customerNameSnapshot: "测试客户<script>",
  customerPhoneSnapshot: "13800000000",
  customer: { id: "c", code: "KH-001", name: "测试客户" },
  warehouse: { id: "w", code: "MAIN", name: "门店仓" },
  cashAccount: null,
  postedBy: { id: "u", displayName: "验证员" },
  receivableEntry: { id: "r", outstandingAmount: "182.50", status: "OPEN" },
  reversal: null,
  lines: [
    {
      id: "l1",
      product: { id: "p1", code: "PJ-LX-0708", name: "柴油滤芯 CX0708" },
      quantity: "5",
      unitPrice: "36.50",
      lineAmount: "182.50",
      unitCost: "20.00",
      costAmount: "100.00",
      grossProfit: "82.50",
      unitNameSnapshot: "个",
    },
    {
      id: "l2",
      product: { id: "p2", code: "LS-M12-045", name: "高强度螺栓 M12×45" },
      quantity: "100",
      unitPrice: "2.00",
      lineAmount: "200.00",
      unitCost: "1.40",
      costAmount: "140.00",
      grossProfit: "60.00",
      unitNameSnapshot: "个",
    },
  ],
};
const profileFixture = {
  id: "primary",
  storeName: "玉春农机测试门店",
  shortName: "YC TEST",
  phone: "0371-12345678",
  address: "河南省测试地址 1 号",
  receiptFooter: "感谢惠顾，安装前请核对型号。",
  defaultPaperSize: "RECEIPT_80MM",
  version: 2,
  updatedAt: "2026-09-02T03:00:00.000Z",
  updatedBy: { id: "u", displayName: "验证员" },
};

const outputDirectory = "../../artifacts";
mkdirSync(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({
  viewport: { width: 375, height: 760 },
  reducedMotion: "reduce",
});
await page.route("**/api/v1/administration/business-profile", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(profileFixture),
  }),
);
await page.goto("http://localhost:4174/?screen=sales", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async (fixture) => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { SalesReceiptHarness } = await import(
    "/src/testing/SalesReceiptHarness.tsx"
  );
  document.body.innerHTML = '<div id="receipt-test-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#receipt-test-root")).render(
    createElement(SalesReceiptHarness, {
      document: fixture,
    }),
  );
}, documentFixture);
await page.locator(".sales-receipt-dialog").waitFor();
const mobileLayout = await page.evaluate(() => ({
  viewportWidth: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  actionCount: document.querySelectorAll(".sales-receipt-actions button").length,
  hasHorizontalOverflow:
    document.querySelector(".sales-receipt-dialog").scrollWidth >
    document.querySelector(".sales-receipt-dialog").clientWidth,
}));
assert.equal(mobileLayout.documentWidth, mobileLayout.viewportWidth);
assert.equal(mobileLayout.hasHorizontalOverflow, false);
assert.equal(mobileLayout.actionCount, 3);

const download = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "保存图片" }).click(),
]).then(([value]) => value);
assert.equal(download.suggestedFilename(), "玉春销售单-XS-2026-000001.png");
await download.saveAs(`${outputDirectory}/sales-receipt-verification.png`);
await page.evaluate(() => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: undefined,
  });
});
await page.getByRole("button", { name: "分享/微信" }).click();
await page.locator(".sales-receipt-feedback.error").waitFor();
assert.match(
  await page.locator(".sales-receipt-feedback.error").innerText(),
  /保存图片/,
);

const rendered = await page.evaluate(async ({ fixture, profile }) => {
  const receipt = await import("/src/modules/sales/sales-receipt.ts");
  const blob = await receipt.createReceiptPng(fixture, profile);
  const bitmap = await createImageBitmap(blob);
  const html = receipt.receiptPrintHtml(fixture, profile, "A4");
  return {
    type: blob.type,
    size: blob.size,
    width: bitmap.width,
    height: bitmap.height,
    escaped: html.includes("测试客户&lt;script&gt;"),
    containsRawScript: html.includes("测试客户<script>"),
    containsBusinessProfile:
      html.includes("玉春农机测试门店") && html.includes("0371-12345678"),
  };
}, { fixture: documentFixture, profile: profileFixture });
assert.equal(rendered.type, "image/png");
assert.ok(rendered.size > 20_000);
assert.equal(rendered.width, 1080);
assert.ok(rendered.height >= 1080);
assert.equal(rendered.escaped, true);
assert.equal(rendered.containsRawScript, false);
assert.equal(rendered.containsBusinessProfile, true);

const printHtml = await page.evaluate(async ({ fixture, profile }) => {
  const receipt = await import("/src/modules/sales/sales-receipt.ts");
  return receipt.receiptPrintHtml(fixture, profile, "A4");
}, { fixture: documentFixture, profile: profileFixture });
const printPage = await browser.newPage();
await printPage.setContent(printHtml, { waitUntil: "load" });
const pdf = await printPage.pdf({
  printBackground: true,
  preferCSSPageSize: true,
});
assert.ok(pdf.byteLength > 10_000);
await printPage.close();

const receiptHtml = await page.evaluate(async ({ fixture, profile }) => {
  const receipt = await import("/src/modules/sales/sales-receipt.ts");
  return receipt.receiptPrintHtml(fixture, profile, "RECEIPT_80MM");
}, { fixture: documentFixture, profile: profileFixture });
const receiptPage = await browser.newPage();
await receiptPage.setContent(receiptHtml, { waitUntil: "load" });
const receiptPdf = await receiptPage.pdf({
  printBackground: true,
  preferCSSPageSize: true,
});
assert.ok(receiptPdf.byteLength > 8_000);
await receiptPage.close();

await page.setViewportSize({ width: 1280, height: 900 });
const desktopWidth = await page.locator(".sales-receipt-dialog").evaluate((element) => ({
  width: element.getBoundingClientRect().width,
  viewport: window.innerWidth,
}));
assert.ok(desktopWidth.width <= 900 && desktopWidth.width < desktopWidth.viewport);

await browser.close();
process.stdout.write(
  `销售单验证通过：手机无横向溢出，PNG ${rendered.width}×${rendered.height}，A4 ${pdf.byteLength} 字节，80mm ${receiptPdf.byteLength} 字节，桌面弹窗 ${Math.round(desktopWidth.width)}px。\n`,
);
