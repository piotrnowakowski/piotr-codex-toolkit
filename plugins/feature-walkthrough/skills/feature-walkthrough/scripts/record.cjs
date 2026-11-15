#!/usr/bin/env node
// Capture one take; compose the commentary outside the app with render.cjs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');

function safe(text) {
  return String(text).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|client_secret|api_key|access_token|authorization|token)\s*[=:]\s*)[^\s,;&}]+/gi, '$1[REDACTED]').slice(0, 3000);
}

// Playwright: workspace -> PLAYWRIGHT_MODULE -> shared cache (npm i --prefix <cache> playwright).
function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(path.resolve(process.env.PLAYWRIGHT_MODULE));
  const cache = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'agent-tools', 'playwright');
  for (const base of [process.cwd(), cache]) {
    try { return createRequire(path.join(base, 'package.json'))('playwright'); } catch {}
  }
  throw new Error(`Playwright not found. Install once: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix ${cache} playwright`);
}

// System Chromium skips Playwright browser downloads (Omarchy: chromium, Fedora: chromium-browser).
function systemChromium() {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, process.env.CHROME_PATH, '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'];
  return candidates.find(p => p && fs.existsSync(p));
}

async function main() {
  const [scenarioArg, outArg] = process.argv.slice(2);
  if (!scenarioArg || !outArg) throw new Error('Usage: node record.cjs <scenario.cjs> <new-capture-directory>');
  const scenario = require(path.resolve(scenarioArg));
  if (typeof scenario !== 'function') throw new Error('Scenario must export an async function');
  const speed = Number(process.env.GUIDE_SPEED || 1.15);
  if (!Number.isFinite(speed) || speed <= 0 || speed > 3) throw new Error('GUIDE_SPEED must be > 0 and <= 3');
  const { chromium } = loadPlaywright();
  const outDir = path.resolve(outArg);
  fs.mkdirSync(outDir); // Refuse to overwrite a take or its raw evidence.
  const headless = process.env.GUIDE_HEADED !== '1';
  const browser = await chromium.launch({ headless, executablePath: systemChromium(),
    args: !headless && process.env.WAYLAND_DISPLAY ? ['--ozone-platform-hint=auto'] : [] });
  let context, page, failure;
  const events = [];
  const evidence = { ok: false, rehearsal: process.env.GUIDE_REHEARSAL === '1', speed, width: 1440, height: 792, barHeight: 108, events };
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 792 }, acceptDownloads: true,
      recordVideo: { dir: path.join(outDir, 'raw'), size: { width: 1440, height: 792 } } });
    page = await context.newPage();
    const start = performance.now();
    evidence.startedAt = new Date().toISOString();
    const log = (kind, value) => events.push({ t: +((performance.now() - start) / 1000).toFixed(3), kind, ...value });
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => log('pageerror', { message: safe(e.message) }));
    page.on('console', m => { if (m.type() === 'error') log('console-error', { message: safe(m.text()) }); });
    page.on('response', r => { if (r.status() >= 400) log('http', { status: r.status(), url: r.url().split(/[?#]/)[0] }); });
    page.on('requestfailed', r => log('requestfailed', { url: r.url().split(/[?#]/)[0], message: safe(r.failure()?.errorText) }));
    const say = async (label, text, { kind = 'step', ms } = {}) => {
      log('caption', { label: safe(label), text: safe(text), tone: kind });
      const hold = ms ?? Math.max(3800, text.trim().split(/\s+/).length * 330 + 1500) * speed;
      if (!Number.isFinite(hold) || hold < 0) throw new Error('Caption hold must be a nonnegative number');
      await page.waitForTimeout(hold);
    };
    const point = async locator => {
      await locator.waitFor({ state: 'visible' });
      await locator.scrollIntoViewIfNeeded();
      await locator.evaluate(el => {
        document.querySelectorAll('[data-walkthrough-aid]').forEach(n => n.remove());
        const b = el.getBoundingClientRect();
        const parent = el.closest('dialog, [popover]:popover-open') || document.documentElement;
        const ring = document.createElement('div');
        ring.dataset.walkthroughAid = 'ring';
        ring.setAttribute('aria-hidden', 'true');
        Object.assign(ring.style, { position: 'fixed', left: `${b.x - 4}px`, top: `${b.y - 4}px`, width: `${b.width + 8}px`,
          height: `${b.height + 8}px`, border: '4px solid #f59e0b', borderRadius: '6px', boxSizing: 'border-box',
          pointerEvents: 'none', zIndex: '2147483647' });
        const cursor = document.createElement('div');
        cursor.dataset.walkthroughAid = 'cursor';
        cursor.setAttribute('aria-hidden', 'true');
        Object.assign(cursor.style, { position: 'fixed', left: `${b.x + b.width / 2 - 13}px`, top: `${b.y + b.height / 2 - 13}px`,
          width: '26px', height: '26px', borderRadius: '50%', background: '#f59e0b55', border: '3px solid #f59e0b',
          pointerEvents: 'none', zIndex: '2147483647' });
        parent.append(ring, cursor);
      });
      await page.waitForTimeout(650);
    };
    const clear = () => page.evaluate(() => document.querySelectorAll('[data-walkthrough-aid="ring"]').forEach(n => n.remove())).catch(() => {});
    const guide = {
      say,
      explain: async (locator, label, text, options) => { await point(locator); try { await say(label, text, options); } finally { await clear(); } },
      click: async locator => { await point(locator); try { await locator.click(); } finally { await clear(); } },
      waitFor: async (label, text, operation) => {
        await say(label, text, { kind: 'wait' });
        const begin = (performance.now() - start) / 1000;
        await operation(); // Preserve failed waits instead of hiding an error behind a cut.
        const end = (performance.now() - start) / 1000;
        if (end - begin > 2) log('cut', { from: begin + 0.5, to: end - 0.5 });
      },
      finding: message => log('finding', { message: safe(message) }),
    };
    await scenario({ page, context, guide, outDir, rehearsal: evidence.rehearsal });
    await page.waitForTimeout(1000);
    evidence.ok = true;
  } catch (e) {
    failure = e;
    evidence.error = safe(e.message);
    if (page) await page.waitForTimeout(1500).catch(() => {});
  } finally {
    if (context) await context.close();
    if (page?.video()) evidence.video = await page.video().path();
    await browser.close();
    fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({ ok: evidence.ok, rehearsal: evidence.rehearsal, events: path.join(outDir, 'events.json'), error: evidence.error || null }));
  if (failure) process.exitCode = 2;
}
main().catch(e => { console.error(safe(e.message)); process.exitCode = 1; });
