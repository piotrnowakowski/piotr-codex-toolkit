---
name: "dependabot-check"
description: "Verify a CityCatalyst Climate Advisor branch: switch to it, check whether the CA dependency bump is stale against develop, run Climate Advisor verification, and produce an inline browser-demo video. CityCatalyst-repo specific."
---

# Dependabot Check

Use this skill when the user wants real Climate Advisor verification in the CityCatalyst repo (`<CITYCATALYST_ROOT>` below is the CityCatalyst checkout, usually `git rev-parse --show-toplevel` from the current directory), especially for a Dependabot CA branch, CA test run, CA smoke test, or CA browser demo.

## Scope

- This skill is CA-only by default.
- Switch the shared checkout to the requested branch. Do not create a worktree for this skill.
- Do not install or adjust `app/` dependencies as part of this skill unless the user explicitly expands the scope.
- If the checkout is dirty, call that out before switching so the user knows the shared checkout will move.
- A normal successful run includes both CA test evidence and a recorder video at the end.
- Do not treat the skill as complete until you have either:
  - embedded a verified recorder video in chat, or
  - attempted the recorder flow and reported the concrete blocker with logs or partial artifact paths.

## Workflow

1. Inspect repo safety first.
   - Run `git status --short --branch`.
   - If the repo is dirty, report that clearly, then continue with the branch switch for this skill.
   - Reconfirm the active branch after switching.

2. Switch to the requested branch.
   - Fetch first when needed.
   - Switch in place with `git switch <branch>` or `git checkout <branch>`.
   - If merge conflicts are already present on the branch, or appear during any fetch/switch/update work you perform, report whether they were resolved.
   - If no merge or rebase work was needed, say there were no merge conflicts to resolve.

3. Check dependency freshness against `develop` before installs.
   - Refresh the `develop` ref you will compare against: `git fetch origin develop` (fall back to local `develop` only if `origin/develop` does not exist).
   - See whether the branch changes the Climate Advisor manifest or lock file:
     ```bash
     git diff --name-only origin/develop...HEAD -- climate-advisor/pyproject.toml climate-advisor/uv.lock
     ```
   - Inspect the exact changed dependency lines to identify the package name and version delta:
     ```bash
     git diff --unified=0 origin/develop...HEAD -- climate-advisor/pyproject.toml climate-advisor/uv.lock
     ```
   - Compare the package version on `develop` and on the target branch, e.g.:
     ```bash
     git show origin/develop:climate-advisor/pyproject.toml | grep 'package-name'
     git show HEAD:climate-advisor/pyproject.toml | grep 'package-name'
     ```
   - Report the freshness result before running installs: if `develop` is newer, call the PR likely stale/outdated; if versions are equal, call it possibly redundant; if the target branch is newer, continue with normal verification and say the bump is still ahead of `develop`.

4. Install dependencies from the branch you are verifying.
   - In `climate-advisor/`, run `uv sync --locked --group dev`.
   - If `uv sync` fails because a CA-local process is holding files inside `climate-advisor/.venv/`, stop that CA-local process and rerun.
   - If the CA database is not already running: `docker compose up -d postgres` (per the repo README). On Fedora without Docker use `podman compose up -d postgres`.
   - If `uv` is missing: Omarchy `sudo pacman -S --needed uv` (or `mise use -g uv`); Fedora `sudo dnf install uv`.

5. Run the right tests.
   - Climate Advisor default: `uv run --directory service pytest tests/ -v`.
   - Only add broader app or E2E coverage if the user explicitly expands the scope beyond CA verification.
   - If LangSmith SSL noise appears during CA tests, disable tracing in the current shell before re-running pytest:
     ```bash
     unset LANGSMITH_API_KEY
     export LANGSMITH_TRACING=false
     uv run --directory service pytest tests/ -v
     ```

6. Record the CA demo on every run.
   - Use Playwright video recording, not OS screen capture — follow the `browser-demo-recorder` skill (in the same plugin) for the actual recording/verification mechanics.
   - Prefer the real CityCatalyst chat UI so the demo exercises `/api/v1/chat/threads` and `/api/v1/chat/messages`.
   - **CA prerequisites:** verify `CA_BASE_URL` points at a real Climate Advisor service. A correct CA service exposes `/v1/threads` and `/v1/messages` in `openapi.json` and reports `Climate Advisor Service` as the title:
     ```bash
     cd <CITYCATALYST_ROOT>/climate-advisor
     uv run --directory service uvicorn app.main:app --host 127.0.0.1 --port 8002
     # in another shell
     cd <CITYCATALYST_ROOT>/app
     CA_BASE_URL=http://127.0.0.1:8002 npm run dev
     curl -s http://127.0.0.1:8002/openapi.json | grep -E 'Climate Advisor Service|/v1/threads|/v1/messages'
     ```
   - **Local demo credentials** — use the deterministic CA smoke fixture user, not the generic local admin: email `ca-smoke@citycatalyst.local`, password from `$CA_SMOKE_USER_PASSWORD` (set it only for the fixture-creation command, then unset it), default city/inventory `CA CC Smoke City (2024)`:
     ```bash
     cd <CITYCATALYST_ROOT>/app
     CA_SMOKE_USER_PASSWORD=CodexSmokePassword1 npm run upsert-ca-smoke-fixture
     unset CA_SMOKE_USER_PASSWORD
     ```
     Pass credentials to the recorder scenario via environment variables (`CITYCATALYST_DEMO_EMAIL`, `CITYCATALYST_DEMO_PASSWORD`), never hardcoded in checked-in files, and unset them after the run.
   - **Demo script:** log in with the fixture user, open the AI popover (accept the disclaimer if shown), submit a climate-knowledge prompt that should route to `climate_vector_search` (e.g. "Based on the internal climate knowledge base, what is the difference between GPC BASIC and BASIC+ reporting, and which extra sectors are required for BASIC+?"), wait for the full response, then submit a CityCatalyst-inventory prompt that should route to `get_user_inventories` (e.g. "What inventories do I have access to right now, and which city and reporting year should I open first?" — fall back to "Find the latest inventory for this city and tell me the reporting year and inventory type." if the branch favors city search). Stop immediately if the flow blocks or errors.
   - Prefer repo-root `output/browser-demo-recording/` for scenarios, logs, previews, and the final video.
   - Treat the run as incomplete until a non-empty video exists on disk. Prefer MP4 when available.
   - If the recording reports failure or a blocked step, inspect logs and partial artifacts, fix the issue when practical, and rerun. Do not claim success unless the final video was verified.
   - Extract and inspect a representative frame before finalizing.
   - If login works but the chat API returns 404, the app is likely pointed at the wrong local backend — check `CA_BASE_URL`.
   - In the final response, embed the video in chat with an absolute Markdown media path, e.g. `![Recorder video](/absolute/path/to/output/browser-demo-recording/ca-demo.mp4)`. If the path has spaces or does not render inline, copy it to a no-space export folder first and embed that copy.
   - Also include the direct filesystem path, the exact prompts used, whether the flow succeeded or where it stopped, and whether the demo evidence supports merging.
   - Do not omit the recorder section just because tests already passed — a passed test run without recorder output is still incomplete for this skill.
   - Keep the demo fail-fast. If login, seeding, or the CA route is broken, stop at the blocker and report it instead of faking success.

7. Report concrete evidence. Always output these four lines in this exact wording, each with concrete evidence beneath it:
   - `did any test fail - if so why`
   - `are there any merge conflict were they resolved`
   - `is it safe to merge or i should check anything else`
   - `recorder video as in chat video window`

   For test failures, name the exact command and the first useful error. For merge conflicts, say `none`, `present and resolved`, or `present and unresolved`. For merge safety, say whether it is safe to merge, blocked, stale, or needs a specific extra manual check. For recorder output, always include either an inline embedded video plus direct path, or the exact recorder blocker, the command attempted, and any partial artifact path. Do not write that no video was produced merely because the recorder path was not invoked — this skill must invoke it.
