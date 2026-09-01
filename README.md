# Piotr Codex Toolkit

Private Codex plugin marketplace for browser-based product QA and CityCatalyst demos.

## Included plugin

`pre-pr-qa-toolkit` bundles:

- `pre-pr-feature-audit` — critical, user-centered browser audit with a GO/NO-GO report.
- `browser-demo-recorder` — verified Playwright walkthrough recording with structured metadata, timecoded findings, and standard or detailed audit reports.
- `expect-browser-testing` — optional independent Expect browser pass.
- `cc-demo-recorder` — standard CityCatalyst GHGI demo and point-by-point audit.

## Prerequisites

- Install the Product Design plugin. `pre-pr-feature-audit` requires `product-design:audit` on every run.
- PDF and Documents skills are required when the tested feature exports PDF or DOCX files.
- The target workspace must provide Playwright. FFmpeg is optional but recommended for MP4 conversion.
- Browser logins, credentials, application data, and local services are not included in this repository.

## Install from this private repository

The GitHub account installing the marketplace must have access to this repository.

```powershell
codex plugin marketplace add piotrnowakowski/piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
```

Restart or refresh the Codex app, then test the plugin in a new conversation.

If `codex` reports that `plugin` is an unexpected command, update Codex or add the private marketplace through the Codex app's Plugins Directory.

## Update

```powershell
codex plugin marketplace upgrade piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
```

Use a new conversation after reinstalling so Codex loads the refreshed skills.
