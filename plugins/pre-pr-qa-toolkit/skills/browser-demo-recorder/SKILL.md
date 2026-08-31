---
name: browser-demo-recorder
description: Record browser demos, product walkthroughs, bug reproductions, app-flow videos, and concise exploration reports with Playwright. Use when the user asks to record, capture, show, produce a video, explore a browser flow, identify what works or breaks, or create a browser walkthrough of a local app, web app, website, OpenAI or Codex demo, Playwright flow, UI test flow, or clickable browser walkthrough.
---

# Browser Demo Recorder

Use Playwright video recording instead of OS-level screen capture unless the user specifically needs desktop UI outside the browser.

## Core Workflow

1. Clarify the target flow only if it is not inferable. Otherwise choose a short practical flow and proceed.
2. If the target is a local app, start or reuse the dev server and verify the URL before recording.
3. Create a scenario module in the workspace, usually under `demo-recording/scenario.cjs`.
4. Run `scripts/record_demo.cjs` from this skill with the scenario, output directory, and video name.
5. Convert to MP4 when possible, inspect a frame, and attach the MP4 in the final response with an absolute Markdown media path.
6. Include a short exploration report in the final response: what worked, what needs work, what crashed or broke, and what was difficult to exercise. Put an approximate `MM:SS` video timecode on every issue, crash, and blocker.

Example command:

```powershell
$recorderScript = Join-Path "<installed browser-demo-recorder skill directory>" "scripts\record_demo.cjs"
node $recorderScript `
  --script .\demo-recording\scenario.cjs `
  --output-dir .\demo-recording `
  --name app-demo `
  --headed
```

For a simple static page, no scenario is needed:

```powershell
$recorderScript = Join-Path "<installed browser-demo-recorder skill directory>" "scripts\record_demo.cjs"
node $recorderScript `
  --url http://localhost:3000 `
  --output-dir .\demo-recording `
  --name app-home `
  --headed
```

## Scenario Template

Create a CommonJS scenario module that exports an async function:

```js
module.exports = async ({ page, step, highlight, wait }) => {
  await step("Open the dashboard");
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
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
};
```

Keep scenarios deterministic:

- Prefer role, label, text, and test-id locators.
- Insert short waits after navigation, animation, typing, and route transitions.
- Highlight important controls before clicking so the video is readable.
- Keep demos short, usually 15-60 seconds.
- Do not put credentials, tokens, or private data into the video.
- For exploratory or QA-style recordings, capture evidence while recording:
  - `page.on("console")` for errors and warnings.
  - `page.on("pageerror")` for uncaught client exceptions.
  - `page.on("response")` for failed app/API requests.
  - Notes about visible broken UI states, confusing steps, validation behavior, or places where the scenario needed a fallback.
- Track issue timing while recording:
  - Start an elapsed timer when the scenario starts.
  - Store findings as `{ at: "MM:SS", message, details }`.
  - For console, page, or network events, record the elapsed time when the event fires.
  - For visual issues found during frame review, use the frame extraction time or nearest visible step timestamp.
  - If an issue spans a range, report the first visible time and optionally add `through MM:SS`.
- Treat expected setup noise separately from product issues, such as unauthenticated `401` calls before login or dev-server compile delays.

## Exploration Report

When the user asks to explore, test, break, audit, or point out what works, the final response must include a concise report after the video:

- **What worked**: completed user-visible flows, good validation, graceful empty states, useful affordances.
- **Needs work**: UX friction, unclear states, missing data, layout overlap, weak copy, slow or brittle interactions. Prefix each item with an approximate video timecode, for example `[00:42]`.
- **Crashed or broke**: app crashes, uncaught exceptions, failed API calls, console errors that affect the flow. Prefix each item with an approximate video timecode. Say "No crash observed" if none were observed.
- **Struggles / blockers**: setup problems, flaky external services, selectors that were hard to target, data gaps, permissions, CAPTCHA, or anything that limited coverage. Prefix each item with an approximate video timecode when it appears in the video.
- **Artifacts / verification**: MP4 path, duration/size, preview-frame inspection, and any findings file path if one was created.

Keep the report direct and evidence-based. Timecodes may be approximate, but they must let the user jump to the relevant moment in the video. Do not overstate automated observations as root causes; phrase likely causes as hypotheses.

## Dependencies

The recorder script loads Playwright from the workspace where the command is run. If it fails with `Cannot find module 'playwright'`, install it in the workspace:

```powershell
npm install -D playwright
npx playwright install chromium
```

If the workspace has no Node project, create a disposable recording folder or use an existing demo folder with its own `package.json`.

The script uses `ffmpeg` when available to create an MP4 alongside Playwright's WebM. If `ffmpeg` is missing, return the WebM.

## Handling Public Websites

Automated browsers can trigger Google, Cloudflare, or CAPTCHA verification. Do not try to bypass or solve verification challenges.

If a public search or browser step gets blocked:

- Record the blocker if it is part of the truthful demo.
- Use web search or the target site's index to verify the destination.
- Continue directly to the verified URL if the user wants the final page demo.
- State the limitation in the final response.

Use headed mode by default for public websites because it is closer to a real browser session. Use headless mode for local apps or CI-style recordings when it works.

## Verification

Before finalizing:

1. Check that the output video exists and has nonzero duration:

```powershell
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 .\demo-recording\app-demo.mp4
```

2. Extract and inspect a representative frame:

```powershell
ffmpeg -y -ss 00:00:05 -i .\demo-recording\app-demo.mp4 -frames:v 1 .\demo-recording\preview.png
```

3. Use `view_image` on the frame when available.

If the scenario stops early, still verify and return the partial video when one exists. Explain where it stopped and include the observed blocker in the report.

## Embedding Videos In Chat

In the final response, show the video with Markdown image or media syntax, not a plain link:

```markdown
![Demo](C:/absolute/path/to/demo-recording/app-demo.mp4)
```

Use a forward-slash absolute path and do not wrap the path in angle brackets. If the generated MP4 lives in a path with spaces or fails to render as an inline player, copy it to a no-space export folder first, then embed that copied MP4:

```powershell
$destDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "codex_video_exports"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -LiteralPath ".\demo-recording\app-demo.mp4" -Destination "$destDir\app-demo.mp4" -Force
```

```markdown
![Demo](C:/Users/example/Documents/codex_video_exports/app-demo.mp4)
```

Also include the direct filesystem path in text after the embed so the user can open it if the chat renderer fails.
