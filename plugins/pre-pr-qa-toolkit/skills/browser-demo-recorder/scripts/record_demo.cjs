#!/usr/bin/env node
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const process = require("node:process");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");

const RECORDER_VERSION = "1.1.0";
const FINDING_CATEGORIES = new Set([
  "needs-work",
  "crashed-or-broke",
  "blocker",
  "setup-noise",
]);

function parseArgs(argv) {
  const args = {
    name: "browser-demo",
    width: 1280,
    height: 720,
    headed: true,
    holdMs: 1500,
    makeMp4: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--script") args.script = next();
    else if (arg === "--url") args.url = next();
    else if (arg === "--output-dir") args.outputDir = next();
    else if (arg === "--name") args.name = next();
    else if (arg === "--width") args.width = Number(next());
    else if (arg === "--height") args.height = Number(next());
    else if (arg === "--hold-ms") args.holdMs = Number(next());
    else if (arg === "--headed") args.headed = true;
    else if (arg === "--headless") args.headed = false;
    else if (arg === "--no-mp4") args.makeMp4 = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  console.log(`
Usage:
  node record_demo.cjs --script ./output/browser-demo-recording/scenario.cjs --name app-demo --headed
  node record_demo.cjs --url http://localhost:3000 --name app-home --headless

Options:
  --script <path>      CommonJS module exporting async ({ page, step, highlight, wait, finding }) => {}
  --url <url>          Simple recording target when no script is supplied
  --output-dir <dir>   Output folder. Defaults to repo-root/output/browser-demo-recording inside a git repo, else ./demo-recording
  --name <name>        Video basename, default browser-demo
  --width <px>         Viewport/video width, default 1280
  --height <px>        Viewport/video height, default 720
  --headed             Show the browser window, default
  --headless           Run headless
  --hold-ms <ms>       Final hold before closing, default 1500
  --no-mp4             Keep only WebM
`);
}

function detectRepoRoot(cwd = process.cwd()) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;

  const repoRoot = result.stdout.trim();
  return repoRoot || null;
}

function defaultOutputDir(cwd = process.cwd()) {
  const repoRoot = detectRepoRoot(cwd);
  if (repoRoot) {
    return path.join(repoRoot, "output", "browser-demo-recording");
  }

  return path.join(cwd, "demo-recording");
}

function workspaceRequire() {
  const packageJson = path.join(process.cwd(), "package.json");
  return createRequire(
    fs.existsSync(packageJson)
      ? packageJson
      : path.join(process.cwd(), "noop.js"),
  );
}

function loadPlaywright() {
  try {
    return workspaceRequire()("playwright");
  } catch (error) {
    try {
      return require("playwright");
    } catch {
      throw new Error(
        "Cannot load Playwright. Run `npm install -D playwright` in the workspace, then retry.",
      );
    }
  }
}

async function withTimeout(label, promise, ms = 3000) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(timeout);
  }
}

async function banner(page, message) {
  await withTimeout(
    "banner",
    page.evaluate((text) => {
      let node = document.querySelector("[data-demo-recorder-banner]");
      if (!node) {
        node = document.createElement("div");
        node.setAttribute("data-demo-recorder-banner", "true");
        Object.assign(node.style, {
          position: "fixed",
          left: "24px",
          bottom: "24px",
          zIndex: "2147483647",
          maxWidth: "760px",
          padding: "13px 16px",
          borderRadius: "8px",
          background: "rgba(14, 17, 22, 0.92)",
          color: "white",
          font: "600 18px/1.35 system-ui, -apple-system, Segoe UI, sans-serif",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
          pointerEvents: "none",
        });
        document.documentElement.appendChild(node);
      }
      node.textContent = text;
    }, message),
  ).catch(() => {});
}

async function highlight(page, locator, options = {}) {
  const timeout = options.timeout ?? 5000;
  await locator.waitFor({ state: "visible", timeout }).catch(() => {});
  await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  const box = await locator.boundingBox({ timeout }).catch(() => null);
  if (!box) return;

  await withTimeout(
    "highlight",
    page.evaluate(({ x, y, width, height }) => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        left: `${x - 6}px`,
        top: `${y - 6}px`,
        width: `${width + 12}px`,
        height: `${height + 12}px`,
        zIndex: "2147483647",
        border: "4px solid #10a37f",
        borderRadius: "10px",
        boxSizing: "border-box",
        pointerEvents: "none",
        transition: "opacity 450ms ease",
      });
      document.documentElement.appendChild(ring);
      window.setTimeout(() => {
        ring.style.opacity = "0";
        window.setTimeout(() => ring.remove(), 500);
      }, 550);
    }, box),
  ).catch(() => {});

  await page.waitForTimeout(options.holdMs ?? 700);
}

function safeName(name) {
  return (
    name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "browser-demo"
  );
}

function formatElapsed(startedAtMs, nowMs = Date.now()) {
  const seconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function sanitizeText(value, maxLength = 2000) {
  return String(value ?? "")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(
      /("(?:password|client[_-]?secret|authorization|api[_-]?key|token)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(
      /((?:password|client[_-]?secret|authorization|api[_-]?key|token)\s*[=:]\s*)[^\s,;&}]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /([?&](?:access_token|token|api_key|key|signature|sig)=)[^&#\s]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, maxLength);
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return sanitizeText(value);
  }
}

function sanitizeDetails(details) {
  if (details == null) return null;
  if (details instanceof Error) return sanitizeText(details.message);
  if (typeof details === "string") return sanitizeText(details);

  try {
    return JSON.parse(
      JSON.stringify(details, (_key, value) =>
        typeof value === "string" ? sanitizeText(value) : value,
      ),
    );
  } catch {
    return sanitizeText(details);
  }
}

async function findNewestWebm(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webm"))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fsp.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs, size: stat.size };
      }),
  );
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.find((file) => file.size > 0) || files[0];
}

function convertToMp4(webmPath, mp4Path) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdio: "inherit" },
  );
  return result.status === 0 && fs.existsSync(mp4Path);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!args.script && !args.url) {
    throw new Error("Provide either --script or --url.");
  }

  const { chromium } = loadPlaywright();
  const outputDir = args.outputDir
    ? path.resolve(process.cwd(), args.outputDir)
    : defaultOutputDir(process.cwd());
  const rawDir = path.join(outputDir, "raw");
  const name = safeName(args.name);
  const finalWebm = path.join(outputDir, `${name}.webm`);
  const finalMp4 = path.join(outputDir, `${name}.mp4`);
  const metadataPath = path.join(outputDir, `${name}.json`);
  const findingsPath = path.join(outputDir, `${name}-findings.json`);
  const startedAtMs = Date.now();
  const steps = [];
  const observations = [];
  const findings = [];

  await fsp.rm(rawDir, { recursive: true, force: true }).catch(() => {});
  await fsp.mkdir(rawDir, { recursive: true });
  await fsp.rm(finalWebm, { force: true }).catch(() => {});
  await fsp.rm(finalMp4, { force: true }).catch(() => {});
  await fsp.rm(metadataPath, { force: true }).catch(() => {});
  await fsp.rm(findingsPath, { force: true }).catch(() => {});

  const browser = await chromium.launch({
    headless: !args.headed,
    args: ["--disable-search-engine-choice-screen"],
  });

  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    recordVideo: {
      dir: rawDir,
      size: { width: args.width, height: args.height },
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);

  const recordObservation = (type, details) => {
    if (observations.length >= 500) return;
    observations.push({
      at: formatElapsed(startedAtMs),
      type,
      ...sanitizeDetails(details),
    });
  };

  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    recordObservation("console", {
      level: message.type(),
      message: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    recordObservation("pageerror", {
      message: error.message,
    });
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    recordObservation("http", {
      method: response.request().method(),
      status: response.status(),
      url: sanitizeUrl(response.url()),
    });
  });

  const helpers = {
    page,
    context,
    browser,
    wait: (ms) => page.waitForTimeout(ms),
    banner: (message) => banner(page, message),
    step: async (message) => {
      const safeMessage = sanitizeText(message);
      const entry = {
        at: formatElapsed(startedAtMs),
        message: safeMessage,
      };
      steps.push(entry);
      console.log(`[demo ${entry.at}] ${safeMessage}`);
      await banner(page, safeMessage);
      await page.waitForTimeout(350);
    },
    highlight: (locator, options) => highlight(page, locator, options),
    finding: (category, message, details = null) => {
      const safeCategory = FINDING_CATEGORIES.has(category)
        ? category
        : "needs-work";
      const entry = {
        at: formatElapsed(startedAtMs),
        category: safeCategory,
        message: sanitizeText(message),
        details: sanitizeDetails(details),
      };
      findings.push(entry);
      console.log(`[finding:${entry.category} ${entry.at}] ${entry.message}`);
      return entry;
    },
  };

  let error;
  try {
    if (args.script) {
      const scriptPath = path.resolve(process.cwd(), args.script);
      const scenario = require(scriptPath);
      if (typeof scenario !== "function") {
        throw new Error(`Scenario must export a function: ${scriptPath}`);
      }
      await scenario(helpers);
    } else {
      await helpers.step(`Open ${args.url}`);
      await page.goto(args.url, { waitUntil: "domcontentloaded" });
    }
    await page.waitForTimeout(args.holdMs);
  } catch (caught) {
    error = caught;
    helpers.finding(
      "blocker",
      "Recording stopped before the requested flow completed",
      caught.message,
    );
    await banner(
      page,
      `Recording stopped: ${sanitizeText(caught.message)}`,
    ).catch(() => {});
    await page.waitForTimeout(1200).catch(() => {});
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const raw = await findNewestWebm(rawDir);
  if (!raw || !fs.existsSync(raw.fullPath)) {
    throw new Error("Playwright did not produce a video file.");
  }
  await fsp.copyFile(raw.fullPath, finalWebm);

  let finalVideo = finalWebm;
  if (args.makeMp4 && convertToMp4(finalWebm, finalMp4)) {
    finalVideo = finalMp4;
  }

  const finishedAtMs = Date.now();
  const evidence = {
    recorderVersion: RECORDER_VERSION,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    elapsed: formatElapsed(startedAtMs, finishedAtMs),
    steps,
    observations,
    findings,
  };
  await fsp.writeFile(findingsPath, `${JSON.stringify(evidence, null, 2)}\n`);

  const metadata = {
    recorderVersion: RECORDER_VERSION,
    ok: !error,
    error: error ? sanitizeText(error.message) : null,
    url: sanitizeUrl(page.url()),
    webm: finalWebm,
    mp4: fs.existsSync(finalMp4) ? finalMp4 : null,
    video: finalVideo,
    rawVideo: raw.fullPath,
    metadata: metadataPath,
    findingsFile: findingsPath,
    width: args.width,
    height: args.height,
    ...evidence,
  };
  await fsp.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));

  if (error) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(sanitizeText(error?.message || error));
  process.exitCode = 1;
});
