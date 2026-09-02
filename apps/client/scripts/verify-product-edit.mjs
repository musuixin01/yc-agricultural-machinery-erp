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

let submitted;
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
page.setDefaultTimeout(8_000);
await page.route("**/api/v1/catalog/references", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      categories: [{ id: "category-1", code: "FASTENER", name: "螺丝标准件" }],
      brands: [],
      units: [{ id: "unit-1", code: "PCS", name: "个", decimalScale: 0 }],
    }),
  }),
);
await page.route("**/api/v1/catalog/products/*", async (route) => {
  submitted = route.request().postDataJSON();
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ id: "saved" }),
  });
});
await page.goto("http://localhost:4174", { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const React = await import("/node_modules/.vite/deps/react.js");
  const ReactDom = await import("/node_modules/.vite/deps/react-dom_client.js");
  const { ProductEditHarness } =
    await import("/src/testing/ProductEditHarness.tsx");
  const createRoot = ReactDom.createRoot ?? ReactDom.default.createRoot;
  const createElement = React.createElement ?? React.default.createElement;
  document.body.innerHTML = '<div id="product-edit-test-root"></div>';
  createRoot(document.querySelector("#product-edit-test-root")).render(
    createElement(ProductEditHarness),
  );
});
await page.getByRole("heading", { name: "编辑商品" }).waitFor();
await page.waitForTimeout(350);
assert.equal(
  await page.getByLabel("商品名称 *").inputValue(),
  "高强度螺栓 M12×45",
);
const mobile = await page.evaluate(() => ({
  viewport: window.innerWidth,
  width: document.documentElement.scrollWidth,
  inputHeight: document
    .querySelector(".catalog-edit-dialog input")
    .getBoundingClientRect().height,
}));
assert.equal(mobile.width, mobile.viewport);
assert.ok(mobile.inputHeight >= 44, JSON.stringify(mobile));
await page.getByLabel("商品名称 *").fill("高强度螺栓 M12×50");
await page.getByRole("button", { name: "保存修改" }).click();
assert.equal(submitted.name, "高强度螺栓 M12×50");
assert.equal(submitted.version, 1);

await page.setViewportSize({ width: 1280, height: 900 });
const desktopWidth = await page
  .locator(".catalog-edit-dialog")
  .evaluate((element) => element.getBoundingClientRect().width);
assert.ok(desktopWidth <= 620);
await browser.close();
process.stdout.write(
  "商品编辑验证通过：移动端无横向溢出、触控输入高度合格，保存载荷包含新资料和版本号。\n",
);
