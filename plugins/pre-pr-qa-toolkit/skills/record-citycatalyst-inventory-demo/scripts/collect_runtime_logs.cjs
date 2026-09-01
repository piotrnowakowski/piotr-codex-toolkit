#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ERROR_PATTERN =
  /\b(error|fatal|panic|exception|traceback|unhandled|uncaught|critical|failed|failure)\b|\bHTTP\s*5\d{2}\b|"status"\s*:\s*5\d{2}\b|(?:^|\s)5\d{2}(?:\s|$)|\bERR_[A-Z0-9_]+\b/i;

function parseArgs(argv) {
  const args = {
    ccLogs: [],
    caLogs: [],
    ccUnavailableReason: "",
    caUnavailableReason: "",
    since: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`Missing value for ${token}`);
      return value;
    };
    if (token === "--run-dir") args.runDir = next();
    else if (token === "--cc-log") args.ccLogs.push(next());
    else if (token === "--ca-log") args.caLogs.push(next());
    else if (token === "--cc-unavailable-reason") {
      args.ccUnavailableReason = next();
    } else if (token === "--ca-unavailable-reason") {
      args.caUnavailableReason = next();
    } else if (token === "--since") args.since = next();
    else if (token === "--help" || token === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function usage() {
  process.stdout.write(`Usage:
  node collect_runtime_logs.cjs --run-dir <dir> [--cc-log <path>] [--ca-log <path>]

Options:
  --cc-log <path>                 Repeatable CityCatalyst log source
  --ca-log <path>                 Repeatable Climate Advisor log source
  --cc-unavailable-reason <text>  Why no CC log source was available
  --ca-unavailable-reason <text>  Why no CA log source was available
  --since <ISO timestamp>         Start of the recording window
`);
}

function redactText(value) {
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
    .replace(
      /((?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^:\s/@]+:)[^@\s/]+@/gi,
      "$1[REDACTED]@",
    );
}

function extractTimestamp(line) {
  const match = String(line).match(
    /\b\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?\b|\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
  );
  return match?.[0] || null;
}

function extractErrors(text) {
  const lines = text ? text.split(/\r?\n/) : [];
  const errors = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!ERROR_PATTERN.test(line)) continue;
    const contextStart = Math.max(0, index - 2);
    const contextEnd = Math.min(lines.length, index + 7);
    errors.push({
      occurrence: errors.length + 1,
      lineNumber: index + 1,
      timestamp: extractTimestamp(line),
      message: line.trim(),
      context: lines.slice(contextStart, contextEnd).join("\n").trim(),
    });
  }
  return { lineCount: lines.length, errors };
}

function readAvailableSources(paths) {
  const sources = [];
  const failures = [];
  const chunks = [];

  for (const inputPath of paths) {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      failures.push({ path: resolved, reason: "not-found" });
      continue;
    }
    try {
      const content = fs.readFileSync(resolved, "utf8");
      sources.push({
        path: resolved,
        bytes: Buffer.byteLength(content),
      });
      chunks.push(`===== SOURCE: ${resolved} =====\n${content}`);
    } catch (error) {
      failures.push({ path: resolved, reason: error.message });
    }
  }

  return { sources, failures, text: chunks.join("\n\n") };
}

function collectService({ key, label, paths, unavailableReason, runDir }) {
  const available = readAvailableSources(paths);
  if (available.sources.length === 0) {
    return {
      key,
      label,
      status: "unavailable",
      unavailableReason:
        unavailableReason ||
        (available.failures.length > 0
          ? "Configured log sources could not be read."
          : "No log source was available."),
      sources: [],
      sourceFailures: available.failures,
      sanitizedLogPath: null,
      lineCount: 0,
      errorCount: null,
      errors: [],
    };
  }

  const sanitized = redactText(available.text);
  const sanitizedLogPath = path.join(runDir, `${key}-runtime.log`);
  fs.writeFileSync(sanitizedLogPath, sanitized);
  const extracted = extractErrors(sanitized);
  return {
    key,
    label,
    status: "captured",
    unavailableReason: null,
    sources: available.sources,
    sourceFailures: available.failures,
    sanitizedLogPath,
    lineCount: extracted.lineCount,
    errorCount: extracted.errors.length,
    errors: extracted.errors,
  };
}

function safeMarkdown(value) {
  return String(value ?? "").replace(/\x60\x60\x60/g, "` ` `");
}

function serviceMarkdown(service) {
  const lines = [`## ${service.label}`, ""];
  if (service.status !== "captured") {
    lines.push(
      "- **Log coverage:** Unavailable",
      `- **Reason:** ${service.unavailableReason}`,
      "- **Interpretation:** Do not treat unavailable logs as zero errors.",
    );
    if (service.sourceFailures.length > 0) {
      lines.push("- **Unreadable sources:**");
      for (const failure of service.sourceFailures) {
        lines.push(`  - ${failure.path}: ${failure.reason}`);
      }
    }
    return lines.join("\n");
  }

  lines.push(
    "- **Log coverage:** Captured",
    `- **Sanitized log:** ${service.sanitizedLogPath}`,
    `- **Source files:** ${service.sources.length}`,
    `- **Captured lines:** ${service.lineCount}`,
    `- **Error occurrences:** ${service.errorCount}`,
  );
  if (service.errorCount === 0) {
    lines.push(
      "",
      "No error-pattern lines were observed in the captured log window.",
    );
    return lines.join("\n");
  }

  for (const error of service.errors) {
    lines.push(
      "",
      `### ${service.key.toUpperCase()}-${String(error.occurrence).padStart(3, "0")}`,
      "",
      `- **Line:** ${error.lineNumber}`,
      `- **Timestamp:** ${error.timestamp || "Not present in the log line"}`,
      `- **Message:** ${safeMarkdown(error.message)}`,
      "- **Context:**",
      "",
      "```text",
      safeMarkdown(error.context),
      "```",
    );
  }
  return lines.join("\n");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function collectRuntimeLogs(options) {
  const runDir = path.resolve(options.runDir);
  fs.mkdirSync(runDir, { recursive: true });
  const cc = collectService({
    key: "cc",
    label: "CityCatalyst application logs",
    paths: options.ccLogs || [],
    unavailableReason: options.ccUnavailableReason,
    runDir,
  });
  const ca = collectService({
    key: "ca",
    label: "Climate Advisor logs",
    paths: options.caLogs || [],
    unavailableReason: options.caUnavailableReason,
    runDir,
  });
  const result = {
    kind: "citycatalyst-inventory-demo-runtime-errors",
    collectedAt: new Date().toISOString(),
    captureWindowStartedAt: options.since || null,
    services: { cc, ca },
    totalCapturedErrorOccurrences: (cc.errorCount || 0) + (ca.errorCount || 0),
  };
  const jsonPath = path.join(runDir, "runtime-errors.json");
  const markdownPath = path.join(runDir, "runtime-errors.md");
  result.jsonPath = jsonPath;
  result.markdownPath = markdownPath;
  writeJson(jsonPath, result);
  fs.writeFileSync(
    markdownPath,
    [
      "# CityCatalyst demo runtime errors",
      "",
      `Collected: ${result.collectedAt}`,
      `Capture window started: ${result.captureWindowStartedAt || "Unknown"}`,
      "",
      serviceMarkdown(cc),
      "",
      serviceMarkdown(ca),
      "",
    ].join("\n"),
  );
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.runDir) throw new Error("--run-dir is required");
  const result = collectRuntimeLogs(args);
  process.stdout.write(
    `${JSON.stringify({
      status: "collected",
      jsonPath: result.jsonPath,
      markdownPath: result.markdownPath,
      cc: {
        status: result.services.cc.status,
        errorCount: result.services.cc.errorCount,
      },
      ca: {
        status: result.services.ca.status,
        errorCount: result.services.ca.errorCount,
      },
    })}\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message || String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  collectRuntimeLogs,
  extractErrors,
  redactText,
};
