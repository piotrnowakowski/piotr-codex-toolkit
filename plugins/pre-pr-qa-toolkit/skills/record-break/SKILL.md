---
name: "record-break"
description: "Record adversarial browser demos that try to break an app, product flow, chat flow, or local web feature, returning an embedded video with a report of what went well and what went wrong."
---

# Record Break

## Purpose

Find real failures in a browser-accessible system and make them visible. Prefer truthful adversarial exploration over a polished happy-path demo.

Use the real app stack whenever possible. Do not mock browser routes, API responses, tool calls, LLM outputs, auth state, or committed results unless the user explicitly asks for a mock.

## Workflow

1. Load and follow the `browser-demo-recorder` skill if it is available. Its video verification and embedding rules are mandatory for this skill.
2. Identify the target surface: local URL, route, branch, app server, account, feature flag, environment, and any write boundaries.
3. Verify the app is actually reachable. Start or reuse the required dev server when appropriate.
4. Build an edge-case plan with realistic user prompts and actions. Favor inputs a normal user might try, not artificial test strings unless they are useful.
5. Record the adversarial flow with Playwright video. Use repo-root `output/browser-demo-recording/` for scenarios, logs, previews, and videos when inside a git repo.
6. Preserve failures in the recording. If the flow blocks, record or report the blocker instead of silently switching to a fake success path.
7. Verify the final video with `ffprobe` or equivalent duration/size checks, extract a representative preview frame, and inspect it.
8. Return the embedded video plus a report that clearly separates observed product behavior from local setup issues.

## Edge-Case Strategy

Cover as many meaningful cases as time allows:

- Invalid but plausible values, IDs, dates, keys, states, permissions, and filters.
- Missing required information, ambiguous references, duplicate actions, and rollback/undo paths.
- Attempts to bypass confirmation, approval, or save boundaries.
- Bulk actions, partial failures, stale state, refresh/retry behavior, and interrupted flows.
- Natural-language prompts that ask for too much, ask for the wrong thing, or contradict the UI.
- Setup stress: expired sessions, missing credentials, stale drafts, unavailable services, redirects, failed API calls, and confusing error messages.

Stop before irreversible production writes, destructive changes, purchases, emails, or external side effects unless the user explicitly authorized that boundary. For dangerous actions, test up to the confirmation screen and report what would happen next.

## Recording Standards

- Highlight important controls and visible responses before and after each step.
- Keep one video focused enough to watch, usually one to three minutes. Create multiple videos only when one recording would become hard to follow.
- Log exact prompts/actions and observed response snippets when testing chat or agent flows.
- Inspect backend logs, browser console/network errors, database state, or generated artifacts when needed to explain a failure.
- Do not expose secrets in the video or report.

## Report Format

Always include:

- Embedded video using an absolute local path.
- Video path, duration, and file size.
- Target page/flow, environment, branch when relevant, and whether it used the real stack.
- Exact prompts/actions used.
- Observed result for each prompt/action.
- What went well.
- What went wrong, including bugs, blockers, flakes, setup issues, and confusing UX.
- Whether any data was written, staged, or intentionally left unconfirmed.
- A verdict: pass, blocked, or not merge-ready, with the reason.

Be direct when the goal fails. A good `record-break` run is successful when it finds and documents a real weakness, not only when the product succeeds.
