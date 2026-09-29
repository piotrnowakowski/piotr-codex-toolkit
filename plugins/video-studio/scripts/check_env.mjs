#!/usr/bin/env node
// Preflight for a music-video-brief project.
//   node check_env.mjs [--engine=p5|hyperframes|hybrid] [--tier=A|B|C] [--song=assets/song.mp3]
// Checks tools on PATH, Chrome, API key env vars (presence only; values are never printed), and the audio file.
// Audio is optional: a missing song is only an error when --song is passed explicitly.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const tier = String(args.tier || 'A').toUpperCase();
const engine = String(args.engine || 'p5').toLowerCase();
const usesP5 = engine === 'p5' || engine === 'hybrid';
const usesHF = engine === 'hyperframes' || engine === 'hybrid';
const songRequired = typeof args.song === 'string';
const song = songRequired ? args.song : ['assets/song.mp3', 'assets/song.wav'].find(p => existsSync(p));
let failed = 0;

const ok = (m) => console.log('  \u2713 ' + m);
const bad = (m, fix) => { failed++; console.log('  \u2717 ' + m + (fix ? `\n      fix: ${fix}` : '')); };
const warn = (m) => console.log('  ! ' + m);

function version(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')[0].trim(); }
  catch { return null; }
}

console.log(`video-studio preflight (engine ${engine}, tier ${tier})\n`);

console.log('Core tools');
const node = process.versions.node, needNode = usesHF ? 22 : 20;
+node.split('.')[0] >= needNode ? ok(`node ${node}`) : bad(`node ${node} (need >= ${needNode})`, 'install Node.js LTS');
for (const [cmd, fix] of [['git --version', 'install Git'], ['ffmpeg -version', 'winget install Gyan.FFmpeg | brew install ffmpeg | apt install ffmpeg'], ['ffprobe -version', 'comes with ffmpeg']]) {
  const v = version(cmd); v ? ok(v) : bad(cmd.split(' ')[0] + ' not found', fix);
}
const chromePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = chromePaths.find(p => existsSync(p));
chrome ? ok(`chrome at ${chrome}`) : bad('Chrome not found', 'install Google Chrome or set CHROME_PATH');
const claudeV = version('claude --version'), codexV = version('codex --version');
claudeV && ok('claude code ' + claudeV);
codexV && ok(codexV);
!claudeV && !codexV && warn('neither claude nor codex CLI on PATH (fine if you use a desktop/IDE app)');

console.log('\nProject');
if (usesP5) {
  existsSync('ANIMATION_GUIDE.md') && existsSync('render.mjs') ? ok('looks like a ClaudeAnimationBase project') : warn('ANIMATION_GUIDE.md / render.mjs not in cwd; clone https://github.com/JohnHeibel/ClaudeAnimationBase');
  existsSync('node_modules/p5.brush') ? ok('p5.brush installed') : warn('node_modules missing; run npm install');
  existsSync('reference/PDoomVideo') ? ok('reference/PDoomVideo present') : warn('optional: git clone https://github.com/JohnHeibel/PDoomVideo reference/PDoomVideo');
}
if (usesHF) {
  version('npm view hyperframes version') ? ok('hyperframes on npm reachable (npx hyperframes init / render)') : warn('could not reach npm for hyperframes; check network');
  const inClaude = claudeV && /hyperframes/i.test(execSafe('claude plugin list'));
  const inCodex = codexV && /hyperframes/i.test(execSafe('codex plugin list'));
  inClaude && ok('hyperframes plugin installed in Claude Code');
  inCodex && ok('hyperframes plugin installed in Codex');
  if (claudeV && !inClaude) warn('Claude Code: claude plugin marketplace add heygen-com/hyperframes && claude plugin install hyperframes@hyperframes');
  if (codexV && !inCodex) warn('Codex: codex plugin marketplace add heygen-com/hyperframes && codex plugin add hyperframes@hyperframes');
}

console.log('\nAudio (optional)');
if (song && existsSync(song)) {
  const dur = version(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${song}"`);
  ok(`audio ${song}${dur ? ` (${(+dur).toFixed(1)} s)` : ''}`);
} else if (songRequired) bad(`audio not found at ${song}`, 'copy your audio there, or drop --song if the video has no music');
else warn('no audio at assets/song.mp3|wav (fine if the brief uses no music, composed-in-code music, or you add the song later)');

function execSafe(cmd) { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } }

if (tier === 'B' || tier === 'C') {
  console.log('\nGeneration APIs');
  process.env.FAL_KEY ? ok('FAL_KEY is set') : bad('FAL_KEY not set', 'get a key at https://fal.ai/dashboard/keys and set it as an env var');
  process.env.ELEVENLABS_API_KEY ? ok('ELEVENLABS_API_KEY is set') : warn('ELEVENLABS_API_KEY not set (only needed for sound design)');
  existsSync('node_modules/@fal-ai/client') ? ok('@fal-ai/client installed') : warn('npm i @fal-ai/client');
  version('yt-dlp --version') ? ok('yt-dlp available') : warn('optional: yt-dlp for pulling reference videos');
}

console.log(failed ? `\n${failed} blocking issue(s).` : '\nReady. Paste the brief into Claude Code or Codex from this folder.');
process.exit(failed ? 1 : 0);
