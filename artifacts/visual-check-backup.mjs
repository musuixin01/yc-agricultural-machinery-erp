import playwright from "../apps/client/node_modules/playwright-core/index.js";

const { chromium } = playwright;

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

const backup = {
  id: "20260902T050820-1ddbc7e1",
  fileName: "yc-erp-20260902T050820-1ddbc7e1.dump",
  createdAt: "2026-09-02T05:08:20.000Z",
  createdBy: { id: "owner", displayName: "经营者" },
  kind: "MANUAL",
  format: "PG_CUSTOM",
  sizeBytes: 307875,
  sha256: "7a55f96613874e7786c82e5113ff73896599863997ef2927670df711024f28f3",
  entryCount: 641,
  status: "VERIFIED",
  verifiedAt: "2026-09-02T05:08:22.000Z",
};

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["mobile-landscape", { width: 667, height: 375 }],
  ["desktop", { width: 1280, height: 900 }],
]) {
  const page = await browser.newPage({ viewport });
  if (name === "mobile-landscape")
    await page.emulateMedia({ reducedMotion: "reduce" });
  page.setDefaultTimeout(5_000);
  page.on("console", (message) =>
    console.log(name, "console", message.type(), message.text()),
  );
  page.on("pageerror", (error) =>
    console.log(name, "pageerror", error.message),
  );
  await page.addInitScript(() =>
    sessionStorage.setItem("yc_access_token", "visual-check"),
  );
  await page.route("http://localhost:3000/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path.endsWith("/auth/bootstrap-status")) body = { required: false };
    else if (path.endsWith("/auth/me"))
      body = {
        id: "owner",
        username: "owner",
        displayName: "玉春",
        roles: ["OWNER"],
        permissions: ["administration.manage", "identity.manage", "audit.read"],
      };
    else if (path.endsWith("/administration/backups/policy"))
      body = {
        enabled: true,
        backupTime: "21:00",
        retentionCount: 7,
        secondaryCopyEnabled: true,
        secondaryDirectory: "E:\\玉春备份",
        version: 2,
        nextRunAt: "2026-09-03T13:00:00.000Z",
        lastAttemptAt: null,
        lastSuccessAt: "2026-09-02T13:00:00.000Z",
        lastFailureAt: null,
        lastFailureMessage: null,
        lastSecondaryCopyAt: "2026-09-02T13:01:00.000Z",
        lastSecondaryCopyFailureAt: null,
        lastSecondaryCopyFailureMessage: null,
        updatedAt: "2026-09-02T05:00:00.000Z",
        updatedBy: { id: "owner", displayName: "玉春" },
      };
    else if (path.endsWith("/administration/backups"))
      body = {
        items: [backup],
        operation: null,
        restoreConfirmationHint: "恢复 备份编号",
      };
    else if (path.endsWith("/administration/business-profile"))
      body = {
        id: "primary",
        storeName: "玉春农机",
        shortName: "YC",
        phone: null,
        address: null,
        receiptFooter: null,
        defaultPaperSize: "A4",
        version: 1,
        updatedAt: "2026-09-02T05:00:00.000Z",
        updatedBy: null,
      };
    else if (path.includes("/identity/roles")) body = [];
    else if (path.includes("/identity/users")) body = { items: [] };
    else if (path.includes("/identity/audit-events")) body = { items: [] };
    else body = { items: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:4174",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      },
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://localhost:4174/?screen=staff", {
    waitUntil: "networkidle",
  });
  if (name === "mobile") {
    await page.screenshot({
      path: "artifacts/backup-mobile-entry.png",
      fullPage: false,
    });
    await page.locator(".c-profile-entry").click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: "artifacts/mobile-profile-menu.png",
      fullPage: false,
    });
    await page.getByRole("menuitem", { name: "系统设置" }).click();
    await page.getByRole("button", { name: "数据安全" }).click();
  } else {
    await page.getByRole("button", { name: "数据安全" }).click();
  }
  await page.getByText("这份备份包含什么").waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `artifacts/backup-${name}-page.png`,
    fullPage: true,
  });
  await page.close();
}

await browser.close();
