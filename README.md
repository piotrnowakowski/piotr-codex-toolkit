# Piotr Codex Toolkit

Private Codex plugin marketplace for browser-based product QA and CityCatalyst demos.

## Included plugin

`pre-pr-qa-toolkit` bundles:

- `pre-pr-feature-audit` — critical, user-centered browser audit with a GO/NO-GO report.
- `browser-demo-recorder` — verified Playwright walkthrough recording with structured metadata, timecoded findings, and standard or detailed audit reports.
- `expect-browser-testing` — optional independent Expect browser pass.
- `record-citycatalyst-inventory-demo` — safe CityCatalyst GHGI demo with explicit cleanup approval, CC/CA runtime-error capture, checkpoints, Clima, results, and optional CSV.
- `show-gh-comments` — review-only extraction and classification of the open pull request's GitHub comments and review threads.
- `ui-ux-pro-max` — searchable UI/UX design intelligence for design, implementation, and visual UX review.
- `oef-mcp` — a workflow guide for the separately connected OEF MCP app, covering current OEF knowledge, Jira, Notion, Google Workspace, team, and CityCatalyst emissions lookups.

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
```

Restart or refresh the Codex app, then test the plugin in a new conversation.

If `codex` reports that `plugin` is an unexpected command, update Codex or add the private marketplace through the Codex app's Plugins Directory.

## Update

```powershell
codex plugin marketplace upgrade piotr-codex-toolkit
codex plugin add pre-pr-qa-toolkit@piotr-codex-toolkit
```

Use a new conversation after reinstalling so Codex loads the refreshed skills.
