const fs = require("node:fs");
const path = require("node:path");

const CORE_DEMO_STEPS = [
  "city",
  "inventory",
  "thirdParty",
  "manualInput",
  "climateAdvisor",
  "results",
];

const STEP_LABELS = {
  city: "City creation",
  inventory: "Inventory creation",
  thirdParty: "Third-party data selection",
  manualInput: "Manual data entry",
  climateAdvisor: "Clima answer",
  results: "Inventory results",
  csv: "CSV export",
};

const READ_ONLY_ROUTE_WARMUPS = [
  {
    name: "chatThreads",
    path: "/api/v1/chat/threads/",
  },
  {
    name: "caUserToken",
    path: "/api/v1/internal/ca/user-token/",
  },
  {
    name: "chatMessages",
    path: "/api/v1/chat/messages/",
  },
  {
    name: "threadExport",
    path: "/api/v1/assistants/threads/export/",
  },
];

function slugify(value) {
  return (
    String(value || "city")
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "city"
  );
}

function loadProfile(profilePath) {
  const resolved = path.resolve(profilePath);
  const profile = JSON.parse(fs.readFileSync(resolved, "utf8"));
  for (const key of [
    "cityName",
    "countryName",
    "inventoryYears",
    "population",
    "manualInput",
  ]) {
    if (profile[key] == null) {
      throw new Error(`Demo profile is missing ${key}: ${resolved}`);
    }
  }
  if (
    !Array.isArray(profile.inventoryYears) ||
    profile.inventoryYears.length === 0
  ) {
    throw new Error(
      `Demo profile inventoryYears must be a non-empty array: ${resolved}`,
    );
  }
  profile.slug = slugify(profile.slug || profile.cityName);
  const originalCityName = profile.cityName;
  if (process.env.DEMO_CITY_NAME) {
    const sameCity =
      String(process.env.DEMO_CITY_NAME).toLocaleLowerCase() ===
      String(originalCityName).toLocaleLowerCase();
    profile.cityName = process.env.DEMO_CITY_NAME;
    profile.countryName = process.env.DEMO_COUNTRY_NAME || profile.countryName;
    profile.cityLocode =
      process.env.DEMO_CITY_LOCODE || (sameCity ? profile.cityLocode : null);
    profile.slug = slugify(profile.cityName);
    if (!sameCity) {
      profile.population = {
        city: process.env.DEMO_CITY_POPULATION || null,
        region: process.env.DEMO_REGION_POPULATION || null,
        country: process.env.DEMO_COUNTRY_POPULATION || null,
      };
    }
  }
  profile.profilePath = resolved;
  return profile;
}

function requireCredentials() {
  if (!process.env.DEMO_EMAIL || !process.env.DEMO_PASSWORD) {
    throw new Error(
      "DEMO_EMAIL and DEMO_PASSWORD are required. The launcher loads them without printing them.",
    );
  }
}

async function signIn(page, baseUrl, callbackUrl) {
  requireCredentials();
  const csrfResponse = await page.request.get(`${baseUrl}/api/auth/csrf/`);
  if (!csrfResponse.ok()) {
    throw new Error(
      `Could not obtain login CSRF token: ${csrfResponse.status()}`,
    );
  }
  const { csrfToken } = await csrfResponse.json();
  const loginResponse = await page.request.post(
    `${baseUrl}/api/auth/callback/credentials/`,
    {
      form: {
        csrfToken,
        email: process.env.DEMO_EMAIL,
        password: process.env.DEMO_PASSWORD,
        callbackUrl,
        json: "true",
      },
    },
  );
  if (!loginResponse.ok()) {
    throw new Error(`Local login failed: ${loginResponse.status()}`);
  }
}

async function fetchUserCities(page, baseUrl) {
  const response = await page.request.get(`${baseUrl}/api/v1/user/cities/`);
  if (!response.ok()) {
    throw new Error(
      `Could not inspect existing city inventories: ${response.status()}`,
    );
  }
  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

function cityMatchesProfile(row, profile) {
  const city = row?.city || {};
  if (profile.cityLocode && city.locode === profile.cityLocode) return true;
  return (
    String(city.name || "").toLocaleLowerCase() ===
      String(profile.cityName).toLocaleLowerCase() &&
    (!profile.countryName ||
      String(city.country || "").toLocaleLowerCase() ===
        String(profile.countryName).toLocaleLowerCase())
  );
}

function chooseEmptyYear(rows, profile, requestedYear) {
  const occupiedYears = new Set(
    rows
      .filter((row) => cityMatchesProfile(row, profile))
      .flatMap((row) => (row.years || []).map((item) => String(item.year))),
  );
  if (requestedYear) {
    const year = String(requestedYear);
    if (occupiedYears.has(year)) {
      throw new Error(
        `Requested inventory year ${year} already exists for ${profile.cityName}`,
      );
    }
    if (!profile.inventoryYears.map(String).includes(year)) {
      throw new Error(
        `Requested inventory year ${year} is outside the profile coverage window`,
      );
    }
    return year;
  }
  const emptyYear = profile.inventoryYears
    .map(String)
    .find((year) => !occupiedYears.has(year));
  if (!emptyYear) {
    throw new Error(
      `${profile.cityName} has no empty inventory year in ${profile.inventoryYears.join(", ")}`,
    );
  }
  return emptyYear;
}

function listProfileInventories(rows, profile) {
  const allowedYears = new Set(profile.inventoryYears.map(String));
  return rows
    .filter((row) => cityMatchesProfile(row, profile))
    .flatMap((row) =>
      (row.years || [])
        .filter(
          (item) =>
            allowedYears.has(String(item.year)) &&
            typeof item.inventoryId === "string" &&
            item.inventoryId.trim() !== "",
        )
        .map((item) => ({
          cityId: row?.city?.id || null,
          inventoryId: item.inventoryId,
          year: String(item.year),
        })),
    );
}

function findRecyclableDemoInventory(rows, profile, runRoot) {
  const cleanupMode = profile.inventoryCleanup?.whenAllRankedYearsOccupied;
  if (
    cleanupMode !== "propose-oldest-demo-owned-inventory" &&
    cleanupMode !== "recycle-oldest-demo-owned-inventory"
  ) {
    return null;
  }
  if (!runRoot || !fs.existsSync(runRoot)) return null;

  const existingById = new Map(
    listProfileInventories(rows, profile).map((item) => [
      item.inventoryId,
      item,
    ]),
  );
  const runPrefix = `${profile.slug}-inventory-demo-`;
  const owned = [];
  for (const entry of fs.readdirSync(runRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(runPrefix)) continue;
    const reportPath = path.join(runRoot, entry.name, "flow-report.json");
    if (!fs.existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      const inventoryId = report?.steps?.dashboard?.inventoryId;
      const existing = existingById.get(inventoryId);
      if (
        report?.kind !== "citycatalyst-inventory-demo" ||
        !existing ||
        String(report.city || "").toLocaleLowerCase() !==
          String(profile.cityName).toLocaleLowerCase() ||
        String(report.country || "").toLocaleLowerCase() !==
          String(profile.countryName || "").toLocaleLowerCase() ||
        String(report.inventoryYear) !== existing.year
      ) {
        continue;
      }
      const reportTime = Date.parse(report.startedAt);
      owned.push({
        ...existing,
        proof: reportPath,
        recordedAt: Number.isFinite(reportTime)
          ? new Date(reportTime).toISOString()
          : fs.statSync(reportPath).mtime.toISOString(),
      });
    } catch {
      // A malformed old report cannot prove ownership, so it is ignored.
    }
  }
  owned.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  return owned[0] || null;
}

async function ensureAvailableInventoryYear({
  page,
  baseUrl,
  rows,
  profile,
  requestedYear,
  runRoot,
  proposalDir,
  allowVerifiedDemoCleanup = false,
}) {
  try {
    return {
      year: chooseEmptyYear(rows, profile, requestedYear),
      cleanup: null,
    };
  } catch (error) {
    if (requestedYear) throw error;
    const recyclable = findRecyclableDemoInventory(rows, profile, runRoot);
    if (!recyclable) {
      throw new Error(
        `${error.message}. Cleanup was refused because no matching inventory could be proven to belong to an earlier demo run.`,
      );
    }

    const cleanupProposal = {
      kind: "citycatalyst-inventory-demo-cleanup-proposal",
      status: allowVerifiedDemoCleanup ? "authorized" : "approval-required",
      city: profile.cityName,
      country: profile.countryName,
      inventoryId: recyclable.inventoryId,
      year: Number(recyclable.year),
      ownershipProof: recyclable.proof,
      recordedAt: recyclable.recordedAt,
      requestedAction: "delete-one-demo-owned-inventory",
    };
    const cleanupProposalPath = proposalDir
      ? path.join(proposalDir, "cleanup-proposal.json")
      : null;
    if (cleanupProposalPath) {
      writeJson(cleanupProposalPath, cleanupProposal);
    }
    if (!allowVerifiedDemoCleanup) {
      throw new Error(
        `${error.message}. One matching demo-owned inventory was found, but cleanup requires explicit approval. Review ${cleanupProposalPath || recyclable.proof} and rerun with -AllowVerifiedDemoCleanup.`,
      );
    }

    const response = await page.request.delete(
      `${baseUrl}/api/v1/inventory/${recyclable.inventoryId}/`,
    );
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // The status and deleted flag checks below will report a safe failure.
    }
    if (!response.ok() || payload?.deleted !== true) {
      throw new Error(
        `Could not recycle demo-owned ${profile.cityName} ${recyclable.year} inventory: HTTP ${response.status()}`,
      );
    }

    const refreshedRows = await fetchUserCities(page, baseUrl);
    const year = chooseEmptyYear(refreshedRows, profile);
    if (year !== recyclable.year) {
      throw new Error(
        `Deleted demo inventory year ${recyclable.year}, but the next selected year was unexpectedly ${year}`,
      );
    }
    return {
      year,
      cleanup: {
        status: "passed",
        action: "deleted-one-demo-owned-inventory",
        inventoryId: recyclable.inventoryId,
        year: Number(recyclable.year),
        ownershipProof: recyclable.proof,
        recordedAt: recyclable.recordedAt,
        approval: "explicit-run-authorization",
        proposalPath: cleanupProposalPath,
      },
    };
  }
}

function chooseWarmupInventory(rows, profile) {
  const preferred = rows.find(
    (row) => cityMatchesProfile(row, profile) && (row.years || []).length > 0,
  );
  const fallback = rows.find((row) => (row.years || []).length > 0);
  const selected = preferred || fallback;
  if (!selected) return null;
  const year = [...selected.years].sort((a, b) => b.year - a.year)[0];
  return {
    city: selected.city,
    year: year.year,
    inventoryId: year.inventoryId,
  };
}

function inventoryUrl(baseUrl, lng, cityId, inventoryId) {
  return `${baseUrl}/${lng}/cities/${cityId}/GHGI/${inventoryId}/`;
}

async function warmReadOnlyRouteBundles(
  page,
  baseUrl,
  routes = READ_ONLY_ROUTE_WARMUPS,
) {
  const warmed = [];
  for (const route of routes) {
    const startedAt = Date.now();
    const response = await page.request.get(`${baseUrl}${route.path}`, {
      failOnStatusCode: false,
      timeout: 45_000,
    });
    const status = response.status();
    const elapsedMs = Date.now() - startedAt;
    if (status !== 405) {
      throw new Error(
        `Read-only route warm-up for ${route.path} returned HTTP ${status}; expected 405 from a POST-only endpoint.`,
      );
    }
    warmed.push({
      name: route.name,
      path: route.path,
      method: "GET",
      status,
      elapsedMs,
      mutationPerformed: false,
    });
  }
  return warmed;
}

function classifyChatRequest(request) {
  if (!request || request.method() !== "POST") return null;
  let pathname;
  try {
    pathname = new URL(request.url()).pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
  const routes = {
    "/api/v1/chat/threads": "thread",
    "/api/v1/chat/messages": "message",
    "/api/v1/assistants/threads/export": "threadExport",
  };
  return routes[pathname] || null;
}

function createChatRequestTracker(page) {
  const trace = {
    sendClickedAt: null,
    thread: null,
    message: null,
    threadExport: null,
  };
  let sendClickedMs = null;

  const onRequest = (request) => {
    const key = classifyChatRequest(request);
    if (!key || trace[key]?.requestStartedAt) return;
    const requestStartedMs = Date.now();
    trace[key] = {
      requestStartedAt: new Date(requestStartedMs).toISOString(),
      requestOffsetMs:
        sendClickedMs == null ? null : requestStartedMs - sendClickedMs,
      responseAt: null,
      responseOffsetMs: null,
      status: null,
    };
  };

  const onResponse = (response) => {
    const key = classifyChatRequest(response.request());
    if (!key) return;
    const responseMs = Date.now();
    if (!trace[key]) onRequest(response.request());
    trace[key].responseAt = new Date(responseMs).toISOString();
    trace[key].responseOffsetMs =
      sendClickedMs == null ? null : responseMs - sendClickedMs;
    trace[key].status = response.status();
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  return {
    markSendClicked() {
      sendClickedMs = Date.now();
      trace.sendClickedAt = new Date(sendClickedMs).toISOString();
      return sendClickedMs;
    },
    snapshot() {
      return JSON.parse(JSON.stringify(trace));
    },
    stop() {
      page.off("request", onRequest);
      page.off("response", onResponse);
    },
  };
}

function summarizeStep(name, detail) {
  if (!detail) return "Step was not reached.";
  if (detail.error) return String(detail.error).replace(/\s+/g, " ").trim();
  if (name === "city") return `Selected ${detail.selected}.`;
  if (name === "inventory") {
    return `Created ${detail.year} ${detail.goal} inventory using ${detail.gwp}.`;
  }
  if (name === "thirdParty") {
    return (
      detail.verification ||
      "Selected available third-party data and continued onboarding."
    );
  }
  if (name === "manualInput") {
    return (
      detail.verification || `Submitted manual data for ${detail.subsector}.`
    );
  }
  if (name === "climateAdvisor") {
    return detail.answer
      ? `Received a complete visible answer: ${detail.answer}`
      : "No complete visible Clima answer was recorded.";
  }
  if (name === "results") {
    return detail.visibleSummary
      ? `Rendered ${detail.visibleSummary}.`
      : "The results surface did not render.";
  }
  if (name === "csv") {
    return detail.path
      ? `Downloaded and validated ${detail.path}.`
      : detail.reason || "CSV export did not complete.";
  }
  return detail.verification || detail.visibleSummary || detail.status;
}

function buildOutcomeSummary(steps, { includeCsv = false } = {}) {
  const names = includeCsv ? [...CORE_DEMO_STEPS, "csv"] : CORE_DEMO_STEPS;
  const worked = [];
  const didNotWork = [];
  for (const name of names) {
    const detail = steps[name];
    const entry = {
      step: name,
      label: STEP_LABELS[name] || name,
      status: detail?.status || "not-run",
      evidence: summarizeStep(name, detail),
    };
    if (detail?.status === "passed") {
      worked.push(entry);
    } else {
      didNotWork.push(entry);
    }
  }
  return { worked, didNotWork };
}

function determineScenarioOutcome(steps, fatalError) {
  if (fatalError) return "failed";
  return CORE_DEMO_STEPS.every((name) => steps[name]?.status === "passed")
    ? "passed"
    : "failed";
}

async function locatorSnapshot(locator) {
  const count = await locator.count().catch(() => 0);
  const rows = [];
  for (let index = 0; index < Math.min(count, 5); index += 1) {
    const item = locator.nth(index);
    rows.push({
      visible: await item.isVisible().catch(() => false),
      enabled: await item.isEnabled().catch(() => false),
      text: await item.innerText().catch(() => ""),
      ariaExpanded: await item.getAttribute("aria-expanded").catch(() => null),
      dataState: await item.getAttribute("data-state").catch(() => null),
    });
  }
  return { count, rows };
}

async function waitForAnyVisible(page, candidates, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (await candidate.locator.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    await page.waitForTimeout(200);
  }
  return null;
}

async function waitForDashboardStable(page, timeout = 45_000) {
  const hero = page.getByTestId("hero-city-name");
  const addData = page.getByTestId("add-data-to-inventory-card");
  await hero.waitFor({ state: "visible", timeout });
  await addData.waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () =>
      document.readyState === "complete" ||
      document.readyState === "interactive",
    null,
    { timeout },
  );
  await page.waitForTimeout(800);
  return {
    cityName: (await hero.innerText()).trim(),
    addDataVisible: await addData.isVisible(),
  };
}

async function openClimaAndConfirm(
  page,
  { highlight, wait, timeout = 20_000 } = {},
) {
  const trigger = page.locator("[data-ai-button]");
  await trigger.waitFor({ state: "visible", timeout: 45_000 });
  if (highlight) await highlight(trigger, { holdMs: 400 });
  await trigger.click();

  const input = page.locator('textarea[placeholder*="Ask assistant"]:visible');
  const disclaimer = page.getByRole("button", {
    name: /Start using Clima AI/i,
  });
  let visible = await waitForAnyVisible(
    page,
    [
      { kind: "input", locator: input },
      { kind: "disclaimer", locator: disclaimer },
    ],
    Math.min(timeout, 5_000),
  );

  if (!visible) {
    const closedState = await locatorSnapshot(trigger);
    const confirmedClosed =
      closedState.rows.length > 0 &&
      closedState.rows.every(
        (row) =>
          row.ariaExpanded === "false" &&
          (row.dataState == null || row.dataState === "closed"),
      );
    if (confirmedClosed) {
      await trigger.focus();
      await trigger.press("Enter");
      visible = await waitForAnyVisible(
        page,
        [
          { kind: "input", locator: input },
          { kind: "disclaimer", locator: disclaimer },
        ],
        Math.max(1_000, timeout - 5_000),
      );
    }
  }

  if (visible?.kind === "disclaimer") {
    if (highlight) await highlight(disclaimer, { holdMs: 300 });
    await disclaimer.click();
    await input.waitFor({ state: "visible", timeout });
    visible = { kind: "input", locator: input };
  }

  if (!visible || visible.kind !== "input") {
    const snapshot = await locatorSnapshot(trigger);
    throw new Error(
      `Clima launcher did not open a visible input. Trigger state: ${JSON.stringify(snapshot)}`,
    );
  }

  if (wait) await wait(300);
  return {
    input,
    triggerState: await locatorSnapshot(trigger),
  };
}

async function openDownloadModal(page, { highlight, timeout = 45_000 } = {}) {
  await waitForDashboardStable(page, timeout);
  const card = page.getByTestId("download-action-card");
  try {
    await card.waitFor({ state: "visible", timeout });
  } catch (error) {
    const addData = await locatorSnapshot(
      page.getByTestId("add-data-to-inventory-card"),
    );
    const collaborator = await locatorSnapshot(
      page.getByText(/Invite collaborators/i),
    );
    const download = await locatorSnapshot(card);
    throw new Error(
      `Download action card did not become visible. ` +
        `addData=${JSON.stringify(addData)} ` +
        `collaborator=${JSON.stringify(collaborator)} ` +
        `download=${JSON.stringify(download)} ` +
        `cause=${error.message}`,
    );
  }
  await card.scrollIntoViewIfNeeded().catch(() => {});
  if (highlight) await highlight(card, { holdMs: 400 });
  await card.click();
  const modalTitle = page.getByTestId("download-modal-title");
  await modalTitle.waitFor({ state: "visible", timeout: 15_000 });
  return { card, modalTitle };
}

function isCsvResponse(response, inventoryId) {
  try {
    const url = new URL(response.url());
    return (
      url.pathname.includes(`/api/v1/inventory/${inventoryId}/download`) &&
      url.searchParams.get("format")?.toLowerCase() === "csv"
    );
  } catch {
    return false;
  }
}

function isConnectAllResponse(response) {
  try {
    const url = new URL(response.url());
    return (
      response.request().method() === "POST" &&
      /^\/api\/v1\/datasource\/[0-9a-f-]+\/connect-all\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function validateCsv(csvPath) {
  const exists = fs.existsSync(csvPath);
  const bytes = exists ? fs.statSync(csvPath).size : 0;
  const text = bytes ? fs.readFileSync(csvPath, "utf8") : "";
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  return {
    exists,
    bytes,
    nonEmptyLines: lines.length,
    header: lines[0] || null,
    valid: exists && bytes > 0 && lines.length >= 2,
  };
}

async function downloadCsv(
  page,
  { inventoryId, csvPath, highlight, timeout = 45_000 },
) {
  const button = page.getByTestId("download-csv-button");
  await button.waitFor({ state: "visible", timeout: 15_000 });
  if (highlight) await highlight(button, { holdMs: 400 });

  const nativeDownload = page
    .waitForEvent("download", { timeout })
    .then((download) => ({ kind: "download", download }));
  const responseDownload = page
    .waitForResponse((response) => isCsvResponse(response, inventoryId), {
      timeout,
    })
    .then((response) => ({ kind: "response", response }));

  await button.click();
  let outcome;
  try {
    outcome = await Promise.any([nativeDownload, responseDownload]);
  } catch (error) {
    throw new Error(
      `No CSV download event or response completed: ${error.message}`,
    );
  }

  if (outcome.kind === "download") {
    await outcome.download.saveAs(csvPath);
  } else {
    if (!outcome.response.ok()) {
      throw new Error(
        `CSV response failed with HTTP ${outcome.response.status()}`,
      );
    }
    fs.writeFileSync(csvPath, await outcome.response.body());
  }

  const validation = validateCsv(csvPath);
  if (!validation.valid) {
    throw new Error(
      `CSV is missing, empty, or lacks a header plus data row: ${JSON.stringify(validation)}`,
    );
  }
  return { ...validation, source: outcome.kind, path: csvPath };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createCheckpointWriter(runDir, report) {
  const reportPath = path.join(runDir, "flow-report.json");
  const checkpointPath = path.join(runDir, "checkpoints.json");
  const checkpoints = [];
  return {
    reportPath,
    checkpointPath,
    persist(label, detail = {}) {
      checkpoints.push({
        label,
        at: new Date().toISOString(),
        ...detail,
      });
      writeJson(reportPath, report);
      writeJson(checkpointPath, checkpoints);
    },
  };
}

module.exports = {
  buildOutcomeSummary,
  classifyChatRequest,
  chooseEmptyYear,
  chooseWarmupInventory,
  cityMatchesProfile,
  createChatRequestTracker,
  createCheckpointWriter,
  determineScenarioOutcome,
  downloadCsv,
  ensureAvailableInventoryYear,
  fetchUserCities,
  findRecyclableDemoInventory,
  inventoryUrl,
  isConnectAllResponse,
  isCsvResponse,
  loadProfile,
  locatorSnapshot,
  openClimaAndConfirm,
  openDownloadModal,
  requireCredentials,
  signIn,
  slugify,
  validateCsv,
  warmReadOnlyRouteBundles,
  waitForDashboardStable,
  writeJson,
};
