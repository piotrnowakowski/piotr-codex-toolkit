# Piotr Codex Toolkit

Private Codex and Claude Code plugin marketplace for browser-based product QA, CityCatalyst demos and code-rendered video. Scripts and instructions target Linux: Omarchy (Arch, Hyprland/Wayland) and Fedora.

## Included plugins

`pre-pr-qa-toolkit` bundles:

- `pre-pr-feature-audit` — critical, user-centered browser audit with a GO/NO-GO report.
- `browser-demo-recorder` — verified Playwright walkthrough recording with structured metadata, timecoded findings, and standard or detailed audit reports.
- `expect-browser-testing` — optional independent Expect browser pass.
- `record-citycatalyst-inventory-demo` — safe CityCatalyst GHGI demo with explicit cleanup approval, CC/CA runtime-error capture, checkpoints, Clima, results, and optional CSV.
- `show-gh-comments` — review-only extraction and classification of the open pull request's GitHub comments and review threads.
- `ui-ux-pro-max` — searchable UI/UX design intelligence for design, implementation, and visual UX review.
- `record-break` — adversarial browser recording that tries to break a flow and reports what held and what failed.
- `citycatalyst-deployed-feature-test-demo` — planned, approval-gated recorded test of a deployed CityCatalyst feature on the dev server.
- `dependabot-check` — Climate Advisor dependency-branch verification: staleness against `develop`, CA tests and a demo video.
- `gh-split-stacked-pr` — split a large open PR into two to five native stacked PRs with a recoverable backup.
- `frontend-skill` — restrained, image-led composition rules for landing pages, apps, prototypes and game UI.
- `prompt-schema-authoring` — role/task/input/output prompt files with explicit model-aligned field contracts.
- `oef-mcp` — a workflow guide for the separately connected OEF MCP app, covering current OEF knowledge, Jira, Notion, Google Workspace, team, and CityCatalyst emissions lookups.

`video-studio` makes AI videos from idea to MP4, in Codex **and** Claude Code:

- `scenario` — turns an idea (and an optional song) into a long, director-style video brief; picks the engine (p5.brush hand-painted, HyperFrames HTML/GSAP, or hybrid), the audio mode (music is optional) and the optional AI-footage tier.
- `setup` — scaffolds the project folder (ClaudeAnimationBase and/or HyperFrames) and runs a preflight check.
- `create` — timeline, storyboard, first scenes to final quality, then scene by scene with contact-sheet review, then the final render and cutdowns.

Needs Node 22+, Chrome, ffmpeg and git. For the HyperFrames engine, also install the HyperFrames plugin (`codex plugin marketplace add heygen-com/hyperframes` then `codex plugin add hyperframes@hyperframes`). See `plugins/video-studio/README.md`.

`motion-video` creates code-rendered motion films in Codex **and** Claude Code:

- A self-contained `motion-video` skill for product features, motion graphics and logo animations.
- An editable Three.js liquid-gold starter, HTML typography, absolute-time `renderAt(t)` and local Web Audio.
- Playwright rendering, contact sheets, seek determinism and safe-area checks; ffmpeg H.264/AAC export with final decoded-audio measurements.
- No required HyperFrames installation or paid API. Requires Node 20+, ffmpeg and ffprobe; the project installs its pinned Playwright/Three.js dependencies.

Invoke **Motion Video** or `$motion-video`. See [the skill](plugins/motion-video/skills/motion-video/SKILL.md) for starter and renderer commands.

`feature-walkthrough` records real application features in the style of the Vite lease-report guide:

- Plain step-by-step captions below the app, a visible cursor and highlighted controls.
- A real user journey through the visible result and actual downloaded output.
- Explicit idle-wait cuts, a final caption timeline and an evidence report.
- Silent 1440 × 900 MP4 output; default 1.15× speed with reading time preserved.

Requires Node.js, Playwright, FFmpeg with the subtitles filter, and ffprobe. No original footage, client documents, credentials or paid media service is bundled. See [the skill](plugins/feature-walkthrough/skills/feature-walkthrough/SKILL.md).

For Devin or another SKILL.md-compatible agent, copy the complete `plugins/feature-walkthrough/skills/feature-walkthrough` folder into its skills directory (for example the project's `.devin/skills/feature-walkthrough`). Keep `scripts/` and `references/` with `SKILL.md`.

## Linux setup (Omarchy and Fedora)

The scripts use a system Chromium when one is installed, so Playwright does not download its own browser. They look at `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then `CHROME_PATH`, then `/usr/bin/chromium` (Omarchy), `/usr/bin/chromium-browser` (Fedora) and Google Chrome. When a workspace has no Playwright, the scripts install it once into `${XDG_CACHE_HOME:-~/.cache}/agent-tools/playwright` and reuse it. Recording runs headless, so it needs no display and does not touch the Hyprland desktop.

FFmpeg encodes with `libx264 -preset veryfast` by default; set `FFMPEG_X264_PRESET` (for example `medium`) for smaller final files.

```bash
# Omarchy / Arch
sudo pacman -S --needed chromium ffmpeg python github-cli jq git
mise use -g node@lts

# Fedora (FFmpeg with libx264 comes from RPM Fusion; ffmpeg-free lacks it)
sudo dnf install https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
sudo dnf swap ffmpeg-free ffmpeg --allowerasing
sudo dnf install chromium nodejs python3 gh jq git
```

## Prerequisites

- Install the Product Design plugin. `pre-pr-feature-audit` requires `product-design:audit` on every run.
- PDF and Documents skills are required when the tested feature exports PDF or DOCX files.
- Playwright comes from the target workspace or the shared cache above. FFmpeg is optional for `browser-demo-recorder` but required for MP4 output in the video plugins.
- Browser logins, credentials, application data, and local services are not included in this repository.
- OEF MCP is an account-scoped Codex connector. Connect it in Codex before using `oef-mcp`; this repository intentionally contains no connector endpoint, credentials, or copied organizational data.

## Install from this private repository

The GitHub account installing the marketplace must have access to this repository.

```bash
codex plugin marketplace add piotrnowakowski/piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
codex plugin add video-studio@piotr-codex-toolkit
codex plugin add motion-video@piotr-codex-toolkit
codex plugin add feature-walkthrough@piotr-codex-toolkit
```

All plugins also install in Claude Code from the same repository:

```bash
claude plugin marketplace add piotrnowakowski/piotr-codex-toolkit
claude plugin install pre-pr-qa-toolkit@piotr-codex-toolkit
claude plugin install video-studio@piotr-codex-toolkit
claude plugin install motion-video@piotr-codex-toolkit
claude plugin install feature-walkthrough@piotr-codex-toolkit
```

Restart or refresh the Codex app, then test the plugin in a new conversation.

If `codex` reports that `plugin` is an unexpected command, update Codex or add the private marketplace through the Codex app's Plugins Directory.

## Update

```bash
codex plugin marketplace upgrade piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
codex plugin add video-studio@piotr-codex-toolkit
codex plugin add motion-video@piotr-codex-toolkit
codex plugin add feature-walkthrough@piotr-codex-toolkit
```

In Claude Code run `claude plugin marketplace update piotr-codex-toolkit`. Use a new conversation after reinstalling so Codex or Claude loads the refreshed skills.
