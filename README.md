# Piotr Codex Toolkit

Private Codex plugin marketplace for browser-based product QA and CityCatalyst demos.

## Included plugins

`pre-pr-qa-toolkit` bundles:

- `pre-pr-feature-audit` — critical, user-centered browser audit with a GO/NO-GO report.
- `browser-demo-recorder` — verified Playwright walkthrough recording with structured metadata, timecoded findings, and standard or detailed audit reports.
- `expect-browser-testing` — optional independent Expect browser pass.
- `record-citycatalyst-inventory-demo` — safe CityCatalyst GHGI demo with explicit cleanup approval, CC/CA runtime-error capture, checkpoints, Clima, results, and optional CSV.
- `show-gh-comments` — review-only extraction and classification of the open pull request's GitHub comments and review threads.
- `ui-ux-pro-max` — searchable UI/UX design intelligence for design, implementation, and visual UX review.
- `oef-mcp` — a workflow guide for the separately connected OEF MCP app, covering current OEF knowledge, Jira, Notion, Google Workspace, team, and CityCatalyst emissions lookups.

`video-studio` makes AI videos from idea to MP4, in Codex **and** Claude Code:

- `scenario` — turns an idea (and an optional song) into a long, director-style video brief; picks the engine (p5.brush hand-painted, HyperFrames HTML/GSAP, or hybrid), the audio mode (music is optional) and the optional AI-footage tier.
- `setup` — scaffolds the project folder (ClaudeAnimationBase and/or HyperFrames) and runs a preflight check.
- `create` — timeline, storyboard, first scenes to final quality, then scene by scene with contact-sheet review, then the final render and cutdowns.

Needs Node 22+, Chrome, ffmpeg and git. For the HyperFrames engine, also install the HyperFrames plugin (`codex plugin marketplace add heygen-com/hyperframes` then `codex plugin add hyperframes@hyperframes`). See `plugins/video-studio/README.md`.

## Prerequisites

- Install the Product Design plugin. `pre-pr-feature-audit` requires `product-design:audit` on every run.
- PDF and Documents skills are required when the tested feature exports PDF or DOCX files.
- The target workspace must provide Playwright. FFmpeg is optional but recommended for MP4 conversion.
- Browser logins, credentials, application data, and local services are not included in this repository.
- OEF MCP is an account-scoped Codex connector. Connect it in Codex before using `oef-mcp`; this repository intentionally contains no connector endpoint, credentials, or copied organizational data.

## Install from this private repository

The GitHub account installing the marketplace must have access to this repository.

```powershell
codex plugin marketplace add piotrnowakowski/piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
codex plugin add video-studio@piotr-codex-toolkit
```

`video-studio` also installs in Claude Code from the same repository:

```powershell
claude plugin marketplace add piotrnowakowski/piotr-codex-toolkit
claude plugin install video-studio@piotr-codex-toolkit
```

Restart or refresh the Codex app, then test the plugin in a new conversation.

If `codex` reports that `plugin` is an unexpected command, update Codex or add the private marketplace through the Codex app's Plugins Directory.

## Update

```powershell
codex plugin marketplace upgrade piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
codex plugin add video-studio@piotr-codex-toolkit
```

Use a new conversation after reinstalling so Codex loads the refreshed skills.
