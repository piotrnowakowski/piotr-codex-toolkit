const fs = require("node:fs");
const path = require("node:path");
const {
  buildOutcomeSummary,
  createChatRequestTracker,
  createCheckpointWriter,
  determineScenarioOutcome,
  downloadCsv,
  ensureAvailableInventoryYear,
  fetchUserCities,
  isConnectAllResponse,
  loadProfile,
  locatorSnapshot,
  openClimaAndConfirm,
  openDownloadModal,
  signIn,
  waitForDashboardStable,
} = require("./citycatalyst_ui.cjs");

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const runDir = path.resolve(process.env.RUN_DIR || process.cwd());
const profile = loadProfile(
  process.env.DEMO_PROFILE_PATH ||
    path.join(__dirname, "..", "assets", "profiles", "krakow.json"),
);

async function clickContinue(page) {
  const button = page.getByRole("button", { name: /^Continue$/ }).last();
  await button.waitFor({ state: "visible" });
  await button.click();
}

async function fillPopulationIfMissing(page, testId, fallback) {
  const input = page.getByTestId(testId);
  await input.waitFor({ state: "visible" });
  if (!(await input.inputValue()).trim()) {
    if (fallback == null || String(fallback).trim() === "") {
      throw new Error(
        `${testId} was not populated by the city result. Supply the corresponding population launcher parameter for this audience-selected city.`,
      );
    }
    await input.fill(String(fallback));
  }
}

async function choosePopulationYear(page, name, year) {
  const select = page.locator(`select[name="${name}"]`);
  if (await select.isVisible().catch(() => false)) {
    if (!(await select.inputValue()).trim())
      await select.selectOption(String(year));
  }
}

async function findManualSurface(page, wait) {
  const addDataCard = page.getByTestId("add-data-to-inventory-card");
  await addDataCard.waitFor({
    state: "visible",
    timeout: 45_000,
  });
  await Promise.all([
    page.waitForURL(/\/data\/?$/, { timeout: 45_000 }),
    addDataCard.click(),
  ]);

  await page.getByTestId("add-data-step-title").waitFor({
    state: "visible",
    timeout: 45_000,
  });
  const stationary = page.getByTestId("stationary-energy-sector-card");
  await stationary.waitFor({ state: "visible", timeout: 45_000 });
  await Promise.all([
    page.waitForURL(/\/data\/1\/?$/, { timeout: 45_000 }),
    stationary.getByTestId("sector-card-button").click(),
  ]);

  const cards = page.getByTestId("subsector-card");
  await cards.first().waitFor({ state: "visible", timeout: 45_000 });
  const preferred = cards
    .filter({
      hasText: new RegExp(profile.manualInput.preferredSubsector || "", "i"),
    })
    .first();
  const chosen = (await preferred.isVisible().catch(() => false))
    ? preferred
    : cards.first();
  const chosenLabel = (await chosen.innerText()).replace(/\s+/g, " ").trim();
  await chosen.click();
  await page.waitForURL(/\/data\/1\/[0-9a-f-]+\/?(?:\?.*)?$/, {
    timeout: 45_000,
  });
  await page
    .getByText(/Add data to sub-sector/i)
    .first()
    .waitFor({
      state: "visible",
      timeout: 45_000,
    });
  await wait(500);

  const addButton = page.getByTestId("add-emission-data-button").first();
  if (!(await addButton.isVisible().catch(() => false))) {
    const methods = page.getByTestId("methodology-card");
    if (
      !(await methods
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      throw new Error(
        "This subsector is connected to third-party data and exposes no manual-input surface. The recording did not disconnect it.",
      );
    }
    const direct = methods.filter({ hasText: /Direct Measure/i }).first();
    await (
      (await direct.isVisible().catch(() => false)) ? direct : methods.first()
    ).click();
  }
  await addButton.waitFor({ state: "visible" });
  return { addButton, subsector: chosenLabel };
}

async function captureAssistantAnswer(page, input, sendClickedMs) {
  const copyButton = page.getByRole("button", { name: "Copy text" }).last();
  const visibleError = page
    .getByText(/Failed to send message\. Please try again\.|An error occurred/i)
    .last();
  const sendButton = page.getByRole("button", { name: /Send Message/i });
  const deadline = sendClickedMs + 120_000;
  while (Date.now() < deadline) {
    if (await visibleError.isVisible().catch(() => false)) {
      const errorText = (await visibleError.innerText())
        .replace(/\s+/g, " ")
        .trim();
      throw new Error(`Clima displayed a visible error: ${errorText}`);
    }
    const answerVisible = await copyButton.isVisible().catch(() => false);
    const inputEnabled = await input.isEnabled().catch(() => false);
    const sendReady = await sendButton.isVisible().catch(() => false);
    if (answerVisible && inputEnabled && sendReady) {
      return copyButton.evaluate((button) => {
        let node = button.parentElement;
        while (node) {
          const text = (node.innerText || "").trim();
          if (text.length > 40) return text;
          node = node.parentElement;
        }
        return "";
      });
    }
    await page.waitForTimeout(200);
  }
  throw new Error(
    "No complete visible Clima answer appeared within 120 seconds of Send.",
  );
}

async function captureClimaUiState(page) {
  const input = page.locator('textarea[placeholder*="Ask assistant"]:visible');
  return {
    triggerState: await locatorSnapshot(page.locator("[data-ai-button]")),
    inputVisible: await input.isVisible().catch(() => false),
    inputEnabled: await input.isEnabled().catch(() => false),
    sendButtonVisible: await page
      .getByRole("button", { name: /Send Message/i })
      .isVisible()
      .catch(() => false),
    stopButtonVisible: await page
      .getByRole("button", { name: /Stop/i })
      .isVisible()
      .catch(() => false),
    questionVisible: await page
      .getByText(profile.climateAdvisorQuestion, { exact: true })
      .isVisible()
      .catch(() => false),
  };
}

module.exports = async ({ page, context, step, highlight, wait }) => {
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(45_000);
  fs.mkdirSync(runDir, { recursive: true });
  const report = {
    kind: "citycatalyst-inventory-demo",
    profile: profile.profilePath,
    city: profile.cityName,
    country: profile.countryName,
    inventoryYear: null,
    inventoryGoal: "GPC Basic",
    globalWarmingPotential: "AR6",
    verifiedDemoCleanupAuthorized:
      process.env.ALLOW_VERIFIED_DEMO_CLEANUP === "true",
    startedAt: new Date().toISOString(),
    steps: {},
    outcome: "running",
  };
  const checkpoints = createCheckpointWriter(runDir, report);
  const mark = (label, detail = {}) => {
    report.steps[label] = detail;
    checkpoints.persist(label, detail);
  };
  checkpoints.persist("started");

  let inventoryDashboardUrl = null;
  let inventoryId = null;

  try {
    await context.addInitScript(() => {
      window.localStorage.setItem("clima-ai-disclaimer-accepted", "true");
    });

    await step("Sign in and select an unused inventory year");
    await signIn(page, baseUrl, `${baseUrl}/en/cities/onboarding/`);
    const rows = await fetchUserCities(page, baseUrl);
    const allocation = await ensureAvailableInventoryYear({
      page,
      baseUrl,
      rows,
      profile,
      requestedYear: process.env.INVENTORY_YEAR,
      allowVerifiedDemoCleanup:
        process.env.ALLOW_VERIFIED_DEMO_CLEANUP === "true",
      proposalDir: runDir,
      runRoot: path.join(
        path.resolve(process.env.REPO_ROOT || process.cwd()),
        "output",
        "browser-demo-recording",
        "runs",
      ),
    });
    const year = allocation.year;
    report.inventoryYear = Number(year);
    if (allocation.cleanup) {
      mark("inventoryCleanup", allocation.cleanup);
    }
    mark("signIn", {
      status: "passed",
      inventoryYear: Number(year),
      inventoryCleanup: allocation.cleanup
        ? "deleted-one-demo-owned-inventory"
        : "not-required",
    });

    await page.goto(`${baseUrl}/en/cities/onboarding/`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByTestId("cookie-decline-button")
      .click()
      .catch(() => {});
    const start = page.getByTestId("start-inventory-button");
    await start.waitFor({ state: "visible" });
    await highlight(start, { holdMs: 400 });
    await start.click();

    await step(`Create ${profile.cityName}, ${profile.countryName}`);
    await page.waitForURL(/\/cities\/onboarding\/setup/, { timeout: 45_000 });
    const cityInput = page.getByTestId("setup-city-input");
    await cityInput.fill(profile.cityName);
    let exactCity = page
      .getByText(profile.cityName, { exact: true })
      .locator("..");
    if (profile.countryName) {
      exactCity = exactCity.filter({
        hasText: new RegExp(profile.countryName, "i"),
      });
    }
    exactCity = exactCity.first();
    await exactCity.waitFor({ state: "visible" });
    await highlight(exactCity, { holdMs: 500 });
    await exactCity.click();
    const selected = page.getByTestId("selected-city-name");
    await selected.waitFor({ state: "visible" });
    const selectedName = (await selected.innerText()).trim();
    if (selectedName !== profile.cityName) {
      throw new Error(`Selected city did not resolve to ${profile.cityName}.`);
    }
    await clickContinue(page);
    mark("city", { status: "passed", selected: selectedName });

    await step(`Create a ${year} GPC Basic inventory using AR6`);
    await page.getByTestId("inventory-details-heading").waitFor({
      state: "visible",
      timeout: 45_000,
    });
    const yearControl = page.getByTestId("inventory-details-year");
    await yearControl.locator('[data-part="trigger"]').click();
    await page.getByRole("option", { name: String(year), exact: true }).click();
    await page.getByTestId("inventory-goal-gpc_basic").click();
    await page.getByTestId("inventory-goal-ar6").click();
    await clickContinue(page);

    await page.getByTestId("add-population-data-heading").waitFor({
      state: "visible",
      timeout: 45_000,
    });
    await fillPopulationIfMissing(
      page,
      "city-population-input",
      profile.population.city,
    );
    await fillPopulationIfMissing(
      page,
      "region-population-input",
      profile.population.region,
    );
    await fillPopulationIfMissing(
      page,
      "country-population-input",
      profile.population.country,
    );
    for (const name of [
      "cityPopulationYear",
      "regionPopulationYear",
      "countryPopulationYear",
    ]) {
      await choosePopulationYear(page, name, year);
    }
    await clickContinue(page);
    const invite = page.getByTestId("invite-collaborators-step");
    if (await invite.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole("button", { name: /Skip this step/i }).click();
    }

    await step("Add available third-party data");
    const thirdParty = page.getByTestId("third-party-data-step");
    await thirdParty.waitFor({ state: "visible", timeout: 60_000 });
    const yes = page.getByTestId("third-party-data-choice-yes");
    await highlight(yes, { holdMs: 400 });
    await yes.click();
    await wait(800);
    const thirdPartySummary = (await thirdParty.innerText())
      .replace(/\s+/g, " ")
      .trim();
    const connectAllResponsePromise = page.waitForResponse(
      isConnectAllResponse,
      { timeout: 60_000 },
    );
    await clickContinue(page);
    const connectAllResponse = await connectAllResponsePromise;
    let connectAllPayload = null;
    try {
      connectAllPayload = await connectAllResponse.json();
    } catch {
      // HTTP status still provides deterministic failure evidence.
    }
    const connectAllErrors = Array.isArray(connectAllPayload?.errors)
      ? connectAllPayload.errors
      : Array.isArray(connectAllPayload?.data?.errors)
        ? connectAllPayload.data.errors
        : [];
    const thirdPartyPassed =
      connectAllResponse.ok() && connectAllErrors.length === 0;
    mark("inventory", {
      status: "passed",
      year: Number(year),
      goal: "GPC Basic",
      gwp: "AR6",
    });
    mark("thirdParty", {
      status: thirdPartyPassed ? "passed" : "failed",
      selection: "available-third-party-data",
      visibleSummary: thirdPartySummary,
      responseStatus: connectAllResponse.status(),
      sourceErrorCount: connectAllErrors.length,
      verification: thirdPartyPassed
        ? "The visible selection triggered a successful connect-all response with no reported source errors."
        : `The connect-all response returned HTTP ${connectAllResponse.status()} with ${connectAllErrors.length} reported source error(s).`,
    });

    await page.waitForURL(/\/cities\/[0-9a-f-]+\/GHGI\/[0-9a-f-]+\/?$/, {
      timeout: 60_000,
    });
    inventoryDashboardUrl = page.url().replace(/\/$/, "");
    inventoryId = new URL(inventoryDashboardUrl).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    await waitForDashboardStable(page);
    mark("dashboard", {
      status: "passed",
      url: inventoryDashboardUrl,
      inventoryId,
    });

    await step("Add one manual emissions record");
    try {
      const manual = await findManualSurface(page, wait);
      await highlight(manual.addButton, { holdMs: 350 });
      await manual.addButton.click();
      const modal = page.getByTestId("add-emission-modal");
      await modal.waitFor({ state: "visible" });
      const input = profile.manualInput;
      await modal.getByLabel(/Building type/i).selectOption(input.buildingType);
      await modal.getByLabel(/Fuel type/i).selectOption(input.fuelType);
      await modal.getByTestId("co2-emission-factor").fill(input.co2);
      await modal.getByTestId("n2o-emission-factor").fill(input.n2o);
      await modal.getByTestId("ch4-emission-factor").fill(input.ch4);
      const unitSelects = modal.locator(
        `select:has(option[value="${input.unit}"])`,
      );
      for (let index = 0; index < (await unitSelects.count()); index += 1) {
        await unitSelects.nth(index).selectOption(input.unit);
      }
      await modal.getByLabel(/Data Quality/i).selectOption(input.dataQuality);
      await modal.getByLabel("Data source").fill(input.source);
      await modal.getByLabel("Explanatory comments").fill(input.comments);
      const activityResponsePromise = page.waitForResponse(
        (response) => {
          try {
            const url = new URL(response.url());
            return (
              response.request().method() === "POST" &&
              url.pathname.includes(
                `/api/v1/inventory/${inventoryId}/activity-value`,
              ) &&
              (response.status() < 300 || response.status() >= 400)
            );
          } catch {
            return false;
          }
        },
        { timeout: 30_000 },
      );
      await modal.getByTestId("add-emission-modal-submit").click();
      const activityResponse = await activityResponsePromise;
      if (!activityResponse.ok()) {
        throw new Error(
          `Manual entry request failed with HTTP ${activityResponse.status()}.`,
        );
      }
      await modal.waitFor({ state: "hidden" });
      mark("manualInput", {
        status: "passed",
        subsector: manual.subsector,
        co2Tonnes: Number(input.co2),
        n2oTonnes: Number(input.n2o),
        ch4Tonnes: Number(input.ch4),
        source: input.source,
        verification:
          "Visible form submission returned a successful activity-value response.",
      });
    } catch (error) {
      mark("manualInput", {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      await wait(3_000);
    }

    await step("Ask Climate Advisor about GPC and GPC+");
    let chatTracker = null;
    try {
      await page.goto(inventoryDashboardUrl, { waitUntil: "domcontentloaded" });
      const { input } = await openClimaAndConfirm(page, {
        highlight,
        wait,
        timeout: 20_000,
      });
      await input.fill(profile.climateAdvisorQuestion);
      chatTracker = createChatRequestTracker(page);
      const sendClickedMs = chatTracker.markSendClicked();
      await page.getByRole("button", { name: /Send Message/i }).click();
      const answer = await captureAssistantAnswer(page, input, sendClickedMs);
      mark("climateAdvisor", {
        status: answer ? "passed" : "failed",
        question: profile.climateAdvisorQuestion,
        answer: answer.replace(/\s+/g, " ").trim() || null,
        elapsedMs: Date.now() - sendClickedMs,
        network: chatTracker.snapshot(),
        uiState: await captureClimaUiState(page),
      });
      await wait(800);
    } catch (error) {
      const network = chatTracker?.snapshot() || null;
      mark("climateAdvisor", {
        status: "failed",
        question: profile.climateAdvisorQuestion,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: network?.sendClickedAt
          ? Date.now() - Date.parse(network.sendClickedAt)
          : null,
        network,
        uiState: await captureClimaUiState(page),
      });
      await wait(3_000);
    } finally {
      chatTracker?.stop();
    }

    await step("Review inventory results");
    try {
      await page.keyboard.press("Escape").catch(() => {});
      await page.goto(inventoryDashboardUrl, { waitUntil: "domcontentloaded" });
      const resultsTab = page.getByTestId(
        "tab-emission-inventory-results-title",
      );
      await resultsTab.waitFor({ state: "visible", timeout: 45_000 });
      await resultsTab.click();
      const heading = page.getByText(/Total Emissions/i).first();
      await heading.waitFor({ state: "visible", timeout: 45_000 });
      mark("results", {
        status: "passed",
        visibleSummary: (await heading.innerText()).replace(/\s+/g, " ").trim(),
      });
    } catch (error) {
      mark("results", {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      await wait(3_000);
    }

    if (process.env.INCLUDE_CSV === "true") {
      await step(
        `Optionally download the ${profile.cityName} inventory as CSV`,
      );
      try {
        await page.goto(inventoryDashboardUrl, {
          waitUntil: "domcontentloaded",
        });
        await openDownloadModal(page, { highlight, timeout: 45_000 });
        const csvPath = path.join(
          runDir,
          `${profile.slug}-${year}-inventory.csv`,
        );
        if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
        const evidence = await downloadCsv(page, {
          inventoryId,
          csvPath,
          highlight,
          timeout: 45_000,
        });
        mark("csv", { status: "passed", ...evidence });
      } catch (error) {
        mark("csv", {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        await wait(3_000);
      }
    } else {
      mark("csv", {
        status: "skipped",
        reason:
          "CSV is outside the requested live-demo path. Use -IncludeCsv to add it.",
      });
    }
  } catch (error) {
    report.fatalError = error instanceof Error ? error.message : String(error);
    mark("fatal", { status: "failed", error: report.fatalError });
    throw error;
  } finally {
    report.completedAt = new Date().toISOString();
    report.summary = buildOutcomeSummary(report.steps, {
      includeCsv: process.env.INCLUDE_CSV === "true",
    });
    report.outcome = determineScenarioOutcome(report.steps, report.fatalError);
    checkpoints.persist("completed", {
      outcome: report.outcome,
      worked: report.summary.worked.length,
      didNotWork: report.summary.didNotWork.length,
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  }
};
