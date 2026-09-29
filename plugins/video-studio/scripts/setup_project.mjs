#!/usr/bin/env node
// Scaffold a video-studio project folder.
//   node setup_project.mjs --dir=<path> --engine=p5|hyperframes|hybrid [--tier=A|B|C]
//        [--song=<audio file>] [--brief=<music-video-brief.md>] [--resolution=landscape|portrait|square]
//        [--hf-example=blank] [--dry-run]
// Idempotent: existing clones / folders are kept, never overwritten.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
if (!args.dir) { console.error('usage: --dir=<path> --engine=p5|hyperframes|hybrid [--tier] [--song] [--brief]'); process.exit(2); }
const dir = resolve(String(args.dir));
const engine = String(args.engine || 'p5').toLowerCase();
const tier = String(args.tier || 'A').toUpperCase();
const res = String(args.resolution || 'landscape');
const dry = !!args['dry-run'];
const here = dirname(fileURLToPath(import.meta.url));

const run = (cmd, cwd = dir, env = {}) => {
  console.log(`$ ${cmd}${cwd !== dir ? `   (in ${cwd})` : ''}`);
  if (!dry) execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
};
const step = m => console.log(`\n== ${m}`);

if (!['p5', 'hyperframes', 'hybrid'].includes(engine)) { console.error('engine must be p5, hyperframes or hybrid'); process.exit(2); }

// --- base project
if (engine === 'p5' || engine === 'hybrid') {
  step('ClaudeAnimationBase (p5.brush engine)');
  if (existsSync(join(dir, 'ANIMATION_GUIDE.md'))) console.log('already cloned');
  else {
    if (existsSync(dir) && execSync(`node -e "process.stdout.write(String(require('fs').readdirSync(process.argv[1]).length))" "${dir}"`).toString() !== '0') {
      console.error(`${dir} exists and is not empty; pick a new --dir for a p5/hybrid project`); process.exit(1);
    }
    run(`git clone --depth 1 https://github.com/JohnHeibel/ClaudeAnimationBase "${dir}"`, process.cwd());
  }
  step('reference: PDoomVideo');
  if (existsSync(join(dir, 'reference/PDoomVideo'))) console.log('already present');
  else run(`git clone --depth 1 https://github.com/JohnHeibel/PDoomVideo reference/PDoomVideo`);
  step('npm install');
  existsSync(join(dir, 'node_modules/p5.brush')) ? console.log('already installed') : run('npm install');
}

const resFlag = { landscape: 'landscape', portrait: 'portrait', square: 'square', '1920x1080': 'landscape', '1080x1920': 'portrait', '1080x1080': 'square' }[res] || 'landscape';
const hfEnv = { HYPERFRAMES_SKIP_SKILLS: '1' }; // skills come from the HyperFrames agent plugin (Claude Code / Codex); don't install duplicates per project
if (engine === 'hyperframes') {
  step('HyperFrames project');
  if (existsSync(join(dir, 'hyperframes.json'))) console.log('already initialised');
  else {
    mkdirSync(dirname(dir), { recursive: true });
    run(`npx -y hyperframes@latest init "${dir}" --non-interactive --example=${args['hf-example'] || 'blank'} --resolution=${resFlag} --skip-transcribe`, dirname(dir), hfEnv);
  }
}
if (engine === 'hybrid') {
  step('HyperFrames final-cut project in cut/');
  if (existsSync(join(dir, 'cut/hyperframes.json'))) console.log('already initialised');
  else run(`npx -y hyperframes@latest init cut --non-interactive --example=${args['hf-example'] || 'blank'} --resolution=${resFlag} --skip-transcribe`, dir, hfEnv);
}

// --- folders
step('folders');
for (const d of ['assets', 'refs', 'out', ...(engine === 'hybrid' ? ['out/plates'] : []), ...(tier !== 'A' ? ['assets/gen'] : [])]) {
  const p = join(dir, d); if (!existsSync(p)) { console.log('mkdir ' + d); if (!dry) mkdirSync(p, { recursive: true }); }
}

// --- audio + brief
if (args.song) {
  step('audio');
  const src = resolve(String(args.song));
  if (!existsSync(src)) { console.error(`song not found: ${src}`); process.exit(1); }
  const dst = join(dir, 'assets', 'song' + extname(src).toLowerCase());
  console.log(`copy ${src} -> ${dst}`); if (!dry) copyFileSync(src, dst);
}
if (args.brief) {
  step('brief');
  const src = resolve(String(args.brief));
  if (!existsSync(src)) { console.error(`brief not found: ${src}`); process.exit(1); }
  const dst = join(dir, 'BRIEF.md');
  console.log(`copy ${src} -> ${dst}`); if (!dry) copyFileSync(src, dst);
}

// --- generation deps (tier B/C)
if (tier !== 'A') {
  step('generation clients');
  const pkg = join(engine === 'hyperframes' ? dir : dir, 'package.json');
  const has = n => existsSync(pkg) && readFileSync(pkg, 'utf8').includes(`"${n}"`);
  if (!existsSync(pkg)) run('npm init -y');
  has('@fal-ai/client') ? console.log('@fal-ai/client present') : run('npm i @fal-ai/client');
  if (process.env.ELEVENLABS_API_KEY) has('@elevenlabs/elevenlabs-js') ? console.log('elevenlabs present') : run('npm i @elevenlabs/elevenlabs-js');
}

// --- gitignore secrets and renders
step('.gitignore');
const gi = join(dir, '.gitignore');
const want = ['.env', 'out/', 'node_modules/'];
const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
const missing = want.filter(w => !cur.split(/\r?\n/).includes(w));
if (missing.length) { console.log('add ' + missing.join(', ')); if (!dry) appendFileSync(gi, (cur && !cur.endsWith('\n') ? '\n' : '') + missing.join('\n') + '\n'); }
else console.log('ok');

// --- preflight
step('preflight');
try { run(`node "${join(here, 'check_env.mjs')}" --engine=${engine} --tier=${tier}${args.song ? ` --song=assets/song${extname(String(args.song)).toLowerCase()}` : ''}`); }
catch { console.log('(preflight reported issues, see above)'); }

console.log(`\nProject ready at ${dir}`);
