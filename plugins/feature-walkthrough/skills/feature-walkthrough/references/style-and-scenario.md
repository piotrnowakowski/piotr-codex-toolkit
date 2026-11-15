# Lease-report presentation style

The reference is a six-minute Vite lease-report walkthrough recorded on 11 November 2026: silent real-app footage, captions below the app, highlighted controls, source review and Word export. This package describes the presentation without bundling private footage, input documents or generated reports. An original recording is not required to use the skill. Historical statuses/findings are not current product requirements.

## Commentary

Dark navy strip, white text, amber step label; green for tips, blue for waiting. Move the visible amber cursor to the target and frame it before clicking. Hold the frame while explaining. Preserve a readable app view; no marketing transitions or unrequested music.

Shape: outcome and compact overview, numbered feature-specific actions, visible result and how to check it, output, relevant tips. A small feature may need 45–90 seconds; a longer workflow 3–7 minutes. Do not force the original duration or five steps.

Each caption makes one point, usually 12–28 words; split long text. Explain what to do and why, then the observed result. Use exact UI labels. Patterns, only when supported by the actual feature:

- `Welcome`: “This guide shows how to turn a lease into a report, check its answers against the source, and download a Word copy.”
- `Step 1 · Add your file`: “Choose the document you want to work with. Click its name to check that you have the right version.”
- `Step 2 · Review`: “The counter shows how many answers you have reviewed. Open an answer's sources before marking it reviewed.”
- `Please wait`: “The report is being prepared. This takes a few minutes, so we will skip the waiting time.”
- `Tip`: “If a detail is missing, ask for the source document before relying on that answer.”

Do not infer expected waits from an old recording. Describe limitations candidly, only after observing them. In the original film two captions were corrected because they claimed highlights absent on screen: check words against footage.

## Runtime API

The recorder loads your exported scenario with Playwright `page`, `context`, `outDir`, `rehearsal` and `guide`:

- `say(label, text, {kind, ms} = {})`: append caption and hold for reading; kind is `step`, `tip` or `wait`. The strip is composed after capture, not visible in the live browser.
- `explain(locator, label, text, options)`: cursor, frame and explanation; fail if target is not visible. Use unique locators.
- `click(locator)`: cursor, frame, real click.
- `waitFor(label, text, asyncOperation)`: show a readable wait caption, then mark idle time for cutting. Assert the real completed state inside the operation. If it fails, the waiting time remains visible.
- `finding(message)`: log an observed issue at raw time; root cause needs separate evidence.

Use role/label/test-ID locators, normal inputs and assertions. For downloads, start `page.waitForEvent('download')` before the click, save under outDir and inspect the actual result. Never replace it with manufactured output HTML.

Illustrative fragment (adapt the controls and prerequisites):

```javascript
module.exports = async ({ page, guide, rehearsal }) => {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  const open = page.getByRole('button', { name: 'Create report', exact: true });
  await guide.say('Welcome', 'This guide shows how to create a report and check the result.');
  await guide.explain(open, 'Step 1 · Start', 'Choose Create report to open the report settings.');
  if (rehearsal) return; // Explicitly stop before the generation action.
  await guide.click(open);
  await guide.waitFor('Please wait', 'The report is being prepared. We will skip the waiting time.', async () => {
    await page.getByRole('heading', { name: 'Your report', exact: true }).waitFor({ timeout: 180000 });
  });
  await guide.say('Step 2 · Review', 'The report is ready. Check its contents before using or sharing it.');
  // Continue with the actual review/export actions and terminal assertions.
};
```

## Windows commands

Use discovered paths, PowerShell 7 non-login, UTF-8 and a new capture directory per take. Example:

```powershell
$skillDir = '<installed feature-walkthrough skill directory>'
$runDir = 'C:\path\to\repo\output\browser-demo-recording\feature-20261115-120000'
$env:PLAYWRIGHT_MODULE = 'C:\discovered\tools\node_modules\playwright'
$env:TARGET_URL = 'http://localhost:5173'
node "$skillDir\scripts\record.cjs" "$runDir\scenario.cjs" "$runDir\capture"
# Check exit status/events. Failed recordings are partial evidence.
node "$skillDir\scripts\render.cjs" "$runDir\capture\events.json"
ffprobe -v error -show_entries format=duration,size:stream=width,height -of json "$runDir\capture\walkthrough.mp4"
ffmpeg -v error -i "$runDir\capture\walkthrough.mp4" -f null -
```

Optional: `GUIDE_SPEED` (default 1.15), `GUIDE_HEADED=1`, `GUIDE_REHEARSAL=1`. Rehearsal does not technically block network calls; author the stopping point deliberately and label its metadata as rehearsal.

For multi_doc_query follow current AGENTS.md: frontend port 5173, ask before stopping another app using that port, and AUTH_REQUIRED=false only in the local main backend/converter when auth is not under test. Do not apply this app's settings to unrelated projects.
