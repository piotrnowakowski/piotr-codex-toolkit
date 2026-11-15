---
name: "citycatalyst-deployed-feature-test-demo"
description: "Plan, and only after explicit approval, record a real authenticated browser test of an already merged and deployed CityCatalyst feature on the dev server. CityCatalyst-repo specific; requires a reviewed guide before any recording."
---

# CityCatalyst Deployed Feature Test Demo

Create a reviewable test contract before touching the deployed feature, then record exactly the approved contract with the real stack.

## CityCatalyst environment

- The default development server is `https://citycatalyst.openearth.dev/`.
- When the user says `dev`, `development`, or `dev server` without naming another endpoint, use that URL.
- Revalidate the URL and deployed revision before testing. Do not silently substitute localhost, production, or another CityCatalyst environment.
- Use a different environment only when the user explicitly selects it.

## Required two-phase gate

Never combine planning and recording in the same turn.

### Phase 1: plan and stop

1. Identify the feature, merged PR or revision, target dev environment, and intended user-visible behavior. Use read-only repository and GitHub evidence to verify that the feature is merged and that the corresponding deployment completed. Clearly mark anything that cannot be verified.
2. Inspect the deployed implementation and existing tests closely enough to design realistic coverage. Do not open an authenticated product session, create test data, invoke an LLM, call product tools, or start recording in this phase.
3. Write a detailed guide using the template below. Save it under the repository's ignored `output/browser-demo-recording/` directory with a feature-specific name.
4. Include the exact user journey, preconditions, safe test data, expected UI and persisted outcomes, relevant requests or events, real LLM or tool calls, exact prompts where applicable, failure and recovery coverage, evidence to capture, cleanup boundaries, and what will remain untested.
5. Surface the complete guide to the user in the final response and link the saved file. End the turn with one clear approval request. Do not begin testing or recording.

If the deployment is not proven current, still provide the guide when useful, label the deployment check as a blocker, and stop.

### Testing guide template

```markdown
## Feature and deployment evidence
- Feature and user promise
- Merged PR or revision
- Target dev URL and environment; default to https://citycatalyst.openearth.dev/ unless explicitly overridden
- Deployment workflow or runtime evidence
- Known flags, permissions, dependencies, or data prerequisites
- Confidence and unresolved deployment questions

## Test objective and acceptance criteria
State the user-visible outcome in plain language. List concrete pass criteria, including persisted or backend outcomes when the feature promises them.

## Account, test data, and safety
- Persona and required permissions
- Credential key names only; never include values
- Existing versus disposable test data
- Allowed mutations and prohibited/destructive actions
- Cleanup proposal, with any separately authorized cleanup clearly identified
- Expected model or tool quota usage

## Approved journey candidate
| Step | User action | Real integration exercised | Expected UI result | Expected backend/persisted result | Evidence to capture |
|---|---|---|---|---|---|

Make each action deterministic enough to record. Include navigation, authentication state, inputs, waits, success criteria, and recovery behavior. Do not invent selectors or data that have not been verified.

## Real model and tool calls
For each required LLM/product-tool interaction, specify: the exact prompt or input; the model/tool behavior being exercised; the observable streaming, tool-event, or result evidence; the bounded success criteria (without requiring a fixed prose answer from a nondeterministic model); expected cost/quota scope; the fallback outcome if the service is unavailable. If none is needed, explain why.

## Negative and recovery coverage
Include only paths material to the feature: validation, failure messaging, retry/reload/resume, persistence after refresh, or permission boundaries. Keep destructive and production-only cases out of scope unless separately authorized.

## Recording and evidence plan
- Proposed recording name and approximate duration
- Important controls to highlight
- Assertions to verify before moving to the next step
- Network, console, persisted-state, or API evidence to capture
- Sensitive information that must remain off-screen
- Required report artifacts and representative frame

## Blockers and exclusions
List unverified assumptions, unavailable services or data, and explicitly untested behavior. Do not turn an exclusion into an implied pass.

## Approval gate
End with: "Approve this exact guide for recording, or send edits. Recording will not start until you explicitly approve or ask me to proceed with your revisions."
```

### Approval and revisions

- Start phase 2 only after the user explicitly approves the guide or supplies changes and explicitly asks to proceed.
- If the user supplies edits without authorization to proceed, revise and re-surface the guide, then stop again.
- Treat the approved guide as the recording contract. Do not silently add journeys, accounts, destructive cleanup, production writes, or broader assertions.
- If a material change becomes necessary during setup or testing, stop and ask the user to approve the revised guide.

### Phase 2: execute and record

1. Revalidate the deployed revision and `https://citycatalyst.openearth.dev/` immediately before testing, unless the approved guide explicitly selected another environment.
2. Follow the `browser-demo-recorder` skill completely — its recorder mechanics, artifact layout, verification steps, and detailed report format all apply here.
3. Exercise the real deployed stack. Do not mock authentication, product APIs, model outputs, tool calls, data, or persisted results unless the approved guide explicitly calls for a mock demonstration.
4. Execute the approved scenario in order. Preserve exact prompts and summarize observed model or tool results. Treat nondeterministic output as an observation, not as a fabricated pass.
5. Record failures truthfully. Retry only after identifying and correcting a non-product setup or locator problem; do not rerun to hide a reproducible defect.
6. Deliver the verified recording, metadata, representative frame, and detailed outcome report. Compare completed coverage against every guide step and name anything incomplete or changed.

## Local dev credentials

For this CityCatalyst workspace, credentials are stored only in the ignored repository-root `.env` under these keys: `CITYCATALYST_DEV_EMAIL`, `CITYCATALYST_DEV_PASSWORD`.

Before phase 2, confirm the `.env` is ignored and both keys are present without printing their values. Read only these keys; do not source or log the entire file. Never copy secret values into the skill, scenario, report, command output, metadata, screenshots, or video.

Authenticate during an unrecorded preflight and reuse an ignored Playwright storage-state artifact for the final take when feasible. If the final recording cannot avoid showing the login identifier or another secret, stop and report the blocker instead of delivering a leaking video.

## Safety and evidence boundaries

- Default to `https://citycatalyst.openearth.dev/`, never production, unless the user explicitly selects another environment.
- Ordinary, clearly disposable dev test data is allowed after guide approval. Deletion, bulk mutation, external messaging, billing, or irreversible actions require separate explicit authorization.
- Model and tool calls may consume quota. Keep them to the smallest set needed by the approved guide and state that scope before execution.
- A passing UI state is not enough when the feature promises persisted or backend behavior; verify the corresponding observable server-side outcome when the approved guide includes it.
- Do not claim a scenario passed unless both the recording evidence and expected outcome support it.
