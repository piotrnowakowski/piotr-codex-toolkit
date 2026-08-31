#!/usr/bin/env node

/*
Brief: Record a browser demo with Playwright and optional scenario automation.

Inputs:
- CLI args:
  - --script: CommonJS scenario module exporting an async function.
  - --url: URL to open when no scenario is provided, or before the scenario runs.
  - --output-dir: Directory where Playwright stores recordings and audit artifacts.
  - --name: Base filename for generated video and audit files.
  - --headed: Launch Chromium visibly instead of headless.
- Files/paths: scenario scripts are resolved from the current working directory.
- Env vars: scenario-owned; the recorder itself does not require secrets.

Outputs:
- <name>.webm and, when ffmpeg is available, <name>.mp4 in --output-dir.
- <name>-audit.json and <name>-audit.md when a scenario uses the audit helper or fails.

Usage:
- node <installed-cc-demo-recorder-skill-directory>\scripts\record_demo.cjs --script ..\demo-recording\cc-demo-scenario.cjs --output-dir ..\demo-recording --name cc-demo-2022 --headed
*/

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function printUsage() {
  console.log(`Usage:
  node record_demo.cjs --output-dir <dir> --name <video-name> [--script <scenario.cjs>] [--url <url>] [--headed]

Options:
  --script      CommonJS scenario module exporting an async function
  --url         URL to open when no scenario is provided, or before the scenario runs
  --output-dir  Directory where Playwright should store recordings and audit artifacts
  --name        Base filename for the saved recording and audit files
  --headed      Launch Chromium in headed mode
  --help        Show this message
`);
}

function parseArgs(argv) {
  const args = {
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--headed") {
      args.headed = true;
      continue;
    }

    if (
      token === "--script" ||
      token === "--url" ||
      token === "--output-dir" ||
      token === "--name"
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      args[token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function resolveFromCwd(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "demo";
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack || "",
  };
}

function normalizeAuditDetails(details) {
  if (!details) {
    return {};
  }

  if (typeof details === "string") {
    return { notes: details };
  }

  if (details instanceof Error) {
    return { notes: details.message, error: serializeError(details) };
  }

  return details;
}

function createAudit(outputDir, safeName) {
  const startedAt = new Date().toISOString();
  const entries = [];

  function add(status, stepName, details) {
    const payload = normalizeAuditDetails(details);
    const entry = {
      step: stepName,
      status,
      at: new Date().toISOString(),
      ...payload,
    };

    entries.push(entry);

    const suffix = entry.notes ? ` - ${entry.notes}` : "";
    console.log(`[audit:${status}] ${stepName}${suffix}`);
    return entry;
  }

  function buildMarkdown(finishedAt, runError) {
    const lines = [
      "# Demo Path Audit",
      "",
      `Started: ${startedAt}`,
      `Finished: ${finishedAt}`,
      "",
      "## Step Results",
      "",
    ];

    if (entries.length === 0) {
      lines.push("- [not-recorded] Scenario did not add audit entries.");
    }

    for (const entry of entries) {
      const notes = entry.notes ? ` - ${entry.notes}` : "";
      lines.push(`- [${entry.status}] ${entry.step}${notes}`);
      if (entry.evidence) {
        lines.push(`  Evidence: ${entry.evidence}`);
      }
    }

    if (runError) {
      lines.push("", "## Run Error", "", serializeError(runError).message);
    }

    return `${lines.join("\n")}\n`;
  }

  return {
    entries,
    pass: (stepName, details) => add("pass", stepName, details),
    partial: (stepName, details) => add("partial", stepName, details),
    fail: (stepName, details) => add("fail", stepName, details),
    skip: (stepName, details) => add("skipped", stepName, details),
    hasFailures: () => entries.some((entry) => entry.status === "fail"),
    async run(stepName, action) {
      try {
        const result = await action();
        add("pass", stepName);
        return result;
      } catch (error) {
        add("fail", stepName, error);
        throw error;
      }
    },
    write(runError) {
      if (entries.length === 0 && !runError) {
        return null;
      }

      const finishedAt = new Date().toISOString();
      const jsonPath = path.join(outputDir, `${safeName}-audit.json`);
      const markdownPath = path.join(outputDir, `${safeName}-audit.md`);
      const payload = {
        startedAt,
        finishedAt,
        entries,
        runError: serializeError(runError),
      };

      fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
      fs.writeFileSync(markdownPath, buildMarkdown(finishedAt, runError));

      return { jsonPath, markdownPath };
    },
  };
}

function loadPlaywright() {
  try {
    const resolved = require.resolve("playwright", { paths: [process.cwd()] });
    return require(resolved);
  } catch (error) {
    error.message = [
      "Could not resolve 'playwright' from the current workspace.",
      "Install it with:",
      "  npm install -D playwright",
      "  npx playwright install chromium",
      "",
      error.message,
    ].join("\n");
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function installOverlay(page) {
  await page.addInitScript(() => {
    window.__codexDemoRecorder = {
      updateStep(message) {
        const existing = document.getElementById("__codex-demo-step");
        if (existing) {
          existing.remove();
        }
        const banner = document.createElement("div");
        banner.id = "__codex-demo-step";
        banner.textContent = message;
        Object.assign(banner.style, {
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: "2147483646",
          padding: "10px 14px",
          borderRadius: "999px",
          background: "rgba(15, 23, 42, 0.9)",
          color: "#f8fafc",
          font: "600 16px/1.2 system-ui, sans-serif",
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.28)",
          pointerEvents: "none",
        });
        document.body.appendChild(banner);
      },
      highlight(box) {
        const existing = document.getElementById("__codex-demo-highlight");
        if (existing) {
          existing.remove();
        }
        const ring = document.createElement("div");
        ring.id = "__codex-demo-highlight";
        Object.assign(ring.style, {
          position: "fixed",
          left: `${box.x - 6}px`,
          top: `${box.y - 6}px`,
          width: `${box.width + 12}px`,
          height: `${box.height + 12}px`,
          borderRadius: "14px",
          border: "3px solid #f97316",
          background: "rgba(249, 115, 22, 0.12)",
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.12)",
          zIndex: "2147483647",
          pointerEvents: "none",
          transition: "opacity 150ms ease",
        });
        document.body.appendChild(ring);
      },
      clearHighlight() {
        const existing = document.getElementById("__codex-demo-highlight");
        if (existing) {
          existing.remove();
        }
      },
    };
  });
}

async function showStep(page, message) {
  console.log(`[step] ${message}`);
  await page.evaluate((value) => {
    window.__codexDemoRecorder?.updateStep(value);
  }, message);
  await sleep(500);
}

async function highlightLocator(page, locator, durationMs = 900) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    return;
  }
  await page.evaluate((payload) => {
    window.__codexDemoRecorder?.highlight(payload);
  }, box);
  await sleep(durationMs);
  await page.evaluate(() => {
    window.__codexDemoRecorder?.clearHighlight();
  });
}

function runFfmpeg(args) {
  return spawnSync("ffmpeg", args, { stdio: "inherit" });
}

function ffmpegAvailable() {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return probe.status === 0;
}

function convertToMp4(inputPath, outputPath) {
  const result = runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-an",
    "-movflags",
    "faststart",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    outputPath,
  ]);

  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with code ${result.status}`);
  }
}

async function maybeGoto(page, targetUrl) {
  if (!targetUrl) {
    return;
  }
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await sleep(1500);
}

async function loadScenario(scriptPath) {
  const resolved = resolveFromCwd(scriptPath);
  if (!fileExists(resolved)) {
    throw new Error(`Scenario script not found: ${resolved}`);
  }

  const scenario = require(resolved);
  if (typeof scenario !== "function") {
    throw new Error(`Scenario module must export a function: ${resolved}`);
  }

  return { scenario, resolved };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.outputDir) {
    throw new Error("--output-dir is required");
  }

  if (!args.name) {
    throw new Error("--name is required");
  }

  if (!args.script && !args.url) {
    throw new Error("Provide either --script or --url");
  }

  const outputDir = resolveFromCwd(args.outputDir);
  const safeName = slugify(args.name);
  const audit = createAudit(outputDir, safeName);
  ensureDir(outputDir);

  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch({
    headless: !args.headed,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  await installOverlay(page);

  let scenarioInfo = null;
  let runError = null;
  if (args.script) {
    scenarioInfo = await loadScenario(args.script);
    console.log(`Scenario: ${scenarioInfo.resolved}`);
  }

  try {
    await maybeGoto(page, args.url);

    if (scenarioInfo) {
      await scenarioInfo.scenario({
        page,
        audit,
        step: async (message) => showStep(page, message),
        highlight: async (locator, durationMs) => highlightLocator(page, locator, durationMs),
        wait: sleep,
      });
    }

    await sleep(1200);
  } catch (error) {
    runError = error;
    if (!audit.hasFailures()) {
      audit.fail("Demo run", error);
    }
    throw error;
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (!video) {
      throw new Error("Playwright did not produce a video");
    }

    const sourceVideoPath = await video.path();
    const extension = path.extname(sourceVideoPath) || ".webm";
    const finalWebmPath = path.join(outputDir, `${safeName}${extension}`);

    if (path.resolve(sourceVideoPath) !== path.resolve(finalWebmPath)) {
      fs.copyFileSync(sourceVideoPath, finalWebmPath);
    }

    console.log(`Saved video: ${finalWebmPath}`);

    if (ffmpegAvailable()) {
      const finalMp4Path = path.join(outputDir, `${safeName}.mp4`);
      convertToMp4(finalWebmPath, finalMp4Path);
      console.log(`Saved MP4: ${finalMp4Path}`);
    } else {
      console.log("ffmpeg not found; keeping WebM only.");
    }

    const auditPaths = audit.write(runError);
    if (auditPaths) {
      console.log(`Saved audit JSON: ${auditPaths.jsonPath}`);
      console.log(`Saved audit Markdown: ${auditPaths.markdownPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
