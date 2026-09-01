# CityCatalyst inventory demo report

Save the completed report beside the run artifacts as `demo-audit.md`. Use this structure as a coverage checklist and keep every claim tied to current-run evidence.

```markdown
# CityCatalyst inventory demo: <city>, <year>

## Executive outcome

- **Result:** <Passed | Failed | Blocked>
- **City:** <exact city>, <country>
- **Inventory:** <year> · GPC Basic · AR6
- **Recorded environment:** <base URL and non-secret database/container identity>
- **Terminal state:** <last verified user-visible state>
- **Confidence:** <High | Medium | Low> — <reason>

## Setup and authorization

- **Account source:** <DEMO_EMAIL environment | established local default | E2E fixture>
- **Credentials printed or recorded:** No
- **CityCatalyst process:** <reused | started by launcher>
- **Climate Advisor process:** <container name | supplied log source | unknown>
- **Cleanup decision:** <unnecessary | proposed but not authorized | explicitly approved and completed | safely refused>
- **Cleanup evidence:** <cleanup-proposal.json or reason none was created>

## Journey scorecard

1. **Preflight — <Pass | Partial | Fail | Blocked>**
   - Expected: authentication, onboarding, route warm-up, and environment checks succeed without mutation.
   - Observed: <result>
   - Evidence: <preflight/checkpoint path>

2. **City creation — <status>**
   - Selected city: <exact visible city and country>
   - Evidence: <video timecode/checkpoint>

3. **Inventory creation — <status>**
   - Selected year: <year>
   - Selection reason: <explicit unused year | first unused ranked year | explicitly approved verified cleanup>
   - Methodology: GPC Basic
   - GWP: AR6
   - Evidence: <video timecode/checkpoint>

4. **Third-party data — <status>**
   - Source state: <connected source | visible no-data state | failed>
   - Response evidence: <connect-all status and source errors>
   - Evidence: <video timecode/checkpoint>

5. **Manual data — <status>**
   - Subsector/input summary: <values that are safe to report>
   - Submission evidence: <response status and visible result>
   - Evidence: <video timecode/checkpoint>

6. **Clima — <status>**
   - Exact question: `What is the difference between GPC and GPC+? Explain it to me in easy language.`
   - Visible answer: <concise answer or exact failure>
   - Completion evidence: <complete response, enabled input, restored Send control>
   - Request timing: <thread/token/message/export timing when available>
   - Evidence: <video timecode/checkpoint>

7. **Results — <status>**
   - Visible result: <widget/chart/table>
   - Evidence: <video timecode/checkpoint>

8. **CSV export — <Pass | Fail | Skipped>**
   - Requested: <Yes | No>
   - Validation: <nonempty header plus data row | failure | skipped>
   - Evidence: <path/timecode>

## What worked

- [<MM:SS>] <specific user-visible success>

## What did not work

- [<MM:SS>] **<step> — <short title>**
  - Observed: <what happened>
  - Expected: <what should have happened>
  - Impact: <what the demo could not prove or complete>
  - Evidence: <video, checkpoint, response, or runtime error reference>

## CityCatalyst runtime errors

- **Log coverage:** <Captured | Unavailable>
- **Sources:** <launcher stdout/stderr or supplied paths>
- **Sanitized complete log:** <cc-runtime.log or unavailable>
- **Observed error occurrences:** <count or unknown when unavailable>

For every captured occurrence:

### CC-001 — <timestamp or no timestamp>

- **Message:** <sanitized error line>
- **Context:** <relevant surrounding lines>
- **Correlated demo step/timecode:** <step and MM:SS, or no correlation established>
- **User-visible effect:** <effect or none observed>
- **Classification:** <Product failure | Diagnostic only | Setup noise | Unknown>

If captured with zero matches, say:
`No error-pattern lines were observed in the captured CityCatalyst log window.`

If unavailable, say:
`CityCatalyst logs were unavailable; this must not be interpreted as zero errors.`

## Climate Advisor runtime errors

- **Log coverage:** <Captured | Unavailable>
- **Sources:** <Docker container or supplied paths>
- **Sanitized complete log:** <ca-runtime.log or unavailable>
- **Observed error occurrences:** <count or unknown when unavailable>

For every captured occurrence:

### CA-001 — <timestamp or no timestamp>

- **Message:** <sanitized error line>
- **Context:** <relevant surrounding lines>
- **Correlated demo step/timecode:** <step and MM:SS, or no correlation established>
- **User-visible effect:** <effect or none observed>
- **Classification:** <Product failure | Diagnostic only | Setup noise | Unknown>

If captured with zero matches, say:
`No error-pattern lines were observed in the captured Climate Advisor log window.`

If unavailable, say:
`Climate Advisor logs were unavailable; this must not be interpreted as zero errors.`

## Browser and request observations

- [<MM:SS>] <console error, page exception, or failed request>
  - User-visible effect: <effect or none observed>
  - Related runtime error: <CC-xxx | CA-xxx | none established>

Do not duplicate the same event as multiple product findings. Preserve every raw occurrence in `runtime-errors.md`, then explain correlation here.

## Artifact verification

- **Video:** <absolute path> — <duration>, <bytes>
- **Recorder metadata:** <absolute path> — `ok: <true|false>`
- **Preflight:** <absolute path>
- **Flow report:** <absolute path>
- **Checkpoints:** <absolute path>
- **Verification:** <absolute path>
- **Runtime error index:** <runtime-errors.json>
- **Runtime error report:** <runtime-errors.md>
- **CC sanitized log:** <cc-runtime.log or unavailable>
- **CA sanitized log:** <ca-runtime.log or unavailable>
- **Preview frame:** <absolute path and inspected timestamp>
- **CSV:** <absolute path or skipped>

## Coverage limitations

- <logs unavailable, third-party data absent, role/device not tested, external service unavailable, or other boundary>

## Final assessment

- **Core demo:** <Passed | Failed | Blocked>
- **Highest-impact failure:** <failure or none>
- **Runtime errors observed:** <CC count/coverage and CA count/coverage>
- **What must change before the next demo:** <smallest observable exit criteria>
```

## Error-reporting rules

- Include every captured CC and CA error occurrence.
- Byte-identical repeated errors may be grouped in the chat summary only when the exact count and first/last timestamp are stated.
- Keep the full occurrence-by-occurrence listing in `runtime-errors.md`.
- Never expose credentials or unredacted connection strings.
- Do not infer a root cause from temporal proximity alone.
- Do not call unavailable logs clean.
- Keep browser observations separate from server-log errors, then state any evidence-backed correlation.
