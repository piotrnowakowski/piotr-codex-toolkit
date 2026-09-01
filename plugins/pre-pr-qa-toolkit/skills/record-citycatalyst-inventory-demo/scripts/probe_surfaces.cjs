const path = require("node:path");
const { createRequire } = require("node:module");
const {
  chooseWarmupInventory,
  fetchUserCities,
  inventoryUrl,
  loadProfile,
  openClimaAndConfirm,
  openDownloadModal,
  signIn,
  warmReadOnlyRouteBundles,
  writeJson,
} = require("./citycatalyst_ui.cjs");

const repoRoot = path.resolve(process.env.REPO_ROOT || process.cwd());
const runDir = path.resolve(
  process.env.RUN_DIR ||
    path.join(repoRoot, "output", "browser-demo-recording"),
);
const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const profile = loadProfile(
  process.env.DEMO_PROFILE_PATH ||
    path.join(__dirname, "..", "assets", "profiles", "krakow.json"),
);
const appRequire = createRequire(path.join(repoRoot, "app", "package.json"));
const { chromium } = appRequire("playwright");

async function probe(name, action, result) {
  const startedAt = Date.now();
  try {
    const detail = await action();
    result.surfaces[name] = {
      status: "passed",
      elapsedMs: Date.now() - startedAt,
      ...(detail || {}),
    };
  } catch (error) {
    result.surfaces[name] = {
      status: "failed",
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const reportPath = path.join(runDir, "preflight.json");
  const result = {
    kind: "citycatalyst-inventory-demo-preflight",
    profile: profile.profilePath,
    city: profile.cityName,
    baseUrl,
    startedAt: new Date().toISOString(),
    surfaces: {},
    consoleErrors: [],
    pageErrors: [],
  };
  writeJson(reportPath, result);

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(45_000);
    page.on("console", (message) => {
      if (message.type() === "error") result.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => result.pageErrors.push(error.message));

    await signIn(page, baseUrl, `${baseUrl}/en/cities/onboarding/`);
    const cityRows = await fetchUserCities(page, baseUrl);
    const warmup = chooseWarmupInventory(cityRows, profile);

    await probe(
      "routeBundles",
      async () => ({
        method: "GET",
        mutationPerformed: false,
        routes: await warmReadOnlyRouteBundles(page, baseUrl),
      }),
      result,
    );

    await probe(
      "onboarding",
      async () => {
        await page.goto(`${baseUrl}/en/cities/onboarding/`, {
          waitUntil: "domcontentloaded",
        });
        await page
          .getByTestId("start-inventory-button")
          .waitFor({ state: "visible" });
        return { url: page.url() };
      },
      result,
    );

    if (!warmup) {
      result.surfaces.existingInventory = {
        status: "skipped",
        reason: "No existing inventory is available for a read-only warm-up.",
      };
    } else {
      const cityId = warmup.city.cityId;
      const lng = "en";
      const dashboardUrl = inventoryUrl(
        baseUrl,
        lng,
        cityId,
        warmup.inventoryId,
      );
      result.warmupInventory = {
        cityName: warmup.city.name,
        year: warmup.year,
        cityId,
        inventoryId: warmup.inventoryId,
        url: dashboardUrl,
      };

      await probe(
        "dashboard",
        async () => {
          await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
          const cityName = page.getByTestId("hero-city-name");
          await cityName.waitFor({ state: "visible", timeout: 45_000 });
          return {
            url: page.url(),
            cityName: (await cityName.innerText()).trim(),
          };
        },
        result,
      );

      await probe(
        "climateAdvisor",
        async () => {
          await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
          const opened = await openClimaAndConfirm(page, { timeout: 20_000 });
          return {
            url: page.url(),
            triggerState: opened.triggerState,
            inputVisible: await opened.input.isVisible(),
          };
        },
        result,
      );

      await probe(
        "results",
        async () => {
          await page.keyboard.press("Escape").catch(() => {});
          await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
          const tab = page.getByTestId("tab-emission-inventory-results-title");
          await tab.waitFor({ state: "visible", timeout: 45_000 });
          await tab.click();
          const results = page.getByText(/Total Emissions/i).first();
          await results.waitFor({ state: "visible", timeout: 45_000 });
          return {
            url: page.url(),
            heading: (await results.innerText()).trim(),
          };
        },
        result,
      );

      await probe(
        "downloadModal",
        async () => {
          await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
          const opened = await openDownloadModal(page, { timeout: 45_000 });
          return {
            url: page.url(),
            title: (await opened.modalTitle.innerText()).trim(),
          };
        },
        result,
      );
    }
  } catch (error) {
    result.fatalError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    result.completedAt = new Date().toISOString();
    result.blockingFailures = [];
    if (result.fatalError)
      result.blockingFailures.push("authentication-or-browser");
    if (result.surfaces.onboarding?.status === "failed") {
      result.blockingFailures.push("onboarding");
    }
    if (result.surfaces.routeBundles?.status === "failed") {
      result.blockingFailures.push("routeBundles");
    }
    result.warnings = Object.entries(result.surfaces)
      .filter(
        ([name, surface]) =>
          !["onboarding", "routeBundles"].includes(name) &&
          surface.status === "failed",
      )
      .map(([name]) => name);
    result.status = result.blockingFailures.length
      ? "failed"
      : result.warnings.length
        ? "passed-with-warnings"
        : "passed";
    writeJson(reportPath, result);
    if (browser) await browser.close();
  }

  process.stdout.write(`${JSON.stringify({ ...result, reportPath })}\n`);
  if (result.status === "failed") process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exitCode = 1;
});
