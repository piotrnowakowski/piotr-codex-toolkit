---
name: pre-pr-feature-audit
description: Run a critical, user-centered pre-PR audit of a branch in a real browser, record a reproducible walkthrough, test realistic success, failure, persistence, responsive, and export scenarios, and produce an evidence-backed GO/NO-GO report. Use when a user asks to test a branch as a user before a PR, requests a browser feature audit or real-world scenario testing, or asks for a critical QA report with multiple bugs or improvement areas. Do not use for code-only review, security audit, or requests that do not authorize real-browser testing.
---

# Pre-PR Feature Audit

Evaluate whether the changed feature works well for a real user. Treat code only as a source of scope and test setup; findings must be about observable product behavior.

Do not change product code, fix findings, create a PR, or mutate production data unless the user separately asks for that work.

## Browser trigger

For a runnable web feature, invocation of this skill from an explicit real-browser or user-journey audit request activates browser testing.

- Use the browser the user names.
- When the user names `browser-demo-recorder`, load and follow that skill.
- When no browser is named, use `browser-demo-recorder` and its Playwright Chromium workflow only if the request itself clearly asks for real-browser testing.
- Treat this as authorization for read-only local browser interaction and disposable local test data, not for production writes, external messages, or destructive cleanup.
- Capture screenshots during this run. Inspect representative screenshots rather than treating capture alone as verification.

## Supporting skills

Load and follow these core skills for every audit:

- `browser-demo-recorder` is required for the final reproducible walkthrough and time-linked evidence.
- `product-design:audit` is required for a screenshot-first UX, design, responsive, interaction, journey, and accessibility review. Integrate its accepted screenshots and step-linked findings into the final audit output.

If `product-design:audit` is unavailable, stop and identify the Product Design plugin as a required installation. Do not silently downgrade the audit.

Use these additional skills only when they match the tested behavior:

- `expect-browser-testing` is an optional independent browser pass when available. Bound the attempt; failure or stalling must not block a completed primary audit.
- `pdf:pdf` and `documents:documents` apply when the feature exports PDF or DOCX files. Inspect the downloaded artifact itself, not only the download event.

Announce each selected supporting skill and follow its instructions.

## Establish scope

1. Identify the current branch, base, working-tree state, repository instructions, and changed user-facing surface.
2. Preserve all pre-existing changes. Keep audit artifacts separate from product code.
3. Establish a realistic persona, goal, and minimum viable data state.
4. Start local services only when safe and necessary. Prefer reversible setup and deterministic local fixtures.
5. Create data through the UI when practical. If direct local seeding is needed to reach a state, disclose it and do not present setup artifacts as product defects.

Do not turn local-environment failures, unavailable credentials, or testing-tool failures into branch findings without evidence that an end user would encounter them.

## Required scenario coverage

Adapt the matrix to the feature, but cover every relevant category:

- primary happy path from entry point to meaningful completion;
- empty, incomplete, or missing-prerequisite state;
- invalid input and recoverable backend failure;
- cancel, close, retry, duplicate submission, and idempotency behavior;
- reload persistence and resume after interruption;
- stale state after editing previously validated or completed data;
- realistic conflicting, incomplete, and boundary-value data;
- desktop and phone-sized responsive behavior;
- keyboard focus, visible navigation, control naming, and obvious accessibility risks;
- console errors, failed requests, repeated polling, redirects, and visible latency;
- generated downloads, exports, emails, or other terminal artifacts;
- focused automated tests as supporting evidence, not as a substitute for user testing.

Use production-like data and wording. Prefer deterministic facts such as arithmetic mismatches, contradictory counts, missing required values, and changed revisions when evaluating AI-assisted behavior.

## Findings discipline

Aim for the number of findings the user requests; default to ten distinct issues or improvement areas for a “full critical report.” Never invent, duplicate, or inflate findings to hit a quota.

Each finding must include:

- severity (`P0` critical, `P1` high, `P2` medium, or `P3` low);
- journey step and user goal;
- exact reproduction steps;
- observed and expected behavior;
- user or operational impact;
- evidence path and video timecode when recorded;
- confidence and any environment limitation that affects interpretation.

Separate these categories clearly:

- product defects;
- usability or accessibility inconsistencies;
- performance or reliability improvements;
- broken regression coverage;
- audit blockers or tool limitations.

Do not report the same root problem multiple times unless it has independently different user consequences.

## Recording and evidence

Create the recorder scenario under `demo-recording/scenario.cjs` unless repository instructions require another audit-artifact location.

The final recording should:

- use a deterministic account and fixture;
- show the key entry state, the feature action, the failure or decision state, and the terminal result;
- use concise on-screen step labels that remain accurate for the recorded run;
- avoid secrets and irrelevant waiting where possible;
- be converted to MP4 when supported;
- be inspected through at least one representative extracted frame.

For every crash, blocker, or visible issue in the recording, include an approximate timecode in the report. Remove failed temporary takes after verifying the final video, while preserving the final MP4/WebM and evidence frames.

## Report and verdict

Before writing the report, read [references/report-template.md](references/report-template.md).

Write the full Markdown report under a clearly named audit artifact directory. The report must stand alone and include:

- branch and tested working-tree identity;
- GO, CONDITIONAL GO, or NO-GO recommendation;
- journey scorecard with strengths and failures;
- prioritized findings;
- accessibility risks and testing limits;
- what worked;
- automated-test results;
- concrete pre-PR exit criteria;
- paths to the report, screenshots, recording, scenario, and inspected exports.

A P0, an unresolved P1 in the core journey, corrupt or structurally incomplete terminal output, or materially unreliable readiness decision normally means NO-GO.

## Cleanup

Stop only services and containers created for the audit. Remove only verified audit temporaries and failed takes. Preserve the final report and evidence. Do not delete shared databases, user work, or pre-existing runtime processes.
