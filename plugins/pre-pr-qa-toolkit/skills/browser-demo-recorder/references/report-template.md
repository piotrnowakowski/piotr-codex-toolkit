# Browser recording report structure

Use this as a coverage and evidence template, not as mandatory prose. Save the completed report beside the recording as `<name>-report.md`.

## Outcome definitions

- **Passed**: every requested user-visible step completed and the terminal state was verified.
- **Partial**: the primary flow completed, but a secondary or optional step was incomplete or unavailable.
- **Failed**: a required product step produced an incorrect result, error, or unusable terminal state.
- **Blocked**: environment, access, tooling, CAPTCHA, unavailable data, or another external prerequisite prevented a fair product determination.

Do not use **Passed** when recorder metadata reports `ok: false`, a required step was skipped, or the terminal result was not verified.

## Standard report

Use this structure for a straightforward walkthrough:

```markdown
# Browser recording: <flow name>

## Executive outcome

- **Result:** <Passed | Partial | Failed | Blocked>
- **Recorded scope:** <one-sentence flow boundary>
- **Environment:** <local/deployed URL, branch or revision when relevant, browser and viewport>
- **Persona and starting state:** <account type, fixture/data state, prerequisites>
- **Terminal state:** <what the recording visibly ends on>
- **Confidence:** <High | Medium | Low> — <reason>

## Journey

1. **<step name> — <Pass | Partial | Fail | Blocked | Skipped>**
   - User action: <what was done>
   - Expected: <observable expectation>
   - Observed: <observable result>
   - Evidence: <MM:SS and optional screenshot/artifact>

## What worked

- [<MM:SS when useful>] <verified user-visible success and why it matters>

## Needs work

- [<MM:SS>] **<P0-P3> — <short outcome-oriented title>**
  - Observed: <what happened>
  - Expected: <what should have happened>
  - Impact: <user or operational consequence>

If none were observed: `No user-visible issue observed in the recorded scope.`

## Crashed or broke

- [<MM:SS>] <crash, uncaught exception, or failed request that affected the flow>

If none occurred: `No crash observed.`

## Struggles, blockers, and setup limitations

- [<MM:SS when visible>] <coverage limitation and what it prevented>

If none occurred: `No blocker observed.`

## Prompts and observed results

Include only for chat, search, or generated content.

- **Prompt/query:** `<exact user text>`
- **Visible result:** <concise factual summary>
- **Completion evidence:** <terminal UI state, restored controls, citations or outputs>
- **Issue:** <none or observed problem with timecode>

## Artifacts and verification

- **Video:** <absolute path> — <duration>, <size>
- **Recorder metadata:** <absolute path> — `ok: <true|false>`
- **Findings:** <absolute path>
- **Report:** <absolute path>
- **Preview frame:** <absolute path> — inspected at <MM:SS>
- **Scenario:** <absolute path>

## Not tested

- <important boundary, device, role, state, or downstream effect outside this recording>

## Merge verdict

Include only when PR or branch readiness was requested.

- **Recorded flow:** <Passed | Partial | Failed | Blocked>
- **Broader evidence:** <tests, checks, conflicts, or reviews considered outside the video>
- **Verdict:** <Safe to merge | Needs one specific check | Not safe to merge | Insufficient evidence>
- **Remaining risk:** <specific caveat>
```

## Detailed audit report

For exploratory QA, bug reproduction, feature audits, or PR readiness, extend the standard report with the following sections.

### Coverage matrix

Record which relevant categories were exercised:

- primary happy path;
- empty or missing-prerequisite state;
- invalid input and validation recovery;
- cancel, retry, duplicate submission, and idempotency;
- reload persistence and interrupted-session recovery;
- stale state after editing;
- boundary-value or conflicting data;
- desktop and phone-sized responsive behavior;
- keyboard navigation, focus, names, and visible accessibility risks;
- loading, latency, redirects, console failures, and failed requests;
- downloads, exports, emails, or other terminal artifacts.

Mark categories as `Pass`, `Partial`, `Fail`, `Blocked`, `Skipped`, or `Not applicable`. Explain every `Blocked` or `Skipped` category.

### Prioritized findings

Use one section per distinct finding:

```markdown
### F01 — <P0 | P1 | P2 | P3> — <outcome-oriented title>

- **Category:** <Product defect | Usability | Accessibility | Performance | Reliability | Regression coverage>
- **First visible at:** <MM:SS>
- **Journey step:** <step name>
- **User goal:** <what the user was trying to accomplish>
- **Preconditions:** <account, data, viewport, or state>
- **Reproduction:**
  1. <exact action>
  2. <exact action>
  3. <exact action>
- **Observed:** <specific visible behavior>
- **Expected:** <specific observable result>
- **Impact:** <who is affected and practical consequence>
- **Evidence:** <video timecode, screenshot, console/network observation, output artifact>
- **Frequency:** <Always | Intermittent | Observed once>
- **Confidence:** <High | Medium | Low> — <reason>
- **Likely cause:** <hypothesis or `Not established from browser evidence`>
- **Exit criterion:** <smallest observable condition that proves the issue resolved>
```

Severity meanings:

- **P0**: destructive behavior, critical security exposure, or complete failure of a release-critical journey;
- **P1**: core journey failure with no reasonable workaround;
- **P2**: meaningful correctness, usability, accessibility, performance, or reliability issue with a workaround;
- **P3**: limited friction or polish issue that does not block completion.

Do not inflate severity or split one root problem into duplicate findings.

### Technical observations

Keep raw technical signals separate from validated product findings:

```markdown
## Console and network observations

- [<MM:SS>] **<console | page error | HTTP status>**
  - Signal: <sanitized message or method/path/status>
  - User-visible effect: <effect or `None observed`>
  - Classification: <Finding Fxx | Setup noise | Diagnostic only>
```

A console warning or failed request is not automatically a product defect. Promote it to a finding only when there is user-visible impact or a clear reliability consequence.

### Performance observations

When latency matters, record observable timings:

- navigation or route transition;
- time to first visible response;
- time to complete response;
- time until controls are usable again;
- download or export completion.

Label timings as approximate unless measured directly.

### Accessibility observations

Report only what was exercised or visibly observed:

- keyboard reachability and focus order;
- visible focus;
- accessible names and roles;
- error identification;
- contrast or overlap visible in screenshots;
- reduced-motion behavior when tested.

State the tooling and coverage limitations. Do not claim standards compliance from a short browser recording.

### Release assessment

End a detailed audit with:

- strongest verified behavior;
- highest-severity unresolved finding;
- blockers and untested risk;
- smallest pre-merge exit criteria;
- evidence that would change the verdict.

## Evidence discipline

- Put an approximate `MM:SS` timecode on every recorded issue, crash, and blocker.
- Use the first visible time when an issue spans a range, optionally adding `through MM:SS`.
- Link every finding to current-run evidence.
- Separate product defects from environment, test data, permissions, and recorder limitations.
- Describe likely causes as hypotheses unless code or logs establish them.
- State exactly what was not tested.
- Do not claim the whole branch is safe to merge from one successful recording.
