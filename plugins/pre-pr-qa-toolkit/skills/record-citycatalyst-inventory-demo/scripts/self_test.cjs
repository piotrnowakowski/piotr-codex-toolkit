const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  buildOutcomeSummary,
  classifyChatRequest,
  chooseEmptyYear,
  determineScenarioOutcome,
  ensureAvailableInventoryYear,
  findRecyclableDemoInventory,
  isConnectAllResponse,
  isCsvResponse,
  loadProfile,
  validateCsv,
  warmReadOnlyRouteBundles,
} = require("./citycatalyst_ui.cjs");

async function main() {
  const profilePath =
    process.argv[2] ||
    path.join(__dirname, "..", "assets", "profiles", "krakow.json");
  const profile = loadProfile(profilePath);
  const profileYears = profile.inventoryYears.map(String);
  const rows =
    profileYears.length > 1
      ? [
          {
            city: {
              name: profile.cityName,
              country: profile.countryName,
              locode: profile.cityLocode,
            },
            years: [{ year: profileYears[0], inventoryId: "existing" }],
          },
        ]
      : [];
  const expectedYear =
    profileYears.length > 1 ? profileYears[1] : profileYears[0];
  const selectedYear = chooseEmptyYear(rows, profile);
  if (selectedYear !== expectedYear) {
    throw new Error(
      `Expected first empty year ${expectedYear}; got ${selectedYear}`,
    );
  }

  const response = {
    url: () =>
      "http://localhost:3000/api/v1/inventory/example/download?format=csv&lng=en",
  };
  if (!isCsvResponse(response, "example")) {
    throw new Error(
      "CSV response matcher rejected the real no-trailing-slash route.",
    );
  }
  const connectAllResponse = {
    request: () => ({ method: () => "POST" }),
    url: () =>
      "http://localhost:3000/api/v1/datasource/4da5a53c-4e31-4122-8c3e-ebafa7427590/connect-all/",
  };
  if (!isConnectAllResponse(connectAllResponse)) {
    throw new Error(
      "Third-party connect-all response matcher rejected the real route.",
    );
  }

  const warmedUrls = [];
  const warmedRoutes = await warmReadOnlyRouteBundles(
    {
      request: {
        get: async (url) => {
          warmedUrls.push(url);
          return { status: () => 405 };
        },
      },
    },
    "http://localhost:3000",
  );
  if (
    warmedRoutes.length !== 4 ||
    warmedUrls.some((url) => !url.startsWith("http://localhost:3000/api/")) ||
    warmedRoutes.some(
      (route) => route.status !== 405 || route.mutationPerformed !== false,
    )
  ) {
    throw new Error(
      "Read-only route bundle warm-up did not cover all chat routes.",
    );
  }

  const fakeRequest = {
    method: () => "POST",
    url: () => "http://localhost:3000/api/v1/chat/messages/",
  };
  if (classifyChatRequest(fakeRequest) !== "message") {
    throw new Error(
      "Chat request classifier did not recognize the message route.",
    );
  }

  const passingSteps = {
    city: { status: "passed", selected: profile.cityName },
    inventory: {
      status: "passed",
      year: Number(selectedYear),
      goal: "GPC Basic",
      gwp: "AR6",
    },
    thirdParty: {
      status: "passed",
      verification: "Selected available third-party data.",
    },
    manualInput: {
      status: "passed",
      verification: "Manual entry returned HTTP 200.",
    },
    climateAdvisor: {
      status: "passed",
      answer:
        "GPC is the core city emissions standard; GPC+ adds wider reporting.",
    },
    results: { status: "passed", visibleSummary: "Total Emissions" },
  };
  if (determineScenarioOutcome(passingSteps) !== "passed") {
    throw new Error("All-passing core steps did not produce a passed outcome.");
  }
  const failingSteps = {
    ...passingSteps,
    climateAdvisor: {
      status: "failed",
      error:
        "No complete visible Clima answer appeared within 60 seconds of Send.",
    },
  };
  const splitSummary = buildOutcomeSummary(failingSteps);
  if (
    determineScenarioOutcome(failingSteps) !== "failed" ||
    splitSummary.worked.length !== 5 ||
    splitSummary.didNotWork.length !== 1 ||
    splitSummary.didNotWork[0].step !== "climateAdvisor"
  ) {
    throw new Error(
      "Worked/did-not-work reporting did not split failed steps.",
    );
  }

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "citycatalyst-skill-self-test-"),
  );
  let verifierScenarioFailure = "skipped-ffmpeg-unavailable";
  try {
    const allOccupiedRows = [
      {
        city: {
          id: "krakow-city",
          name: profile.cityName,
          country: profile.countryName,
          locode: profile.cityLocode,
        },
        years: profileYears.map((year) => ({
          year,
          inventoryId: `inventory-${year}`,
        })),
      },
    ];
    let unprovenDeletionAttempted = false;
    let unprovenCleanupRefused = false;
    try {
      await ensureAvailableInventoryYear({
        page: {
          request: {
            delete: async () => {
              unprovenDeletionAttempted = true;
              throw new Error("Unproven deletion should never be attempted.");
            },
          },
        },
        baseUrl: "http://localhost:3000",
        rows: allOccupiedRows,
        profile,
        runRoot: tempDir,
      });
    } catch (error) {
      unprovenCleanupRefused = /Cleanup was refused/.test(error.message);
    }
    if (unprovenDeletionAttempted || !unprovenCleanupRefused) {
      throw new Error(
        "All-years-occupied fallback did not safely refuse unproven cleanup.",
      );
    }

    const ownedYear = profileYears.at(-1);
    const priorRunDir = path.join(
      tempDir,
      `${profile.slug}-inventory-demo-20260101-000000`,
    );
    fs.mkdirSync(priorRunDir, { recursive: true });
    fs.writeFileSync(
      path.join(priorRunDir, "flow-report.json"),
      `${JSON.stringify({
        kind: "citycatalyst-inventory-demo",
        city: profile.cityName,
        country: profile.countryName,
        inventoryYear: Number(ownedYear),
        startedAt: "2026-01-01T00:00:00.000Z",
        steps: {
          dashboard: {
            inventoryId: `inventory-${ownedYear}`,
          },
        },
      })}\n`,
    );
    const recyclable = findRecyclableDemoInventory(
      allOccupiedRows,
      profile,
      tempDir,
    );
    if (
      recyclable?.inventoryId !== `inventory-${ownedYear}` ||
      recyclable?.year !== ownedYear
    ) {
      throw new Error(
        "Demo-owned inventory recycling did not require exact artifact proof.",
      );
    }
    let deletedInventoryId = null;
    const page = {
      request: {
        delete: async (url) => {
          deletedInventoryId = url.split("/").filter(Boolean).at(-1);
          return {
            ok: () => true,
            status: () => 200,
            json: async () => ({ deleted: true }),
          };
        },
        get: async () => ({
          ok: () => true,
          json: async () => ({
            data: allOccupiedRows.map((row) => ({
              ...row,
              years: row.years.filter(
                (item) => item.inventoryId !== deletedInventoryId,
              ),
            })),
          }),
        }),
      },
    };
    let cleanupApprovalRequired = false;
    try {
      await ensureAvailableInventoryYear({
        page,
        baseUrl: "http://localhost:3000",
        rows: allOccupiedRows,
        profile,
        runRoot: tempDir,
        proposalDir: tempDir,
      });
    } catch (error) {
      cleanupApprovalRequired = /requires explicit approval/.test(
        error.message,
      );
    }
    if (
      deletedInventoryId ||
      !cleanupApprovalRequired ||
      !fs.existsSync(path.join(tempDir, "cleanup-proposal.json"))
    ) {
      throw new Error(
        "Artifact-proven cleanup did not stop for explicit approval and write a proposal.",
      );
    }

    const recycledAllocation = await ensureAvailableInventoryYear({
      page,
      baseUrl: "http://localhost:3000",
      rows: allOccupiedRows,
      profile,
      runRoot: tempDir,
      proposalDir: tempDir,
      allowVerifiedDemoCleanup: true,
    });
    if (
      recycledAllocation.year !== ownedYear ||
      recycledAllocation.cleanup?.inventoryId !== `inventory-${ownedYear}` ||
      recycledAllocation.cleanup?.action !==
        "deleted-one-demo-owned-inventory" ||
      recycledAllocation.cleanup?.approval !== "explicit-run-authorization"
    ) {
      throw new Error(
        "All-years-occupied fallback did not recycle exactly one owned inventory.",
      );
    }

    const ccLogPath = path.join(tempDir, "cc-source.log");
    const caLogPath = path.join(tempDir, "ca-source.log");
    fs.writeFileSync(
      ccLogPath,
      "2026-09-01T10:00:00Z ERROR request failed token=cc-secret\nPOST /api/v1/test 500 12ms\n",
    );
    fs.writeFileSync(
      caLogPath,
      '2026-09-01T10:00:01Z CRITICAL exception password=ca-secret\n{"status":502,"path":"/v1/test"}\n',
    );
    const logCollector = spawnSync(
      process.execPath,
      [
        path.join(__dirname, "collect_runtime_logs.cjs"),
        "--run-dir",
        tempDir,
        "--cc-log",
        ccLogPath,
        "--ca-log",
        caLogPath,
        "--since",
        "2026-09-01T09:59:59.000Z",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (logCollector.status !== 0) {
      throw new Error(`Runtime log collector failed: ${logCollector.stderr}`);
    }
    const runtimeErrors = JSON.parse(
      fs.readFileSync(path.join(tempDir, "runtime-errors.json"), "utf8"),
    );
    const persistedLogEvidence = [
      fs.readFileSync(path.join(tempDir, "cc-runtime.log"), "utf8"),
      fs.readFileSync(path.join(tempDir, "ca-runtime.log"), "utf8"),
      fs.readFileSync(path.join(tempDir, "runtime-errors.json"), "utf8"),
      fs.readFileSync(path.join(tempDir, "runtime-errors.md"), "utf8"),
    ].join("\n");
    if (
      runtimeErrors.services.cc.errorCount !== 2 ||
      runtimeErrors.services.ca.errorCount !== 2 ||
      /cc-secret|ca-secret/.test(persistedLogEvidence)
    ) {
      throw new Error(
        "Runtime log collector did not preserve every error occurrence with secret redaction.",
      );
    }

    const csvPath = path.join(tempDir, "sample.csv");
    fs.writeFileSync(csvPath, "sector,emissions\nStationary Energy,123\n");
    if (!validateCsv(csvPath).valid) {
      throw new Error("CSV validation rejected a header plus data row.");
    }

    const verifier = spawnSync(
      process.execPath,
      [path.join(__dirname, "verify_artifacts.cjs")],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          RUN_DIR: tempDir,
          TAKE_NAME: "empty-artifact-test",
        },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (verifier.status !== 2) {
      throw new Error(
        `Expected empty media verification to exit 2; got ${verifier.status}. ${verifier.stderr}`,
      );
    }
    const verification = JSON.parse(
      fs.readFileSync(path.join(tempDir, "verification.json"), "utf8"),
    );
    if (verification.status !== "artifact-incomplete") {
      throw new Error(
        `Expected artifact-incomplete; got ${verification.status}`,
      );
    }

    const failedScenarioDir = path.join(tempDir, "failed-scenario");
    fs.mkdirSync(failedScenarioDir, { recursive: true });
    const failedScenarioMedia = path.join(
      failedScenarioDir,
      "failed-scenario.webm",
    );
    const mediaGeneration = spawnSync(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=16x16:d=0.1",
        "-c:v",
        "libvpx",
        "-y",
        failedScenarioMedia,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    fs.writeFileSync(
      path.join(failedScenarioDir, "failed-scenario.json"),
      `${JSON.stringify({ ok: true })}\n`,
    );
    fs.writeFileSync(
      path.join(failedScenarioDir, "flow-report.json"),
      `${JSON.stringify({
        outcome: "failed",
        summary: splitSummary,
        steps: { csv: { status: "skipped" } },
      })}\n`,
    );
    const unavailableLogCollector = spawnSync(
      process.execPath,
      [
        path.join(__dirname, "collect_runtime_logs.cjs"),
        "--run-dir",
        failedScenarioDir,
        "--cc-unavailable-reason",
        "Self-test has no CC process.",
        "--ca-unavailable-reason",
        "Self-test has no CA process.",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (unavailableLogCollector.status !== 0) {
      throw new Error(
        `Unavailable-log coverage test failed: ${unavailableLogCollector.stderr}`,
      );
    }
    if (mediaGeneration.status === 0) {
      const failedScenarioVerifier = spawnSync(
        process.execPath,
        [path.join(__dirname, "verify_artifacts.cjs")],
        {
          cwd: failedScenarioDir,
          env: {
            ...process.env,
            RUN_DIR: failedScenarioDir,
            TAKE_NAME: "failed-scenario",
          },
          encoding: "utf8",
          windowsHide: true,
        },
      );
      if (failedScenarioVerifier.status !== 2) {
        throw new Error(
          `Expected failed scenario verification to exit 2; got ${failedScenarioVerifier.status}.`,
        );
      }
      const failedScenarioVerification = JSON.parse(
        fs.readFileSync(
          path.join(failedScenarioDir, "verification.json"),
          "utf8",
        ),
      );
      if (
        failedScenarioVerification.status !== "scenario-failed" ||
        failedScenarioVerification.summary?.didNotWork?.[0]?.step !==
          "climateAdvisor"
      ) {
        throw new Error(
          `Verifier did not preserve the split report for a failed scenario: ${JSON.stringify(failedScenarioVerification)}`,
        );
      }
      verifierScenarioFailure = "passed";
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      profile: profile.slug,
      selectedYear,
      demoOwnedInventoryRecycling: "passed",
      explicitCleanupApproval: "passed",
      runtimeLogCollection: "passed",
      readOnlyRouteWarmup: "passed",
      splitReporting: "passed",
      thirdPartyVerification: "passed",
      verifierScenarioFailure,
      csvRouteMatcher: "passed",
      csvValidation: "passed",
      verifierFailurePath: "passed",
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
