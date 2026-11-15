---
name: feature-walkthrough
description: Record a real application feature as a guided, captioned video in the style of the Vite lease-report walkthrough. Use for requests to explain a new feature on video with step-by-step comments, a visible cursor, highlighted controls and a playable MP4. Comments mean on-screen captions by default, not voiceover.
---

# Feature Walkthrough

Make a user guide from a real feature, not a montage of clicks. The reference is the Vite lease-report walkthrough of 11 November 2026: explain the task, show each action, explain the result, check the output. Adapt the journey to the feature; do not force every feature into five steps or show unrelated parts of the app.

Read [references/style-and-scenario.md](references/style-and-scenario.md) before authoring. Use the installed `browser-demo-recorder` skill for its real-stack, authorization, evidence and reporting guidance; this skill supplies a specialized capture/render pipeline instead of its generic recorder. If unavailable, follow the real-stack and reporting requirements below.

## Choose the demonstration

- Infer the feature, URL, branch/environment, language and representative input from the task and repository. Ask only for consequential missing information. Recording does not imply deploying, changing code, sending messages or publishing the video.
- Follow repository instructions for accounts, local authentication, ports and data. Preserve existing services. Do not turn off deployed authentication or stop an occupied port.
- Record the real frontend, backend, AI calls and final result. No fabricated responses, route mocks or invisible shortcuts to success. If blocked, preserve partial evidence and explain the blocker.
- Match the user's chosen language, otherwise the recorded UI. The reference uses English. Use plain task-oriented language. Default to silent captions; voice or music only when requested.
- Plan starting state, input, goal, actions, visible checks, output and ending. Add only relevant tips. For exports, open the actual downloaded artifact and inspect its contents. Keep source inputs distinct from reference/example outputs.

## Record

1. Put the scenario and artifacts in a unique ignored `output/browser-demo-recording/<feature>-<timestamp>/` directory. Inspect the app or source to choose real locators. Never copy private reference documents into this skill.
2. Write a CommonJS scenario exporting `async ({page, context, guide, outDir, rehearsal}) => { ... }`. Use the guide API in the reference and assertions on the actual UI. An optional rehearsal must explicitly stop before costly or consequential actions; it is a separate take, not evidence of completing them.
3. Run `scripts/record.cjs <scenario.cjs> <new-capture-directory>`. Playwright resolves from the workspace, then `PLAYWRIGHT_MODULE`, then the shared cache `${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/playwright`. If none has it, install once into the cache with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix "${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/playwright" playwright`; never change product dependencies. The recorder uses system Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `CHROME_PATH`, `/usr/bin/chromium` on Omarchy, `/usr/bin/chromium-browser` on Fedora, then Google Chrome) and falls back to Playwright's bundled browser only when none exists.
4. Run `scripts/render.cjs <capture/events.json>`. The 1440 × 792 capture gains a separate 108-pixel caption strip, producing 1440 × 900 MP4. Captions never cover the app or alter its CSS layout. Cursor/highlight overlays are recording aids, not product UI. Encoding uses libx264 `-preset veryfast -crf 20` on all cores; set `FFMPEG_X264_PRESET=slow` for a smaller final file.
5. Default speed is 1.15×, matching the reference; reading holds account for it. Override `GUIDE_SPEED` before capture when needed. Cut only explicitly marked idle waits with a visible explanation. Preserve transitions, failures, raw footage, events, source-to-final segment map and final caption timeline.
6. Correct mistaken captions in a copy of `events.json`, preserving the original and describing corrections in the report. Never claim a highlight, saved change or completion absent on screen. Report separate takes honestly; this renderer renders one take at a time.

## Verify and deliver

- Check events outcome and final MP4 duration/dimensions/size with ffprobe; decode with FFmpeg. A generated file is not proof of completing the scenario.
- Inspect rendered frames at intro, first action, main results, cut boundaries, export and ending. Check caption fit, reading time, synchronization, cursor, highlights and modals. Distinguish sampled frames from full playback verification.
- Use edited timecodes from `timeline.json`/`timeline.txt` and map raw evidence through `segments.json`. Never publish raw timestamps as final timestamps after cuts/speed changes.
- Save `REPORT.md`: environment/date/revision, actual scope and input provenance, completed/skipped steps, prompts/results, final chapters, outputs, findings with final timecodes, limits, editing/corrections/separate takes, and artifact checks. Distinguish mentioned controls from clicked-and-verified capabilities. Do not infer broad QA or deployment verification.
- Keep credentials/tokens out of view and logs. Preserve readable task content; do not silently blur supplied documents. Publishing to GitHub, Drive or email requires the relevant authorization.
- Embed the verified video in chat: `![Feature walkthrough](/absolute/path/walkthrough.mp4)`, link the report and give short chapters. A screenshot or file link does not replace a playable video. If the host requires an HTML player, use supported attachments, never an inaccessible local file URL.

Creating this skill does not itself request a new product recording. On invocation, complete the requested recording or return the real partial take and specific blocker.
