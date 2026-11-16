---
name: browser-demo-recorder
description: Record verified browser demos, product walkthroughs, and bug reproductions with Playwright, including timecoded evidence and a structured outcome report. Use when the user explicitly asks for a browser video, recorded walkthrough, or browser-flow demonstration. Do not trigger solely for code review, security review, or a general UX audit without a requested recording.
metadata:
  version: "1.2.0"
---

# Browser Demo Recorder

Record a truthful, reproducible browser walkthrough and return both the verified video and an evidence-based report.

Use Playwright video recording instead of OS-level capture unless the requested flow includes desktop UI outside the browser.

## Recording boundaries

- Exercise the real application stack, including the real backend, authentication, data, LLM calls, and tool calls when they are part of the flow.
- Do not mock routes, responses, datasets, authentication, LLM outputs, tool events, or committed results unless the user explicitly requests a mock or prototype recording.
- If the real stack is unavailable, record or report the blocker instead of presenting simulated behavior as working.
- Do not expose credentials, tokens, private messages, personal data, or unrelated workspace content.
- Authorization to record a flow permits ordinary browser interaction and clearly disposable local test data. It does not authorize production writes, destructive cleanup, external messages, or stopping shared services.
- Stop only services or processes started for the recording.

## Core workflow

1. Infer the target URL, persona, account, and user flow from the request and workspace. Ask only when a missing choice would materially change the result.
2. For a local app, reuse an existing healthy server when possible. Start any new server as a background process and record its process identity.
3. Verify the target URL before recording with the recorder's `--wait-for <url>`. Do not write `sleep`, `Start-Sleep`, or `until`/`while` polling loops.
4. Inside a Git repository, use the ignored repo-root directory `output/browser-demo-recording/` for scenarios, raw video, final video, preview frames, findings, metadata, and reports.
5. Create a deterministic CommonJS scenario when interaction is required. Write it with the file-write tool and fix it with the file-edit tool, not with shell string replacement.
6. Run `scripts/record_demo.cjs` from this skill. Never write a separate Playwright recorder. If `--output-dir` is omitted, the recorder defaults to `output/browser-demo-recording/` at the Git root.
7. Preserve partial video and evidence if the flow stops early.
8. Verify the recorder metadata, nonzero video duration and size, and at least one representative frame.
9. Write the report using [references/report-template.md](references/report-template.md), embed the video, and link the saved report.

Treat the recorder's structured `ok`, `error`, artifact paths, steps, observations, and findings as the primary execution evidence.

## Recorder commands

`<skill-dir>` is the directory containing this SKILL.md.

Interactive scenario:

```bash
repo_root=$(git rev-parse --show-toplevel)
record_dir="$repo_root/output/browser-demo-recording"
recorder="<skill-dir>/scripts/record_demo.cjs"

node "$recorder" \
  --wait-for http://localhost:3000/ \
  --script "$record_dir/scenario.cjs" \
  --output-dir "$record_dir" \
  --name app-demo \
  --headed
```

The recorder prints the metadata JSON on stdout. Read it from there instead of opening the files with a shell.

Run the recorder in the background when the take can last over a minute (LLM calls, uploads, long flows), then wait for that background task. A foreground command is stopped at 10 minutes and its output is lost.

Simple page:

```bash
node "$recorder" \
  --url http://localhost:3000 \
  --output-dir "$record_dir" \
  --name app-home \
  --headed
```

Headed mode works on Windows, macOS, Wayland (Omarchy/Hyprland) and X11; on Linux the recorder passes `--ozone-platform-hint=auto`. Without a display (SSH, CI) use headless mode.

## Scenario contract

Create `output/browser-demo-recording/scenario.cjs` exporting one asynchronous function:

```js
module.exports = async ({ page, context, step, highlight, wait, finding }) => {
  await step("Open the dashboard");
  await page.goto("http://localhost:3000/dashboard", {
    waitUntil: "domcontentloaded",
  });
  await wait(1000);

  const filter = page.getByRole("button", { name: /filters/i });
  await highlight(filter);
  await step("Open filters");
  await filter.click();
  await wait(800);

  const search = page.getByRole("textbox", { name: /search/i });
  await highlight(search);
  await search.fill("Krakow");
  await wait(1200);

  const emptyState = page.getByText(/no results/i);
  if (await emptyState.isVisible().catch(() => false)) {
    finding(
      "needs-work",
      "Search returned an unexpected empty state",
      "Visible after searching for Krakow.",
    );
  }
};
```

Use `finding(category, message, details)` for meaningful observations:

- `needs-work`: user-visible friction, incorrect state, confusing behavior, degraded output, or a reliability concern;
- `crashed-or-broke`: crashes, uncaught exceptions, or failed requests that break the flow;
- `blocker`: permissions, CAPTCHA, unavailable services, missing data, or setup problems that prevent coverage;
- `setup-noise`: expected environment behavior that should not be reported as a product defect.

The recorder assigns the elapsed `MM:SS` timestamp.

## Scenario quality

- Prefer role, label, text, and test-ID locators.
- Prefer stable `data-*` hooks over brittle text guesses for flaky controls.
- Wait for state with locators (`locator.waitFor()`, `page.waitForURL()`, `page.waitForResponse()`), not fixed delays. Use `wait(ms)` only to pace the video for the viewer after navigation, animation, typing, and route transitions.
- Highlight important controls before interacting with them.
- Keep ordinary demonstrations short, usually 15–60 seconds.
- Use production-like inputs without exposing sensitive data.
- Never add a fallback that converts a failed product step into apparent success.
- Do not splice separate failed takes together to imply one successful flow.
- Preserve exact prompts and summarize visible results for chat, search, or AI-assisted flows.

## Evidence capture

The recorder captures:

- scenario steps with elapsed timestamps;
- browser console errors and warnings;
- uncaught page exceptions;
- failed application or API responses with query strings removed;
- scenario-authored findings;
- the terminal URL and artifact paths.

Do not treat every technical event as a defect. Separate expected setup noise, cancelled navigation requests, unauthenticated calls before login, compile delays, and harmless polling from user-visible failures.

Do not infer a root cause from a console or network event alone. Label likely causes as hypotheses.

## Failure and retry handling

If the scenario stops early:

- preserve and verify the partial video;
- record the first blocking step and available evidence;
- keep successfully completed earlier steps in the report;
- do not describe the recording as completed successfully.

If metadata reports `ok: false`, either fix an identified recorder, environment, or locator problem and rerun, or return the verified partial artifact and explain the blocker.

Rerun only when a specific non-product cause was identified and corrected. Do not rerun merely to hide a reproducible product failure.

## Report depth

Every recording requires a saved Markdown report and a concise chat summary.

- Use the **standard report** for a straightforward walkthrough or demonstration.
- Use the **detailed audit report** when the user asks to test, explore, reproduce a bug, identify problems, assess readiness, or provide PR evidence.

Before reporting, read [references/report-template.md](references/report-template.md). Follow its outcome definitions, journey structure, finding format, evidence rules, and merge-verdict limits.

At minimum, every report must state:

- the recorded scope and outcome;
- environment and starting state;
- completed and incomplete journey steps;
- what worked;
- what needs work, with timecodes;
- what crashed or broke;
- struggles, blockers, and setup limitations;
- prompts and observed results when applicable;
- artifact verification and paths;
- what was not tested;
- a merge verdict only when PR readiness was part of the request.

## Dependencies

The recorder resolves Playwright in this order: the workspace where it runs, `PLAYWRIGHT_MODULE` (path to a `playwright` module directory), then a shared cached tools directory `${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/playwright`. If none exists, install once into the shared cache instead of the product repository:

```bash
tools="${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/playwright"
# Skip the bundled browser download when a system Chromium exists.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix "$tools" playwright
# Only without a system Chromium:
# npx --prefix "$tools" playwright install chromium
```

The recorder launches a system Chromium when available: `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then `CHROME_PATH`, then `/usr/bin/chromium` (Omarchy/Arch), `/usr/bin/chromium-browser` (Fedora), `/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`; otherwise Playwright's bundled browser.

Do not modify repository dependencies automatically when an existing Playwright installation or the shared tools directory can be used.

Missing system packages:

- Omarchy/Arch: `sudo pacman -S --needed ffmpeg chromium nodejs npm` (Node via `mise use -g node@lts` is the Omarchy default).
- Fedora: `sudo dnf install chromium nodejs`, and FFmpeg from RPM Fusion with `sudo dnf swap ffmpeg-free ffmpeg --allowerasing` (`ffmpeg-free` lacks libx264).

Use FFmpeg when available to produce MP4 (`libx264 -preset veryfast -crf 20`; override the preset with `FFMPEG_X264_PRESET`). If FFmpeg is unavailable or conversion fails, verify and return the WebM.

## Public websites

Automated browsers may encounter CAPTCHA, Cloudflare, Google verification, or other anti-automation controls. Do not bypass or solve verification challenges.

When blocked, preserve the blocker when useful, verify the intended destination through an appropriate public source, continue directly to a verified URL only when that still satisfies the requested demo, and state the limitation.

Use headed mode by default for public websites. Use headless mode for local or CI-style recordings when it behaves reliably.

## Verification

Check duration and size:

```bash
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 output/browser-demo-recording/app-demo.mp4
```

Extract and inspect a representative frame:

```bash
ffmpeg -v error -y -ss 00:00:05 -i output/browser-demo-recording/app-demo.mp4 -frames:v 1 -update 1 output/browser-demo-recording/preview.png
```

Confirm:

- the video exists and has nonzero duration and size;
- the frame shows the intended application and state;
- metadata corresponds to the final video;
- reported issues and blockers have usable timecodes;
- sensitive data is not visible;
- the Markdown report is saved beside the artifacts.

## Delivery

Embed the verified video using an absolute path:

```markdown
![Browser demo](/absolute/path/to/output/browser-demo-recording/app-demo.mp4)
```

Also provide direct paths to the video and saved report. If the renderer cannot display a path containing spaces, copy only the verified final video to a no-space export directory and embed that copy.

## Cleanup

Remove only failed temporary takes and disposable artifacts created by this recording after the final video has been verified.

Preserve the final video, scenario, metadata, findings, report, preview frame, and requested evidence. Stop only processes started for the recording, and preserve pre-existing services, user data, databases, and unrelated working-tree changes.
