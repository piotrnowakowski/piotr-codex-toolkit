# Feature Audit Report Template

Use this structure as a coverage checklist, not as mandatory wording.

```markdown
# Pre-PR feature audit: <feature>

**Branch / working tree:** <identity>
**Audit date:** <date>
**Release recommendation:** <GO | CONDITIONAL GO | NO-GO>
**Scope:** End-user behavior; not a code review.

## Executive assessment

State whether the core journey works, the number and severity of findings, and the main release risk.

## Test approach

List browser/viewport, persona, realistic data, scenarios, artifact inspection, and supporting automated checks.

## Journey scorecard

1. **<step> — Pass | Partial | Fail**
   - Strength: <what worked>
   - Issue: <main defect>
   - Evidence: <screenshot and timecode>

## Findings

### F01 — P1 — <concise outcome-oriented title>

**Journey step:** <step>
**Reproduction:** <exact actions>
**Observed:** <result>
**Expected:** <result>
**Impact:** <user or operational consequence>
**Evidence:** <path/timecode>
**Confidence / limitation:** <if relevant>

## Accessibility risks

List only observed risks and state tooling limitations.

## What worked

Record successful behaviors so the report is diagnostically balanced.

## Verification

- Browser scenarios: <result>
- Automated tests: <result>
- Export/artifact inspection: <result>
- Independent pass: <result or blocker>

## Pre-PR exit criteria

List the smallest observable conditions required to change the verdict.

## Artifacts

- Report: <path>
- MP4/WebM: <path, duration, size>
- Screenshots: <path>
- Scenario: <path>
- Inspected outputs: <paths>

## Limitations

Separate environment and tool limitations from product findings.
```

## Quality checks

- Findings are distinct and evidence-backed.
- Screenshots come from the current run and are visually inspected.
- The report distinguishes setup failures from product failures.
- AI-output variability is supported by repeated identical inputs.
- Downloaded artifacts are opened or rendered when output quality matters.
- The verdict follows from severity and core-journey impact.
- The final response links the full report and embeds the verified recording.
