---
name: setup
description: Step 2 of video-studio. Scaffold a ready-to-render video project folder for a brief. It clones ClaudeAnimationBase (p5.brush) with the PDoomVideo reference and/or initialises a HyperFrames project (hybrid = both, HyperFrames in cut/), places the song and the brief, installs fal/ElevenLabs clients for AI-footage tiers, protects secrets in .gitignore and runs a preflight check (Node, Chrome, ffmpeg, plugin, keys, audio). Use this after the scenario skill, or whenever the user wants to "set up the video project", "prepare the folder", "install what the video needs" or "check if I'm ready to make the video", or has a music-video-brief.md and asks what's next.
---

# Setup: scaffold the video project

Step 2 of **scenario → setup → create**. The goal is a folder where the `create` skill (or a fresh Claude Code / Codex session) can start working right away, with no missing tools. Shared scripts live at the plugin root, two levels above this skill's base directory: `<base>/../../scripts/`.

## 1. Work out the settings

Read the settings block at the top of `music-video-brief.md` (written by `scenario`): `slug`, `engine`, `tier`, `audio`, `audio_file`, `resolution`. If there's no brief, ask for **engine**, **audio file (or none)** and **folder name**, or offer to run `scenario` first. The folder defaults to `~/videos/<slug>`.

## 2. Run the scaffolder

```bash
node <plugin-root>/scripts/setup_project.mjs --dir=<folder> --engine=<p5|hyperframes|hybrid> --tier=<A|B|C> \
  [--song=<path to audio>] [--brief=<path to music-video-brief.md>] [--resolution=landscape|portrait|square]
```

Add `--dry-run` first if the user wants to see what it will do. What it does per engine:

| Engine | Result |
|---|---|
| `p5` | ClaudeAnimationBase cloned as the project root, `reference/PDoomVideo`, `npm install` |
| `hyperframes` | `npx hyperframes init <dir> --non-interactive` (blank example, chosen resolution) |
| `hybrid` | the p5 setup, plus a HyperFrames project in `cut/` and `out/plates/` for the painted plates |

In every case it also creates `assets/ refs/ out/`, copies the song to `assets/song.<ext>` and the brief to `BRIEF.md`, adds `.env`, `out/` and `node_modules/` to `.gitignore`, and runs the preflight. Tier B/C also installs `@fal-ai/client`, plus the ElevenLabs SDK when `ELEVENLABS_API_KEY` is set.

The HyperFrames init runs with `HYPERFRAMES_SKIP_SKILLS=1`, because the skills already come from the HyperFrames plugin (Claude Code or Codex) and installing a per-project copy would duplicate them. HyperFrames CLI renders send anonymous usage telemetry (the `--skill` slug); mention this if the user cares about privacy.

## 3. Fix what the preflight flags

- **Missing tools:** give the exact install command from `<plugin-root>/references/toolchain.md` (winget/brew/apt) and offer to run it.
- **HyperFrames plugin missing:** Claude Code: `claude plugin marketplace add heygen-com/hyperframes` then `claude plugin install hyperframes@hyperframes`. Codex: `codex plugin marketplace add heygen-com/hyperframes` then `codex plugin add hyperframes@hyperframes`. Either needs a new session.
- **Keys (tier B/C):** tell the user to set `FAL_KEY` / `ELEVENLABS_API_KEY` themselves (`setx` on Windows, then a new terminal). Never ask them to paste a key into chat, and never write keys into files other than a gitignored `.env` the user creates.
- **Audio "missing"** is fine when `audio: none` or `code`. If `audio: suno`, remind them to save the track as `assets/song.mp3` once it's made.
- **No dedicated GPU** (p5.brush watercolour fills render at seconds per frame): note it. The `create` skill will budget render time or swap to cheaper fills.

## 4. Hand off

Report the folder, what was installed, and anything still blocking. Then offer the two ways to continue:
1. **`create` in this session**: "make the video from BRIEF.md in `<folder>`".
2. **A fresh session**: `cd <folder>` then `claude` (or `codex`), paste the brief (or say "follow BRIEF.md"). A fresh session starts with an empty context, which suits long productions.
