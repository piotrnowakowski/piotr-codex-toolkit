---
name: create
description: Step 3 of video-studio. Direct, animate, review and render the actual video from a brief (BRIEF.md / music-video-brief.md) in a scaffolded project, with p5.brush (ClaudeAnimationBase), HyperFrames or hybrid. Covers the timing backbone (song beats and lyrics, or a fixed grid when there's no music), storyboard with review gates, setting the quality bar on the first scenes then working scene by scene, contact-sheet self-review, optional fal/Seedance footage, and the final render and mux with cutdowns. Use this whenever the user says "make the video", "render it", "follow the brief", "start production", "do scene 3 next", "fix this shot" or "export the final cut" in a video-studio project, or points at a BRIEF.md, even without naming the skill.
---

# Create: make the video

Step 3 of **scenario → setup → create**. You're now the director-animator the brief was written for. **The brief is the creative authority. This skill is the production method.** Where they conflict on taste, follow the brief. On process safety (keys, budget, gates), follow this skill.

Shared files at the plugin root (`<base>/../../`): `scripts/beat_grid.mjs`, `scripts/contact_sheet.mjs`, `scripts/check_env.mjs`, `references/toolchain.md` (tier B pipeline, installs), `references/hyperframes.md` (skills, CLI, AI Jason loop, hybrid wiring).

## 0. Preconditions

- Find the project (cwd, or the path the user gives) and read `BRIEF.md` (or `music-video-brief.md`) **in full**, including the settings block. If there's no project, run `setup` first. If there's no brief, offer `scenario`.
- Run `node <plugin-root>/scripts/check_env.mjs --engine=… --tier=…` from the project. Stop only on blocking issues.
- Read the engine's own guide before writing any code. **p5:** `ANIMATION_GUIDE.md`, and skim `reference/PDoomVideo/STORYBOARD.md` + `src/ch/`. **HyperFrames:** invoke the `/hyperframes` router skill, then the workflow named in the settings (e.g. `/music-to-video`, `/product-launch-video`). Those skills own the composition contract, so don't guess it.
- This is long work. Keep a running `PROGRESS.md` (phase, scenes done, open issues, spend) so the work survives context compaction or a new session. Re-read it when you resume.

## 1. Timing backbone → `TIMELINE.md`

Everything is timed from this one file.

- **Song:** `ffprobe` the duration. Get the lyrics with timestamps (lyric sheet, or Whisper word timestamps via `faster-whisper`; HyperFrames `init --audio` can also transcribe). Find the BPM and first downbeat (from the lyric sheet or the user, or `librosa.beat.beat_track`, or tap it out against the waveform). Then run `node <plugin-root>/scripts/beat_grid.mjs --song=assets/song.mp3 --bpm=<bpm> --offset=<downbeat> --fps=<fps>`.
- **No music / code music:** `beat_grid.mjs --bpm=<grid_bpm> --fps=<fps> --duration=<len>`. Pick a BPM where a beat is a whole number of frames (120 @ 30 fps, 90 @ 30 fps, 144 @ 24 fps). For code music, compose to this grid (Tone.js / OfflineAudioContext → `assets/song.wav`) **before** animating.
- Write `TIMELINE.md`: sections (intro/verse/chorus or story beats) with bar ranges, every lyric or text line with its time, and the planned hit points.

## 2. Storyboard → `STORYBOARD.md` (+ review gate)

For every shot: start/end time (on bar lines), the lyric or line, **composition** (where text sits, where the character sits, how busy the background is), camera move, transition out, and a one-line intent. Plan the whole piece before building anything. Things planned separately and stitched together look jarring.

For HyperFrames, use the workflow skill's storyboard or preview so the user can comment per frame (feedback is saved to JSON in `.hyperframes/`).

**Gate:** if `review_gates` includes `storyboard`, stop here. Show the storyboard (plus a few rough stills if cheap) and ask for comments on **layout and wording only**, not polish. Revise until approved. In autonomous mode, critique it yourself against the brief's hook, text and taste rules, and write your verdict in `PROGRESS.md`.

## 3. Style frame and quality bar (scenes 1–2)

Build the **first one or two scenes to final quality** before touching the rest. They define the look, motion language, type system and camera vocabulary for everything after. Render them, review them (step 5), and iterate until they're clearly at the brief's bar ("better than anyone's ever seen" includes this).

**Gate:** if `review_gates` includes `first-scene`, show the finished scene 1–2 clip and get approval.

Then write down what makes them work (palette, stroke weights, type scale, easing, transition style) in `ANIMATION_GUIDE.md` (p5) or `frame.md` / `design.md` (HyperFrames). This becomes the shared reference.

## 4. Scene by scene

Build the remaining scenes **one at a time** (or one chapter at a time), each held to the scene 1–2 standard. Focusing on one or two scenes gives much better results than spreading attention across the whole video.
- **Subagents** (if your agent has them: Claude Code agents, Codex subagents) can build scenes or chapters in parallel **only after** the quality bar exists. Give each one the brief, TIMELINE, STORYBOARD rows, the guide and the reference scenes. Each owns only its own files. Review everything they hand back as if a stranger had written it.
- **p5 rules** (from ANIMATION_GUIDE): every shot is a pure function of time (`hash()`, not `Math.random()`), paint the full frame, keep faces above the karaoke band.
- **HyperFrames rules:** compositions must be seekable and deterministic (GSAP timelines bound to the clock). Check the `/hyperframes-registry` before hand-building a named effect. Run `npx hyperframes lint` / `check` after each composition.
- **Hybrid:** render the p5 plates to `out/plates/NN.mp4` (`node render.mjs --clip=<t0>:<t1> --out=out/plates/NN.mp4`), use them as `<video>` clips in `cut/` compositions, and put the kinetic text layer on top in GSAP. Both sides read the same TIMELINE.
- Save the **opening second and the ending for last**, once the story works.
- Keep text short and elements few. Attention spans are short, and simplifying is most of the craft.

## 5. Review loop (after every scene and at the end)

Look at your own output; don't just trust that the code ran.
- **Stills and contact sheets:** p5 `node render.mjs --sheet=<t,t,t>`; HyperFrames `npx hyperframes snapshot`; any engine `node <plugin-root>/scripts/contact_sheet.mjs --video=<clip> --from=<t0> --to=<t1> --every=0.5`. Read the images and judge them against the brief: hook, composition, legibility, taste, "is this slop?"
- **Timing:** step through frames around beat and lyric hits (`--times=` at TIMELINE hit points). Text should land on the beat and cuts on bar lines.
- **Short clips with audio** for motion feel, then the **full render watched start to finish**. For vertical, review at phone size and check the UI safe zones.
- Log weak moments with timestamps in `PROGRESS.md`, fix them, and render again. Expect several passes; going back and redoing work is part of the job.

## 6. AI footage (tiers B/C only)

Follow the "Tier B pipeline mechanics" in `toolchain.md`: style and character sheets → Seedance clips per shot (audio slices for lip sync) → sync-verification loop → rotoscope (B) or composite (C).
- Look up current model IDs on fal.ai/models; don't hard-code remembered ones.
- **Spend discipline:** test short, low-res generations first. Cache every asset in `assets/gen/` with its prompt next to it. Log each call's cost in `out/spend.md`. **Stop at the brief's hard ceiling.** If a ceiling isn't set, stop and ask before spending more than $20.
- Keys come only from env vars. Never print them or write them to files.

## 7. Final render and delivery

- **p5:** `node render.mjs --frames=0:<dur> --workers=<n>` then `--encode --out=out/<slug>.mp4`. **HyperFrames/hybrid:** `npx hyperframes render` in the HyperFrames project.
- **Audio:** the original song untouched, plus the SFX bus mixed low. Or a silent track if `audio: none`. Mux last with ffmpeg if the engine didn't.
- **Verify:** `ffprobe` the duration, resolution, fps and audio stream. Then make a final contact sheet of the whole video.
- **Cutdowns** as the brief specifies (vertical crops or re-compositions, each opening on its own hook and ending on a clean loop point).
- Report to the user: the output paths, the contact sheet image, what you're proud of, known weak spots, render time and spend. Offer specific revisions ("scene 4 feels slow; want me to tighten it?").

## When the user gives feedback mid-production

Treat it like AI Jason's loop: apply it to the named scene, re-render only that scene, show the result, and carry the lesson into the guide so later scenes inherit it. Precise camera language ("same zoom scale, only move the camera", "hold the last frame") maps directly to code, so ask for it when feedback is vague.
