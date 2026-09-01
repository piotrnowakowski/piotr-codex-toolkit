const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateCsv, writeJson } = require("./citycatalyst_ui.cjs");

const runDir = path.resolve(
  process.env.RUN_DIR || process.argv[2] || process.cwd(),
);
const takeName = process.env.TAKE_NAME || process.argv[3] || "";

function findFirst(names) {
  return (
    names.map((name) => path.join(runDir, name)).find(fs.existsSync) || null
  );
}

function mediaEvidence(mediaPath) {
  if (!mediaPath) return { exists: false, path: null };
  const evidence = {
    exists: true,
    path: mediaPath,
    bytes: fs.statSync(mediaPath).size,
    durationSeconds: null,
    ffprobeAvailable: false,
    ffprobeSucceeded: false,
  };
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      mediaPath,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (!probe.error) {
    evidence.ffprobeAvailable = true;
    evidence.ffprobeSucceeded = probe.status === 0;
    const durationText = String(probe.stdout).trim();
    const duration = Number(durationText);
    if (probe.status === 0 && durationText && Number.isFinite(duration)) {
      evidence.durationSeconds = duration;
    }
  }
  return evidence;
}

function readJson(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { parseError: error.message };
  }
}

function main() {
  const names = takeName ? [`${takeName}.mp4`, `${takeName}.webm`] : [];
  const mediaPath =
    findFirst(names) ||
    fs
      .readdirSync(runDir)
      .filter((name) => /\.(mp4|webm)$/i.test(name))
      .sort()
      .reverse()
      .map((name) => path.join(runDir, name))[0] ||
    null;
  const metadataPath =
    findFirst(
      takeName ? [`${takeName}.json`, `${takeName}-metadata.json`] : [],
    ) ||
    fs
      .readdirSync(runDir)
      .filter((name) => name.endsWith(".json") && /metadata|record/i.test(name))
      .map((name) => path.join(runDir, name))[0] ||
    null;
  const flowReportPath = findFirst(["flow-report.json"]);
  const runtimeErrorsPath = findFirst(["runtime-errors.json"]);
  const csvPath =
    fs
      .readdirSync(runDir)
      .filter((name) => name.toLowerCase().endsWith(".csv"))
      .map((name) => path.join(runDir, name))[0] || null;
  const media = mediaEvidence(mediaPath);
  const csv = csvPath
    ? { path: csvPath, ...validateCsv(csvPath) }
    : { path: null, exists: false, valid: false };
  const flowReport = readJson(flowReportPath);
  const runtimeErrors = readJson(runtimeErrorsPath);
  const recorderMetadata = readJson(metadataPath);
  const verification = {
    kind: "citycatalyst-inventory-demo-verification",
    runDir,
    takeName,
    verifiedAt: new Date().toISOString(),
    media,
    csv,
    flowReportPath,
    runtimeErrorsPath,
    metadataPath,
    recorderOk:
      recorderMetadata && typeof recorderMetadata.ok === "boolean"
        ? recorderMetadata.ok
        : null,
    scenarioOutcome: flowReport?.outcome || null,
    summary: flowReport?.summary || null,
    runtimeLogs: runtimeErrors
      ? {
          totalCapturedErrorOccurrences:
            runtimeErrors.totalCapturedErrorOccurrences ?? null,
          cc: {
            status: runtimeErrors.services?.cc?.status || null,
            errorCount: runtimeErrors.services?.cc?.errorCount ?? null,
            sanitizedLogPath:
              runtimeErrors.services?.cc?.sanitizedLogPath || null,
          },
          ca: {
            status: runtimeErrors.services?.ca?.status || null,
            errorCount: runtimeErrors.services?.ca?.errorCount ?? null,
            sanitizedLogPath:
              runtimeErrors.services?.ca?.sanitizedLogPath || null,
          },
        }
      : null,
  };
  verification.csvRequired = flowReport?.steps?.csv?.status !== "skipped";
  const mediaValid =
    media.exists &&
    media.bytes > 0 &&
    (!media.ffprobeAvailable ||
      (media.ffprobeSucceeded && media.durationSeconds > 0));
  const runtimeLogsValid =
    runtimeErrors &&
    !runtimeErrors.parseError &&
    runtimeErrors.services?.cc &&
    runtimeErrors.services?.ca;
  verification.status = !mediaValid
    ? "artifact-incomplete"
    : !runtimeLogsValid
      ? "runtime-log-incomplete"
      : verification.recorderOk !== true
        ? "recorder-failed"
        : verification.scenarioOutcome !== "passed"
          ? "scenario-failed"
          : verification.csvRequired && !csv.valid
            ? "csv-failed"
            : "passed";
  writeJson(path.join(runDir, "verification.json"), verification);
  process.stdout.write(`${JSON.stringify(verification)}\n`);
  if (verification.status !== "passed") process.exitCode = 2;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exitCode = 1;
}
