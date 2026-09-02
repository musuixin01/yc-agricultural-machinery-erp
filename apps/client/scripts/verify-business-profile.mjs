import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

const initial = {
  id: "primary",
  storeName: "玉春农机",
  shortName: "YC",
  phone: null,
  address: null,
  receiptFooter: null,
  defaultPaperSize: "A4",
  version: 1,
  updatedAt: "2026-09-02T03:00:00.000Z",
  updatedBy: null,
};
let submitted;
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
page.setDefaultTimeout(8_000);
page.on("pageerror", (error) => process.stderr.write(`${error.stack}\n`));
await page.route("**/api/v1/administration/business-profile", async (route) => {
  if (route.request().method() === "PATCH") {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...initial,
        ...submitted,
        version: 2,
        updatedBy: { id: "u", displayName: "经营者" },
      }),
    });
    return;
  }
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(initial),
  });
});
await page.goto("http://localhost:4174/?screen=staff", {
  waitUntil: "domcontentloaded",
});
await page.evaluate(async () => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { BusinessProfileHarness } = await import(
    "/src/testing/BusinessProfileHarness.tsx"
  );
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  document.body.innerHTML = '<div id="settings-test-root"></div>';
  createRoot(document.querySelector("#settings-test-root")).render(
    createElement(BusinessProfileHarness),
  );
});
await page.getByLabel("门店名称 *").waitFor();
assert.equal(await page.getByLabel("门店名称 *").inputValue(), "玉春农机");
await page.getByLabel("联系电话").fill("0371-12345678");
await page.getByLabel("门店地址").fill("河南省测试地址 1 号");
await page.getByLabel("80mm 小票适合配件零售和热敏打印机").check();
await page.getByRole("button", { name: "保存门店资料" }).click();
await page.getByText(/门店资料已保存/).waitFor();
assert.equal(submitted.phone, "0371-12345678");
assert.equal(submitted.address, "河南省测试地址 1 号");
assert.equal(submitted.defaultPaperSize, "RECEIPT_80MM");
assert.equal(submitted.version, 1);
const mobile = await page.evaluate(() => ({
  viewport: window.innerWidth,
  width: document.documentElement.scrollWidth,
  saveHeight: document
    .querySelector(".business-profile-settings form > footer button")
    .getBoundingClientRect().height,
}));
assert.equal(mobile.width, mobile.viewport);
assert.ok(mobile.saveHeight >= 48);

await page.setViewportSize({ width: 1280, height: 900 });
const columns = await page
  .locator(".business-profile-settings")
  .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
assert.match(columns, /280px/);
await browser.close();
process.stdout.write(
  "门店资料验证通过：正式字段加载、保存载荷、版本号、80mm 默认值及手机触控布局均正确。\n",
);
