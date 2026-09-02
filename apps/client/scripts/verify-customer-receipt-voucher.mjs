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

const receipt = {
  id: "22222222-2222-4222-8222-222222222222",
  documentNumber: "SK-2026-000018",
  businessDate: "2026-09-02",
  amount: "382.50",
  notes: "测试收款备注<script>",
  postedAt: "2026-09-02T05:08:16.000Z",
  customer: { id: "customer-1", code: "KH-001", name: "王师傅<script>" },
  cashAccount: {
    id: "account-1",
    code: "WECHAT",
    name: "微信收款",
    type: "WECHAT",
  },
  postedBy: { id: "user-1", displayName: "玉春店员" },
  allocations: [
    ["allocation-1", "XS-2026-000011", "2026-09-01T03:00:00.000Z", "300"],
    ["allocation-2", "XS-2026-000014", "2026-09-02T01:20:00.000Z", "82.50"],
  ].map(([id, documentNumber, soldAt, amount]) => ({
    id,
    amount,
    createdAt: "2026-09-02T05:08:16.000Z",
    receivableEntry: {
      id: `${id}-entry`,
      originalAmount: amount,
      outstandingAmount: "0",
      dueDate: "2026-10-02",
      status: "SETTLED",
      sourceDocument: { documentNumber, soldAt },
    },
  })),
  reversal: null,
};
const profile = {
  id: "primary",
  storeName: "玉春农机",
  shortName: "YC",
  phone: "0371-12345678",
  address: "河南省门店地址",
  receiptFooter: "感谢信任，收到款项后请及时核对。",
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
await page.goto("http://localhost:4174/?screen=debts", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async (fixture) => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { CustomerReceiptVoucherHarness } =
    await import("/src/testing/CustomerReceiptVoucherHarness.tsx");
  document.body.innerHTML =
    '<nav class="c-nav">底部导航</nav><div id="voucher-test-root"></div>';
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  createRoot(document.querySelector("#voucher-test-root")).render(
    createElement(CustomerReceiptVoucherHarness, { receipt: fixture }),
  );
}, receipt);
await page.getByRole("heading", { name: "客户收款凭证" }).waitFor();
await page.getByText("¥382.50").first().waitFor();
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
assert.ok(portrait.dialogHeight <= portrait.viewportWidth * 2);
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
  async ({ receipt, profile }) => {
    const module =
      await import("/src/modules/receivables/customer-receipt-voucher.ts");
    const blob = await module.createVoucherPng(receipt, profile);
    const bitmap = await createImageBitmap(blob);
    const a4 = module.voucherPrintHtml(receipt, profile, "A4");
    const small = module.voucherPrintHtml(receipt, profile, "RECEIPT_80MM");
    const reversed = module.voucherPrintHtml(
      {
        ...receipt,
        reversal: {
          id: "reversal-1",
          documentNumber: "SF-2026-000001",
          businessDate: "2026-09-02",
          reason: "重复登记",
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
      uppercase: [0, 100, 382.5, 1001.01].map(module.voucherUppercase),
      escaped: a4.includes("王师傅&lt;script&gt;"),
      rawScript: a4.includes("王师傅<script>"),
      a4Page: a4.includes("size:A4"),
      smallPage: small.includes("size:80mm auto"),
      reversedMarked:
        reversed.includes("已反核销") &&
        reversed.includes("不能作为有效收款证明"),
      a4,
      small,
    };
  },
  { receipt, profile },
);
assert.equal(rendered.type, "image/png");
assert.ok(rendered.size > 15_000);
assert.equal(rendered.width, 1080);
assert.ok(rendered.height >= 1180);
assert.deepEqual(rendered.uppercase, [
  "零元整",
  "壹佰元整",
  "叁佰捌拾贰元伍角",
  "壹仟零壹元零壹分",
]);
assert.equal(rendered.escaped, true);
assert.equal(rendered.rawScript, false);
assert.equal(rendered.a4Page, true);
assert.equal(rendered.smallPage, true);
assert.equal(rendered.reversedMarked, true);

const download = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "保存图片" }).click(),
]).then(([value]) => value);
await download.saveAs(
  "../../artifacts/customer-receipt-voucher-verification.png",
);
await page.screenshot({
  path: "../../artifacts/customer-receipt-voucher-mobile.png",
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
await browser.close();
process.stdout.write(
  `客户收款凭证验证通过：2 笔核销，手机竖屏/横屏无溢出，PNG ${rendered.width}×${rendered.height}，A4/80mm 可输出，桌面宽 ${Math.round(desktopWidth)}px。\n`,
);
