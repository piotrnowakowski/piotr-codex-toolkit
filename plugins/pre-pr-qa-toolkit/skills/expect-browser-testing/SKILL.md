---
name: expect-browser-testing
description: Use when a user asks to run Expect or expect-cli, validate a web app in a real browser, smoke-test UI flows after changes, or do diff-based browser QA. Prefer it for frontend or full-stack changes where live browser behavior matters, and treat it as additive validation rather than a replacement for existing unit or integration tests.
---

# Expect Browser Testing

## Overview

Use `expect-cli` to generate and execute browser test plans against a live app. Prefer ephemeral `npx -y expect-cli@latest` runs unless the user explicitly wants a pinned repo dependency or a global install.

## Inputs

- repo root and app URLs
- a concrete instruction describing what to test
- target scope: `changes`, `branch`, or `unstaged`
- whether live auth, paid API calls, or side effects are acceptable

## Workflow

1. Decide whether browser testing is the right tool.
   - Use it for frontend behavior, navigation, forms, auth, chat flows, citations, and regressions visible only in the browser.
   - Do not substitute it for `pytest`, lint, or repo-specific smoke scripts.
2. Ensure the target app is reachable.
   - Start required local servers or use a deployed URL.
   - If the flow will trigger paid APIs or external side effects, confirm that the user wants a live run.
3. Run Expect with an explicit instruction.
   - Ad hoc run: `npx -y expect-cli@latest -a codex -m "<instruction>" -t changes`
   - Full branch run: `npx -y expect-cli@latest -a codex -m "<instruction>" -t branch`
   - First-time install path if the user wants it: `npx -y expect-cli@latest init`
4. Write good instructions for the agent.
   - Include the exact URL, the user flow, expected results, and any hard assertions.
   - Mention loading states, error banners, citations, modals, and console or network issues when relevant.
5. Summarize results clearly.
   - Report pass or fail, blocking issues, repro steps, and what was not tested.

## Prompt Examples

- Good: `Open http://127.0.0.1:3000, ask "What initiatives exist for Munich?", wait for completion, verify the answer renders, citations are clickable, and "Chat About the Answer" opens without UI errors.`
- Good: `Open http://127.0.0.1:3000 in dev mode, generate an answer for Munich and Leipzig, switch to chat, ask a follow-up, and verify citation chips remain clickable.`
- Weak: `test the app`

## Query Mechanism Urbind Defaults

- Backend from repo root: `uv sync --group dev`, then `python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000`
- Frontend from `frontend/`: `npm install`, then `npm run dev`
- Optional frontend env: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`
- Default local URLs: frontend `http://127.0.0.1:3000`, backend `http://127.0.0.1:8000`
- High-value flows:
  - build a document with one or more cities
  - verify citations open the source quote
  - open `Chat About the Answer`
  - in dev mode, verify assumptions or context-management controls render
- This app can trigger real LLM and API usage. Ask before running flows that will spend tokens or depend on live provider behavior.

## Guardrails

- Keep prompts focused on changed behavior. Do not ask Expect to explore the whole app unless the user wants exploratory testing.
- Prefer `-t changes` during active development.
- Do not add `expect-cli` to repo dependencies or CI by default. Use ephemeral `npx` first because this repo does not currently run browser tests in CI.
- Expect is licensed as `FSL-1.1-MIT`, not plain MIT today. Do not vendor or adopt it as a default repo dependency without explicit approval.
