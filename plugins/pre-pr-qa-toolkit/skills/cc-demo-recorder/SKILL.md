---
name: cc-demo-recorder
description: Record the standard CityCatalyst browser demo with Playwright and produce a point-by-point pass/partial/fail audit of the demo path. Use when the user asks for a CityCatalyst or CC demo, walkthrough, app-flow video, product demo recording, browser recording, or detailed demo path report that should log in with an existing account, create one city, clean existing 2022 data for that city, create a 2022 GPC Basic AR6 inventory, add third-party data, add manual input, report results, and download CSV.
---

# CC Demo Recorder

Record CityCatalyst demos with Playwright video recording. This skill is a CityCatalyst-specific version of the browser demo recorder: always run the standard GHGI flow below unless the user explicitly changes it.

Use `scripts/record_demo.cjs` from this skill for the recording mechanics.

## Required Demo Flow

Always include these steps, in this order:

1. Log in with an existing local demo/test account. Do not create a new account during the recording. Prefer `CC_DEMO_EMAIL` and `CC_DEMO_PASSWORD` when provided. Otherwise, for ordinary local CityCatalyst instances created from `app/env.example`, use the default admin account `johndoe@example.com` / `password`. Use the E2E admin account `e2e-test-admin@citycatalyst.local` / `E2ETestAdmin123!` only when `app/e2e/global-setup.ts` or the Playwright E2E setup has created it.
2. Ask the audience to choose one city when the city is not already specified. Use one city only.
3. Before creating the inventory, clean up existing data for the chosen city and year `2022`:
   - After login, call `GET /api/v1/city`.
   - Find city records whose `name` exactly matches the chosen city.
   - For each matching city, call `GET /api/v1/city/{cityId}/inventory`.
   - Delete any inventory where `year === 2022` with `DELETE /api/v1/inventory/{inventoryId}`.
   - If the remaining existing city would prevent a credible "create a new city" demo in a local/demo account, delete that demo city with `DELETE /api/v1/city/{cityId}` only when the environment is clearly non-production or the user explicitly approved it.
4. Create a new city through the onboarding UI. Give the city search bar time to load. Type slowly, wait for autocomplete results, and click the exact spelling/result, including region/country.
5. Create the inventory for year `2022`. Use `GPC Basic` and `AR6`. Best coverage years are usually 2017-2022; pick `2022` for this demo.
6. Add data with third-party data. Prefer the UI path: Add Data -> Stationary Energy -> search third-party/external data -> open a source -> connect data. If no source is available, record the no-data state and continue.
7. Add data with manual input. Use Stationary Energy -> Residential buildings when available. Prefer a simple Scope 1 activity:
   - Building type: all buildings
   - Fuel type: propane
   - Total fuel consumption: `100`
   - Unit: cubic meters
   - Emission factor type: custom
   - CO2 emission factor: `10`
   - N2O emission factor: `10`
   - CH4 emission factor: `1`
   - Data Quality: high
   - Data source: `CC demo manual input`
   - Comments: `Recorded demo data`
8. Report results by returning to the city GHGI dashboard/results view and waiting for the emissions widgets, charts, or tables to finish loading.
9. Download CSV through the download action card/modal. Save the downloaded CSV next to the video when possible.

## Default Local Login

Use `CC_DEMO_EMAIL` and `CC_DEMO_PASSWORD` when the user provides them. Without overrides, default to the local admin credentials documented in `app/env.example`:

- Email: `johndoe@example.com`
- Password: `password`

`app/scripts/create-admin.ts` creates this admin from `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` when the local environment has those values. The "John doe" clue in `app/env.example` is `ADMIN_NAMES`; the actual default login is the email/password pair above.

The E2E-only account is:

- Email: `e2e-test-admin@citycatalyst.local`
- Password: `E2ETestAdmin123!`

Use it only when the E2E global setup has run. It is not the safest default for an arbitrary local instance.

## Demo Path Audit

Every recording must leave a point-by-point audit of what worked and what did not. Use the recorder's `audit` helper in scenario scripts:

- `audit.run("Step name", async () => { ... })` for required steps that should fail the run if they fail.
- `audit.pass("Step name", "Evidence or note")` when the step clearly completed.
- `audit.partial("Step name", "What worked and what did not")` when the UI path was reached but expected data, controls, or downstream confirmation were missing.
- `audit.fail("Step name", errorOrNote)` when the step did not complete.
- `audit.skip("Step name", "Reason")` only when the user explicitly changed the demo path or the prerequisite is absent.

Use these required audit rows:

1. Authentication
2. City selection
3. Cleanup of existing 2022 data
4. City creation
5. 2022 GPC Basic AR6 inventory creation
6. Third-party data path
7. Manual input path
8. Results/reporting view
9. CSV download
10. Video and CSV verification

Do not silently pass optional-looking gaps. If no third-party source is available, mark the third-party data path `partial` and note that the no-data state was recorded. If the demo aborts, still report completed steps and the first failed step.

## Recording Workflow

1. Start or reuse the CityCatalyst app. In this repo, run from `app/`; use an existing `http://127.0.0.1:3000` server when available, otherwise start the local app in the way the workspace expects.
2. Create a scenario module under the workspace, usually `demo-recording/cc-demo-scenario.cjs`.
3. Add audit calls to the scenario so the run writes `<name>-audit.json` and `<name>-audit.md` next to the video.
4. Run this skill's recorder from the `app/` directory so Playwright resolves from CityCatalyst's dependencies.
5. Convert to MP4 when `ffmpeg` is available, inspect a frame, and embed the MP4 in the final response with an absolute Markdown media path.

Example command:

```powershell
$recorderScript = Join-Path "<installed cc-demo-recorder skill directory>" "scripts\record_demo.cjs"
node $recorderScript `
  --script ..\demo-recording\cc-demo-scenario.cjs `
  --output-dir ..\demo-recording `
  --name cc-demo-2022 `
  --headed
```

## Scenario Pattern

Create a CommonJS scenario module that exports an async function. Adapt selectors to the current UI, but preserve the required flow and cleanup.

```js
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.CC_BASE_URL || "http://127.0.0.1:3000";
const CITY_NAME = process.env.CC_DEMO_CITY || "Chicago";
const CITY_RESULT =
  process.env.CC_DEMO_CITY_RESULT ||
  `${CITY_NAME} United States of America > Illinois`;
const YEAR = 2022;
const EMAIL =
  process.env.CC_DEMO_EMAIL || "johndoe@example.com";
const PASSWORD = process.env.CC_DEMO_PASSWORD || "password";

async function dismissCookies(page) {
  const decline = page.getByTestId("cookie-decline-button");
  if (await decline.isVisible({ timeout: 2000 }).catch(() => false)) {
    await decline.click();
  }
}

async function login(page, step, highlight, wait) {
  await step("Log in with the demo account");
  await page.goto(`${BASE_URL}/en/auth/login`, {
    waitUntil: "domcontentloaded",
  });
  await dismissCookies(page);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const loginButton = page.getByRole("button", { name: /log in/i });
  await highlight(loginButton);
  await Promise.all([
    page.waitForURL((url) => url.pathname.includes("/cities"), {
      timeout: 30000,
    }),
    loginButton.click(),
  ]);
  await wait(1000);
}

async function cleanup2022(page, step) {
  await step(`Clean existing ${YEAR} data for ${CITY_NAME}`);
  const request = page.context().request;
  const citiesResponse = await request.get(`${BASE_URL}/api/v1/city`);
  if (!citiesResponse.ok()) return;

  const { data: cities = [] } = await citiesResponse.json();
  const matchingCities = cities.filter((city) => city.name === CITY_NAME);

  for (const city of matchingCities) {
    const inventoriesResponse = await request.get(
      `${BASE_URL}/api/v1/city/${city.cityId}/inventory`,
    );
    if (!inventoriesResponse.ok()) continue;

    const { data: inventories = [] } = await inventoriesResponse.json();
    for (const inventory of inventories) {
      if (Number(inventory.year) === YEAR) {
        await request.delete(
          `${BASE_URL}/api/v1/inventory/${inventory.inventoryId}`,
        );
      }
    }

    if (process.env.CC_DEMO_DELETE_EXISTING_CITY === "1") {
      await request.delete(`${BASE_URL}/api/v1/city/${city.cityId}`);
    }
  }
}

async function continueButton(page) {
  return page.getByRole("button", { name: /^Continue$/ }).last();
}

async function createCityAndInventory(page, step, highlight, wait, audit) {
  await step(`Create ${CITY_NAME}`);
  await page.goto(`${BASE_URL}/en/cities/onboarding/`, {
    waitUntil: "domcontentloaded",
  });
  await dismissCookies(page);

  const getStarted = page.getByRole("button", { name: /get started/i });
  if (await getStarted.isVisible({ timeout: 5000 }).catch(() => false)) {
    await highlight(getStarted);
    await getStarted.click();
  }

  await page.waitForURL("**/cities/onboarding/setup/**", { timeout: 30000 });
  const cityInput = page.locator('input[name="city"]');
  await highlight(cityInput);
  await cityInput.click();
  await wait(1200);
  await page.keyboard.type(CITY_NAME, { delay: 100 });
  await wait(2000);
  const result = page.getByText(new RegExp(`^${CITY_RESULT}\\s*$`));
  await result.waitFor({ timeout: 30000 });
  await highlight(result);
  await result.click();
  await page.getByTestId("selected-city-area").waitFor({ timeout: 30000 });
  audit.pass("City selection", `Selected ${CITY_RESULT}.`);

  let button = await continueButton(page);
  await highlight(button);
  await button.click();

  await step("Create a 2022 GPC Basic AR6 inventory");
  await page.getByTestId("inventory-details-heading").waitFor({
    timeout: 15000,
  });
  const yearSelect = page
    .locator('[data-testid="inventory-details-year"]')
    .locator("button")
    .first();
  await highlight(yearSelect);
  await yearSelect.click();
  await page.getByRole("option", { name: String(YEAR) }).click();
  await page.getByTestId("inventory-goal-gpc_basic").waitFor();
  await page.getByTestId("inventory-goal-ar6").waitFor();

  button = await continueButton(page);
  await highlight(button);
  await button.click();

  await page.getByTestId("add-population-data-heading").waitFor({
    timeout: 15000,
  });
  const population = page.getByPlaceholder("City population number");
  if (!(await population.inputValue().catch(() => ""))) {
    await population.fill("1000000");
    await page.locator('select[name="cityPopulationYear"]').selectOption("2022");
  }
  button = await continueButton(page);
  await highlight(button);
  await button.click();

  const thirdPartyYes = page.getByTestId("third-party-data-choice-yes");
  if (await thirdPartyYes.isVisible({ timeout: 10000 }).catch(() => false)) {
    await step("Include third-party data during onboarding");
    await highlight(thirdPartyYes);
    await thirdPartyYes.click();
  } else {
    await page.getByTestId("third-party-data-choice-no").click();
  }
  button = page.getByRole("button", { name: /continue/i });
  await highlight(button);
  await button.click();

  await page.waitForURL(/\/cities\/[^/]+\/GHGI\/[^/]+\/?$/, {
    timeout: 30000,
  });

  const match = page.url().match(/\/cities\/([^/]+)\/GHGI\/([^/]+)/);
  if (!match) throw new Error("Could not read cityId and inventoryId");
  audit.pass("City creation", `Created ${CITY_NAME} with cityId ${match[1]}.`);
  audit.pass(
    "2022 GPC Basic AR6 inventory creation",
    `Created inventory ${match[2]}.`,
  );
  return { cityId: match[1], inventoryId: match[2] };
}

async function addThirdPartyData(page, step, highlight, wait, ids, audit) {
  await step("Add third-party data");
  await page.goto(
    `${BASE_URL}/en/cities/${ids.cityId}/GHGI/${ids.inventoryId}/data/`,
    { waitUntil: "domcontentloaded" },
  );
  const sector = page.getByTestId("stationary-energy-sector-card");
  await sector.waitFor({ timeout: 15000 });
  await highlight(sector);
  await sector.getByTestId("sector-card-button").click();
  await page.waitForURL(/\/data\/1\/$/, { timeout: 30000 });
  await wait(1500);

  const search = page
    .getByRole("button")
    .filter({ hasText: /search.*third|third.*party|external.*data/i })
    .first();
  if (!(await search.isVisible({ timeout: 5000 }).catch(() => false))) {
    audit.partial(
      "Third-party data path",
      "Stationary Energy opened, but the third-party data search action was not visible.",
    );
    return;
  }

  await highlight(search);
  await search.click();
  await wait(3000);

  const source = page.locator('[data-testid*="source-card"]').first();
  if (await source.isVisible({ timeout: 5000 }).catch(() => false)) {
    await highlight(source);
    await source.click();
    const connect = page
      .getByRole("button")
      .filter({ hasText: /connect.*data/i })
      .last();
    if (await connect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await highlight(connect);
      await connect.click();
      await wait(3000);
      audit.pass("Third-party data path", "Connected an available source.");
    } else {
      audit.partial(
        "Third-party data path",
        "Opened a source, but the connect action was not available.",
      );
    }
  } else {
    await page.getByTestId("no-data-sources-message").waitFor({
      timeout: 5000,
    }).catch(() => {});
    audit.partial(
      "Third-party data path",
      "No third-party source was available; recorded the no-data state.",
    );
  }
}

async function addManualInput(page, step, highlight, wait, ids) {
  await step("Add manual input");
  await page.goto(
    `${BASE_URL}/en/cities/${ids.cityId}/GHGI/${ids.inventoryId}/data/1/`,
    { waitUntil: "domcontentloaded" },
  );
  await page.getByTestId("subsector-card").first().waitFor({ timeout: 15000 });
  await page.getByTestId("subsector-card").first().click();
  await wait(2500);

  const scopeOne = page.getByText(/^Scope 1$/);
  if (await scopeOne.isVisible({ timeout: 2000 }).catch(() => false)) {
    await scopeOne.click();
  }

  const methodology = page.getByTestId("methodology-card").first();
  if (await methodology.isVisible({ timeout: 5000 }).catch(() => false)) {
    await highlight(methodology);
    await methodology.click();
    await wait(1500);
  }

  const addActivity = page.getByText(/Add activity|Add emission/i).first();
  await highlight(addActivity);
  await addActivity.click();
  const modal = page.getByTestId("add-emission-modal");
  await modal.waitFor({ timeout: 15000 });

  await modal.getByLabel(/Building type/i).selectOption({ index: 1 }).catch(() => {});
  await modal.getByLabel(/Fuel type/i).selectOption({ index: 1 }).catch(() => {});
  await modal.getByLabel("Total fuel consumption").fill("100");
  await modal.getByLabel(/Select Unit/i).selectOption({ index: 1 }).catch(() => {});
  await modal.getByLabel(/Select emission factor type/i).selectOption("custom");
  await modal.getByLabel("CO2 emission factor").fill("10");
  await modal.getByLabel("N2O emission factor").fill("10");
  await modal.getByLabel("CH4 emission factor").fill("1");
  await modal.getByLabel(/Data Quality/i).selectOption("high");
  await modal.getByLabel("Data source").fill("CC demo manual input");
  await modal.getByLabel("Explanatory comments").fill("Recorded demo data");
  const submit = modal.getByTestId("add-emission-modal-submit");
  await highlight(submit);
  await submit.click();
  await modal.waitFor({ state: "hidden", timeout: 30000 });
}

async function reportAndDownload(page, step, highlight, wait, ids, audit) {
  await step("Report results");
  await page.goto(`${BASE_URL}/en/cities/${ids.cityId}/GHGI/${ids.inventoryId}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  const resultsReady = await page
    .getByRole("heading", { name: /Top Emissions|Emissions|Inventory/i })
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (resultsReady) {
    audit.pass("Results/reporting view", "Emissions dashboard content loaded.");
  } else {
    audit.partial(
      "Results/reporting view",
      "Dashboard opened, but expected emissions heading did not confirm within 30 seconds.",
    );
  }
  await wait(2500);

  await step("Download CSV");
  const downloadCard = page.getByTestId("download-action-card");
  await highlight(downloadCard);
  await downloadCard.click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  const downloadPromise = page.waitForEvent("download");
  const csvButton = page.getByTestId("download-csv-button");
  await highlight(csvButton);
  await csvButton.click();
  const download = await downloadPromise;
  const outputPath =
    process.env.CC_DEMO_CSV_PATH ||
    path.resolve(process.cwd(), "..", "demo-recording", "cc-demo-2022.csv");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await download.saveAs(outputPath);
  audit.pass("CSV download", { evidence: outputPath });
}

module.exports = async ({ page, step, highlight, wait, audit }) => {
  await audit.run("Authentication", () => login(page, step, highlight, wait));
  await audit.run(`Cleanup of existing ${YEAR} data`, () =>
    cleanup2022(page, step),
  );

  let ids;
  try {
    ids = await createCityAndInventory(page, step, highlight, wait, audit);
  } catch (error) {
    audit.fail("City selection, city creation, or inventory creation", error);
    throw error;
  }

  try {
    await addThirdPartyData(page, step, highlight, wait, ids, audit);
  } catch (error) {
    audit.fail("Third-party data path", error);
    throw error;
  }

  await audit.run("Manual input path", () =>
    addManualInput(page, step, highlight, wait, ids),
  );

  try {
    await reportAndDownload(page, step, highlight, wait, ids, audit);
  } catch (error) {
    audit.fail("Results/reporting view or CSV download", error);
    throw error;
  }
};
```

## City Selection

If the user has not specified a city, ask the audience to pick one before recording. Capture the chosen city in `CC_DEMO_CITY`, and if the autocomplete result is not the default Chicago pattern, set `CC_DEMO_CITY_RESULT` to the exact visible result text. The exact autocomplete spelling matters more than the typed search string.

Prefer cities with strong data coverage. For this demo, still create the inventory for `2022`.

## Verification

Before finalizing:

1. Check that the video exists and has nonzero duration.
2. Extract and inspect a representative frame.
3. Confirm the CSV was downloaded and saved.
4. Read `<name>-audit.md` or `<name>-audit.json` and make sure every required audit row is represented. Add a final `Video and CSV verification` audit result before reporting back when the scenario did not add it itself.

```powershell
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 ..\demo-recording\cc-demo-2022.mp4
ffmpeg -y -ss 00:00:10 -i ..\demo-recording\cc-demo-2022.mp4 -frames:v 1 ..\demo-recording\preview.png
```

In the final response, embed the MP4 with an absolute Markdown media path, include the CSV and audit paths, and summarize the audit point by point with `pass`, `partial`, `fail`, or `skipped` statuses.
