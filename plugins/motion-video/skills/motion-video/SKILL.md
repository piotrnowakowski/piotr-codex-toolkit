---
name: motion-video
description: Create or extend code-rendered motion films, product feature videos and logo animations with Three.js, HTML, Playwright, Web Audio and ffmpeg. Use for Motion Video or Motion Lab requests and deterministic frame-by-frame animation. A live browser recording alone belongs to a browser-demo workflow.
license: MIT
---

# Motion Video

Turn the brief into an actual MP4, with editable source and measured evidence. The bundled starter runs locally, without a paid API or a required HyperFrames installation. Preserve the user's chosen engine when extending an existing project.

## Start with the existing work

Read the brief, source composition and latest review. Keep delivered versions intact; extend them in a new file or output folder. Infer the subject, language, length and style from the conversation before asking questions. A request for the film authorizes local production through the final file; do not insert an approval checkpoint unless a required decision is missing.

For a new project, run the initializer using this skill's real location:

```powershell
node "<skill-dir>/scripts/init-project.mjs" "<new-project-dir>"
```

In the generated project:

```powershell
npm install
npx playwright install chromium
node render.mjs review
```

Requires Node 20+, ffmpeg and ffprobe on PATH. The starter pins the Three.js and Playwright versions used by the original workflow. Inspect existing dependencies before replacing them. The initializer refuses a nonempty destination.

## Author the film

Write a short `BRIEF.md`: audience, message, dimensions, duration, sound, shot times and source evidence. Default new output to 1920 × 1080 at 30 fps; use the requested format and preserve an existing film's conventions. A 120 BPM grid is a useful starting point, not a constraint on every brief.

For a product film, confirm features and labels in current code, documentation, supplied screens or a recording. Keep the product repository read-only unless editing it is part of the task. Rebuild only the controls a shot needs, or use a readable source crop. Do not invent buttons, current results, measurements or testimonials. Keep saved examples, illustrative animation and a fresh live run distinguishable. Treat old speed, accuracy and provider-price claims as unverified until their actual evidence is checked.

Use the product's own logo, fonts and colours when available; keep licensed assets and their notices together. The starter's navy, paper and gold are examples, not a style to impose on every brand. Do not copy client documents, private conversations or credentials into a reusable plugin or public repository.

Open on an action or a clear message. Give each shot one main idea, reveal details in sequence, then leave time to read. Let camera moves expose a relevant control or result. Alternate compositions when a longer film needs it; extending duration should add useful features or explanation. Use local fonts and assets for reproducible output. Add no voiceover, extra format, paid service or distribution destination unless requested or already authorized.

## Rendering contract

Read [references/render-contract.md](references/render-contract.md) when authoring or changing the renderer, shader, motion or sound. The essential interface is:

- `window.VIDEO = { width, height, fps, duration, audio }`.
- `window.renderAt(t)` sets the complete frame from absolute time, with half-open scene intervals.
- `window.__ready = true` only after fonts, images and shader setup are ready.
- Optional `window.renderAudio()` returns a base64 PCM WAV for the entire film.
- Scene roots carry `data-shot`, `data-start` and `data-duration`. Mark important readable text with `data-check-bounds`; use `data-allow-overlap` only for an intentional, visually reviewed overlap.

Keep a single time source. Derive typing, counters, cursor positions, springs, material motion and seeded variation from `t`. No accumulated frame state, random calls inside the render function, CSS animation clock, timers or live network dependency. Use `requestAnimationFrame` only for the interactive preview, disabled by `?render=1`.

## Review, render and deliver

```powershell
node render.mjs still 2.5
node render.mjs review
node render.mjs render
node render.mjs export
node render.mjs verify
```

`node render.mjs all` runs the full pipeline. `review` checks ids, scene cuts, out-of-order seek determinism and marked text bounds/overlaps, then writes a contact sheet and individual samples. `render` writes frames and an optional WAV. `export` rejects a changed source tree or an incomplete frame set and verifies the resulting media. Frames are kept in a source-hash folder so changed projects cannot silently mix old and new frames.

Open the contact sheet and representative full-size samples. Inspect early, middle and final states, cuts, the busiest UI shot, phone readability and the ending hold. Automated bounds do not prove that a screenshot crop contains every word. Fix the composition, then regenerate affected review evidence and render the current source.

Measure the **encoded AAC**. A loudness filter setting or a clean WAV does not establish the final true peak. The export includes a conservative limiter; verification checks the decoded file, integrated loudness and true peak. If verification fails, fix the mix or encoder chain and verify again. State whether sound was actually heard or only measured.

Write `REVIEW.md` with corrections, checks, inspected frames, source boundaries and any remaining material weakness. Deliver the MP4 inline when the host supports it, a clickable file path, source location and a short outcome. Explain a real limitation without turning the response into an audit report. Sending, uploading, posting or publishing the video requires the user's authorization for that destination; a video-creation request alone does not authorize distribution.
