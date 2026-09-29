# Toolchain: repos, installs, keys

Use this for (a) the tools paragraph inside the brief and (b) the "Before you paste this" checklist for the human. Trim both to the chosen engine, tier and audio mode. HyperFrames install and skills are in `hyperframes.md`.

## Engines at a glance

| Engine | Start from | Needs | Account? |
|---|---|---|---|
| p5.brush (painted) | `git clone https://github.com/JohnHeibel/ClaudeAnimationBase` | Node 20+, Chrome, ffmpeg | No |
| HyperFrames (HTML/GSAP) | `npx hyperframes init my-video` + HyperFrames agent plugin | Node **22+**, ffmpeg (Chrome via Puppeteer) | No |
| Hybrid | ClaudeAnimationBase clone as root; `npx hyperframes init cut` inside it for the final cut | Node **22+**, Chrome, ffmpeg | No |

Free SFX (when there's no ElevenLabs): made in code (Web Audio / Tone.js: whooshes from filtered noise, clicks, risers), or CC0 sounds from https://pixabay.com/sound-effects/ and https://freesound.org (check each file's licence). With HyperFrames, `/media-use` can source SFX too.

## Audio (optional)

| Mode | Setup |
|---|---|
| Song provided | Put it at `assets/song.mp3` |
| Suno / Udio | Make it at https://suno.com (free plan: ~10 songs/day, may not allow downloads, no commercial rights). Download on Pro (~$10/mo; cancel after). Save as `assets/song.mp3`. |
| Royalty-free | https://pixabay.com/music/ or YouTube Audio Library → `assets/song.mp3` |
| Composed in code | `npm i tone` (or raw Web Audio via OfflineAudioContext) → the agent renders `assets/song.wav` |
| None | Nothing to set up. The brief defines a tempo grid instead. |

## Repos

| Repo | Use | Tier |
|---|---|---|
| https://github.com/JohnHeibel/ClaudeAnimationBase | **Starter kit.** p5.js + p5.brush character animation. Includes `ANIMATION_GUIDE.md` (rules, workflow, full API), Clawd (views, emotions, mouths, hats, dances), `core.js` (paint, timing, camera, paper), `timeline.js` (shots and brush-wipe transitions) and `render.mjs` (contact sheets, stills, clips, MP4). Scenes go in `src/scenes/`. | A, B, C |
| https://github.com/JohnHeibel/PDoomVideo | **Full worked example.** A 156.6 s music video in nine chapter files (`src/ch/`), with `STORYBOARD.md` and `ANIMATION_GUIDE.md` written by Opus for parallel subagents. It shows chapter registration, karaoke lyrics, beat helpers (`bpOf`, `pulse`, `kf`), and a resumable multi-worker frame render. | A, B, C (reference) |

Recommended setup: clone ClaudeAnimationBase as the project, and clone PDoomVideo next to it as `reference/PDoomVideo` so the agent can study it without editing it.

```bash
git clone https://github.com/JohnHeibel/ClaudeAnimationBase my-video
cd my-video
git clone https://github.com/JohnHeibel/PDoomVideo reference/PDoomVideo
npm install
mkdir -p assets refs out
# put the song at assets/song.mp3 (and any original video at refs/)
```

Render commands (ClaudeAnimationBase):
```bash
node render.mjs --clip --out=out/video.mp4   # demo clip
# open studio.html in Chrome to scrub; ?loop=emotions / ?loop=views show model sheets
```
PDoomVideo-style full render: `node render.mjs --frames=0:<dur> --workers=4`, then `node render.mjs --encode --out=out/video.mp4`.

## Core installs (all tiers)

| Tool | Why | Windows | macOS | Linux |
|---|---|---|---|---|
| Node.js ≥ 20 | Runs the renderer and the API clients | `winget install OpenJS.NodeJS.LTS` | `brew install node` | distro pkg / nvm |
| Google Chrome | Headless frame rendering (puppeteer-core drives it) | `winget install Google.Chrome` | `brew install --cask google-chrome` | Chrome or Playwright Chromium |
| ffmpeg (+ffprobe) | Muxing, slicing the song, pulling frames out of clips for tracing, checking sync | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |
| Git | Cloning the repos | `winget install Git.Git` | Xcode CLT | distro pkg |
| Claude Code **or** Codex | The agent that runs the brief | `npm i -g @anthropic-ai/claude-code` / `npm i -g @openai/codex` | same | same |

Notes:
- Without a dedicated GPU, p5.brush watercolour fills render at **seconds per frame**. Tell the agent to avoid or replace those fills on integrated graphics, or to budget render time.
- Linux headless: `render.mjs` handles `--no-sandbox`. Use `--soft-gl` with no GPU, or `--gpu-angle=gl-egl` on NVIDIA servers (`node gpu_probe.mjs <chrome>` to check).
- Non-standard Chrome path: `--chrome=<path>` or `CHROME_PATH`.

## Optional helpers

| Tool | Why | Install |
|---|---|---|
| yt-dlp | Download reference music videos or an original video to study | `winget install yt-dlp` / `brew install yt-dlp` / `pipx install yt-dlp` |
| Whisper (openai-whisper or faster-whisper) | Transcribe lyrics with word timestamps when no lyric sheet exists; also used to check lip-sync timing | `pipx install faster-whisper` (or `pip install openai-whisper`) |
| aubio / librosa | Beat and onset detection when the BPM is unknown | `pip install librosa` |

## Generation APIs (tiers B and C)

| Service | Used for | Setup | Key env var |
|---|---|---|---|
| **fal.ai** | Image models for character sheets, style sheets, sets and cast. **Seedance** image-to-video / reference-to-video clips (ByteDance) with character and set references, plus audio slices for lip sync where the model supports it. | `npm i @fal-ai/client`. Docs: https://docs.fal.ai. Find the current Seedance and image model IDs at https://fal.ai/models (search "seedance"). Don't hard-code a version; check it. | `FAL_KEY` |
| **ElevenLabs** | Sound design: risers, whooshes, glitches, crowd and ambience, transition hits. Leave the song itself unchanged. | `npm i @elevenlabs/elevenlabs-js`. Docs: https://elevenlabs.io/docs (Sound Effects API). | `ELEVENLABS_API_KEY` |

Set keys in the shell before starting the agent (Claude Code or Codex). Don't put them in the brief or commit them:
```powershell
# PowerShell (persist for the user)
setx FAL_KEY "..." ; setx ELEVENLABS_API_KEY "..."
```
```bash
# bash/zsh
export FAL_KEY=... ELEVENLABS_API_KEY=...
```
You can also use a `.env` that is listed in `.gitignore`.

Cost guardrails to put in the brief: tell the agent to keep a running cost log (`out/spend.md`), to test prompts on short, low-resolution generations first, and to cache every generated asset under `assets/gen/` with its prompt next to it so nothing is generated twice.

## Tier B pipeline mechanics (put these in the brief as concrete steps)

1. `ffprobe` the song. Get the lyrics with timestamps (lyric sheet, or Whisper word timestamps), then the BPM and bar grid. Write `TIMELINE.md` (sections, lines, beats).
2. Style sheet, then character sheet (turnarounds, expressions, outfits), then cast and sets, all through fal image models. Keep the reference images consistent.
3. `STORYBOARD.md`: each shot gets a start/end time, a lyric, a composition (where the text goes and where the character goes), a camera move and a transition. Plan it before generating anything.
4. Seedance clips per shot, using character and set references. Slice the song with `ffmpeg -ss <t0> -to <t1>` for the singing shots, pass the slice as the audio reference if the model supports it, and generate slightly longer than needed so there's room to trim.
5. **Sync verification loop:** mux each clip with its audio slice, extract frames around the key syllables, and compare mouth shapes and hits against Whisper or beat timestamps. Regenerate anything that drifts.
6. **Rotoscope:** extract frames (`ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png`), then trace poses, silhouettes and camera motion into p5.brush shots, keyframed on song time. Final frames show only the JS drawing.
7. Kinetic lyric layer, meme inserts and brush-wipe transitions.
8. Render contact sheets, then stills, then short clips, then the full video. Watch the whole thing, screenshot weak moments, fix them and render again.
9. Final mux with the **untouched** original audio plus the ElevenLabs SFX bus mixed low.

## Session settings to recommend

- Run the agent (Claude Code or Codex) **from the project folder** so it can see the repos, assets and song.
- Use Opus at high or xhigh effort. The ClaudeAnimationBase author found that higher reasoning effort gives more extravagant, detailed scenes.
- Tell the agent it may use subagents (where supported) to build chapters in parallel. PDoomVideo did this, with `ANIMATION_GUIDE.md` as the shared brief for the subagents.
