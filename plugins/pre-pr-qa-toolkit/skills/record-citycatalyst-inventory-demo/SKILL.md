---
name: record-citycatalyst-inventory-demo
description: "Test and record the CityCatalyst live-demo path with a reusable Playwright package: create an audience-selected city and profile-ranked GPC Basic/AR6 inventory, add third-party and manual data, test Clima and results, capture every available CityCatalyst and Climate Advisor runtime error, and produce a verified video and audit. Use for CityCatalyst demos, rehearsal recordings, Krakow inventory demos, and end-to-end demo-path checks."
metadata:
  version: "1.2.0"
---

# Record CityCatalyst Inventory Demo

## Get the city, then run

Ask the audience which city to use when the user has not already named one. Preserve the exact spelling and ask for the country when the name is ambiguous. Do not silently substitute another city.

`<skill-dir>` is the directory containing this `SKILL.md`. The launcher also needs the sibling `browser-demo-recorder` skill at `<skill-dir>/../browser-demo-recorder`.

For Krakow:

```bash
<skill-dir>/scripts/run_demo.sh \
  --repo-root ~/code/CityCatalyst \
  --city-name "Krakow" \
  --country-name "Poland"
```

The launcher creates a unique directory under:

`<repo>/output/browser-demo-recording/runs/<city>-inventory-demo-<timestamp>/`

It owns the scenario and never reads an old scenario from repository output.

## Record this exact path

1. Create the audience-selected city.
   - Give the search control time to load.
   - Select the exact city spelling and country shown in the result.
   - Confirm the selected city before continuing.
2. Create an inventory.
   - Choose the first unused year in the profile's ranked `inventoryYears` unless a year was requested.
   - For Krakow, prefer 2023, then 2024 and 2025, before the existing 2017-2022 window. These are UI-valid catalogue candidates, not a guarantee that the live third-party API will return data.
   - If every ranked year is occupied, identify at most one inventory whose ID, city, and year match a prior run's `flow-report.json`, then write `cleanup-proposal.json`.
   - Never delete from the proposal automatically. Stop and request explicit approval for that run. Only `--allow-verified-demo-cleanup`, supplied after reviewing the proposal, authorizes the one authenticated DELETE call.
   - If ownership cannot be proven or approval is absent, stop. Never delete an unproven or unapproved inventory merely to make the demo pass.
   - Select `GPC Basic`.
   - Select `AR6`.
3. Add available third-party data and preserve the visible result.
   - Require the visible selection to trigger a successful `connect-all` response with no reported source errors.
   - Do not label the step passed from the selected radio control or redirect alone.
4. Add one manual-data record through the visible form and require a successful submission response.
5. Open Clima and ask exactly:

   `What is the difference between GPC and GPC+? Explain it to me in easy language.`

   Wait up to 60 seconds for the complete visible answer.

6. Open reported results and confirm that the results surface renders.

That is the default recorded demo. CSV is not part of the default path. Add `--include-csv` only when the user also asks to test export.

## Reuse the current setup

- Use the selected checkout's `app/.env`, account, running services, and configured database.
- Inspect and report the non-secret database identity and container name.
- A database or container name containing `codex`, `demo`, `temp`, or `test` is diagnostic information, not a blocker.
- Stop only when the database is unreachable or an explicitly supplied expected identity/container does not match.
- Never create, replace, reset, truncate, migrate, seed, or delete a database.
- Do not bulk-delete inventories. The only cleanup that can be proposed is one profile-opted-in, demo-owned inventory after every ranked year is occupied. It still requires explicit run authorization and must use the authenticated application endpoint, not SQL.
- Prefer existing `DEMO_EMAIL` and `DEMO_PASSWORD`; otherwise load the configured default admin credentials without printing them.
- Start the selected checkout once with `next dev --webpack` when the app is down, in its own process group (`setsid`). Stop only that process group, including on failure or Ctrl-C.

## Linux toolchain (Omarchy and Fedora)

- Required: `bash`, `node`, `curl`, `setsid` and `timeout` (util-linux and coreutils, present on both). Optional: `ffprobe`, `docker` or `podman` (Fedora defaults to Podman; the first one found is used for container discovery and CA logs).
- Omarchy: `sudo pacman -S --needed ffmpeg chromium nodejs npm` (or `mise use -g node@lts`). Fedora: `sudo dnf install chromium nodejs` plus RPM Fusion FFmpeg via `sudo dnf swap ffmpeg-free ffmpeg --allowerasing`.
- Browser: a system Chromium is used when present (`PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `CHROME_PATH`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`), so no Playwright browser download is needed. Otherwise Playwright's bundled Chromium is used.
- Playwright: resolved from the checkout's `app/`, then `PLAYWRIGHT_MODULE`, then the shared cache `${XDG_CACHE_HOME:-~/.cache}/agent-tools/playwright`. When none resolves, install once without touching product dependencies: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix ~/.cache/agent-tools/playwright playwright`.
- Headless needs no display; headed recording works on Wayland (Hyprland) and X11, and the recorder falls back to headless when no display is available.

## Preflight without obstructing the demo

Before recording, the launcher validates the package, resolves Playwright, signs in headlessly, and opens onboarding. It also warms the four POST-only chat route bundles with GET requests that must return HTTP 405. This compiles the thread, user-token, message, and thread-export routes without creating a thread, issuing a token, sending a message, exporting a thread, or otherwise mutating application data. Authentication, browser launch, onboarding, and route-bundle warming are blocking checks.

When an existing inventory is available, also warm the dashboard, Clima, results, and download modal. Treat failures on those optional warm-up surfaces as warnings and continue to the recorded demo—the recording is itself the end-to-end test.

Preflight is read-only and writes `preflight.json`.

## Reusable inputs

- `--city-name` and `--country-name`: audience selection.
- `--inventory-year`: exact unused year from the profile's ranked `inventoryYears`. An occupied explicitly requested year fails instead of being deleted.
- `--city-population`, `--region-population`, and `--country-population`: fallbacks only when the city result does not populate required values.
- `--profile-path`: reusable manual-entry defaults and year coverage.
- `--environment-file`: established app environment.
- `--setup-script`: optional user-owned, idempotent hook (template: `scripts/optional_setup.example.sh`).
- `--headless`: record without showing the browser.
- `--include-csv`: add the optional CSV check after results.
- `--allow-verified-demo-cleanup`: after reviewing `cleanup-proposal.json`, authorize deletion of exactly that one artifact-proven demo-owned inventory. Omit by default.
- `--cc-log-path <path>`: repeatable log path for a reused CityCatalyst process (env fallback `CITYCATALYST_CC_LOG_PATH`, `:`-separated).
- `--ca-log-path <path>`: repeatable log path for a non-container Climate Advisor process (env fallback `CITYCATALYST_CA_LOG_PATH`).
- `--ca-container <name>`: select the exact Climate Advisor container when automatic Docker/Podman discovery is ambiguous.
- `--validate-only` or `--probe-only`: stop after read-only preflight.
- `--continue-on-probe-failure`: record even when the blocking preflight failed.
- `--package-only`: test the bundled package without using the live app.
- `--do-not-start-app`: fail when the app is down.
- `--keep-app-running`: retain an app process started by the launcher.
- `--expected-database-identity` or `--expected-database-container`: optional strict assertions, never required merely because of a container's name.

## Bundled package

- `assets/profiles/krakow.json`: Krakow defaults and the exact Clima question
- `scripts/inventory_scenario.cjs`: recorded demo path
- `scripts/citycatalyst_ui.cjs`: authentication and reusable UI helpers
- `scripts/probe_surfaces.cjs`: read-only warm-up
- `scripts/verify_artifacts.cjs`: video/report verifier
- `scripts/collect_runtime_logs.cjs`: sanitize available CC/CA logs and index every observed error occurrence
- `scripts/self_test.cjs`: offline package tests
- `scripts/inspect_current_setup.sh`: read-only environment inspection (database, app health and container probes run in parallel)
- `scripts/run_demo.sh`: one-command orchestration
- `scripts/optional_setup.example.sh`: template for a user-owned setup hook

## Recording rules

- Use visible UI actions for city creation, inventory creation, data entry, Clima, and results.
- Read-only API inspection may choose an unused year or diagnose a failure.
- When all ranked years are occupied, write the exact candidate and proof to `cleanup-proposal.json`. Call the authenticated DELETE API only when `--allow-verified-demo-cleanup` was explicitly supplied for that reviewed proposal.
- Set control waits to 15 seconds, navigation waits to 45 seconds, and Clima/third-party waits to 60 seconds.
- Measure the Clima limit from the visible Send action. Require a complete visible answer, an enabled input, and the restored Send button within 60 seconds; first-token or HTTP-200 evidence alone is not a pass.
- Capture the browser-visible thread, message, and thread-export request timing plus Clima trigger/input state on every Clima outcome.
- Checkpoint `flow-report.json` and `checkpoints.json` after every material step.
- Continue to independent later steps after a product failure.
- Make one recorded attempt. Rerun once only for a confirmed and fixed recorder/locator defect.
- Never mock success, mutate state outside the UI, disconnect third-party data to force manual input, or splice partial takes to imply a pass.

## Runtime log evidence

Capture the complete error evidence available during the recording window from both services:

- **CityCatalyst (CC):**
  - when the launcher starts Next.js, capture its stdout and stderr automatically;
  - when an existing CC process is reused, read every supplied `--cc-log-path`;
  - when no readable source is available, record CC log coverage as `unavailable` and explain why.
- **Climate Advisor (CA):**
  - read every supplied `--ca-log-path`;
  - otherwise capture `docker logs --since <recording-start>` (or `podman logs`) from the selected or uniquely discovered CA container;
  - if neither Docker nor Podman is available, no container matches, or several containers match without `--ca-container`, record CA log coverage as `unavailable` and explain why.

The collector must:

- redact bearer tokens, passwords, API keys, authorization values, client secrets, token-like query parameters, and database passwords before persisting evidence;
- save the full sanitized captured logs as `cc-runtime.log` and `ca-runtime.log`;
- preserve every matching error occurrence with its source line, timestamp when present, and surrounding context;
- write the machine-readable index to `runtime-errors.json`;
- write the human-readable complete error listing to `runtime-errors.md`;
- distinguish `captured with zero observed errors` from `logs unavailable`;
- never claim that a service had no errors when its logs were unavailable.

## Clima reliability rule

Click `[data-ai-button]` once. Wait for either the visible disclaimer or a visible `Ask assistant` textarea. Accept the disclaimer once when necessary. If the trigger remains explicitly closed after five seconds, focus it and press Enter as normal keyboard recovery. Do not count a hidden mounted textarea as an open chat, and do not double-click the controlled popover trigger.

On failure, preserve trigger visibility, `aria-expanded`, `data-state`, and visible-input evidence in the report.

## Optional CSV rule

With `--include-csv`, recognize:

`/api/v1/inventory/<inventoryId>/download?format=csv&lng=<language>`

Race the native browser download against the authenticated response. Require a nonempty file with a header and at least one data row. CSV failure must not rewrite the outcome of the six-step core demo; report it separately.

## Verify and report

Require a nonempty MP4 or WebM, recorder metadata, `runtime-errors.json`, and explicit CC/CA log-coverage statuses. Use `ffprobe` when installed. A core pass requires recorder `ok: true` and `flow-report.json` outcome `passed`; CSV is required only with `--include-csv`. Unavailable logs are a declared coverage limitation, not proof of zero errors.

Return two explicit sections named `What worked` and `What did not work`. Never use `partial` as the only result label. A missing, failed, or unverified required core step belongs in `What did not work`.

The launcher and `flow-report.json` expose the same split as `worked` and `didNotWork`. Return:

- exact city and selected year;
- whether cleanup was unnecessary, performed for one proven demo-owned inventory, or safely refused;
- GPC Basic and AR6 confirmation;
- third-party and manual-data outcomes;
- exact Clima question plus observed answer/failure;
- results outcome;
- CC log coverage, sanitized CC log path when captured, and every CC error occurrence;
- CA log coverage, sanitized CA log path when captured, and every CA error occurrence;
- total captured runtime-error count;
- absolute video, metadata, preflight, flow-report, checkpoints, verification, `runtime-errors.json`, and `runtime-errors.md` paths;
- specific user-visible successes under `What worked`;
- specific failures or required steps not reached under `What did not work`.

Before writing the final audit, read [references/report-template.md](references/report-template.md). Do not omit repeated runtime errors; list every occurrence or group byte-identical repeats with an exact count and first/last timestamp while retaining the full occurrence list in `runtime-errors.md`.

Embed the verified video with an absolute path:

```markdown
![CityCatalyst inventory demo](/absolute/path/city-inventory-demo.mp4)
```
