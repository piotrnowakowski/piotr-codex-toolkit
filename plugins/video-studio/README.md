# video-studio (Claude Code + Codex plugin)

Make AI videos with Claude Code or Codex, from idea to MP4:

| Step | Skill (Claude Code / Codex) | Does |
|---|---|---|
| 1 | `/video-studio:scenario` / `$scenario` | Turns an idea (+ optional song) into a long director-style brief in the "Claude Pop" / "P(doom)" style. Picks the engine, audio mode and AI-footage tier. Writes `music-video-brief.md`, and Suno lyrics + a style prompt if you need a song. |
| 2 | `/video-studio:setup` / `$setup` | Scaffolds the project: ClaudeAnimationBase (p5.brush) and/or HyperFrames, places the song and brief, runs a preflight check. |
| 3 | `/video-studio:create` / `$create` | Makes the video: timeline, then storyboard (review gate), then scenes 1–2 to final quality, then scene by scene, then contact-sheet review, then final render and cutdowns. |

You don't need to type the commands. Asking "make me a video prompt for…", "set up the project" or "make the video" triggers the right step.

## Engines
- **p5.brush**: hand-painted animation (https://github.com/JohnHeibel/ClaudeAnimationBase, example https://github.com/JohnHeibel/PDoomVideo)
- **HyperFrames**: HTML/GSAP motion graphics (https://github.com/heygen-com/hyperframes). Install its plugin: Claude Code `claude plugin marketplace add heygen-com/hyperframes && claude plugin install hyperframes@hyperframes`; Codex `codex plugin marketplace add heygen-com/hyperframes && codex plugin add hyperframes@hyperframes`
- **Hybrid**: painted plates plus a kinetic-text layer

## Needs
Node 22+, Google Chrome, ffmpeg, git. Free by default. Optional paid extras: fal.ai (`FAL_KEY`) for AI footage, ElevenLabs (`ELEVENLABS_API_KEY`) for sound design, Suno for songs.

## Scripts (`scripts/`)
- `check_env.mjs`: preflight (`--engine --tier --song`)
- `setup_project.mjs`: project scaffolder
- `beat_grid.mjs`: beat/bar grid from BPM (song or fixed tempo)
- `contact_sheet.mjs`: timestamped frame grid from any video, for review

## Credits
Brief style: @donaldjewkes. P(doom) video and animation base: @other__reality / John Heibel. HyperFrames workflow: AI Jason, HeyGen.

## Install

Published in the [piotr-codex-toolkit](https://github.com/piotrnowakowski/piotr-codex-toolkit) marketplace, which works for both agents.

```bash
# Codex
codex plugin marketplace add piotrnowakowski/piotr-codex-toolkit
codex plugin add video-studio@piotr-codex-toolkit

# Claude Code
claude plugin marketplace add piotrnowakowski/piotr-codex-toolkit
claude plugin install video-studio@piotr-codex-toolkit
```

Then start a new session. For the HyperFrames engine, also install the HyperFrames plugin (see Engines above).

## Update

Bump `version` in **both** `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, push, then:

```bash
codex plugin marketplace upgrade piotr-codex-toolkit && codex plugin add video-studio@piotr-codex-toolkit
claude plugin marketplace update piotr-codex-toolkit && claude plugin update video-studio@piotr-codex-toolkit
```
