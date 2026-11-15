#!/usr/bin/env node
// Preflight for a music-video-brief project.
//   node check_env.mjs [--engine=p5|hyperframes|hybrid] [--tier=A|B|C] [--song=assets/song.mp3]
// Checks tools on PATH, Chromium, API key env vars (presence only; values are never printed), and the audio file.
// Audio is optional: a missing song is only an error when --song is passed explicitly.
// Linux only (Omarchy/Arch, Fedora). All probes start at once and are reported in order.
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

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

const run = cmd => new Promise(res => exec(cmd, { timeout: 20000 }, (e, out) => res(e ? '' : String(out))));
const first = p => p.then(o => o.split('\n')[0].trim() || null);
const distro = (() => { try { return readFileSync('/etc/os-release', 'utf8'); } catch { return ''; } })();
const fedora = /^ID(_LIKE)?=.*fedora/m.test(distro);
const pkg = names => fedora ? `sudo dnf install ${names}` : `sudo pacman -S --needed ${names}`;
const ffmpegFix = fedora ? 'enable RPM Fusion, then sudo dnf swap ffmpeg-free ffmpeg --allowerasing' : pkg('ffmpeg');

// Start every probe now; network/CLI ones (npm view, plugin lists) are the slow ones.
const p = {
  git: first(run('git --version')), ffmpeg: first(run('ffmpeg -version')), ffprobe: first(run('ffprobe -version')),
  x264: run('ffmpeg -hide_banner -encoders').then(o => /libx264/.test(o)),
  claude: first(run('claude --version')), codex: first(run('codex --version')),
  hfNpm: usesHF ? first(run('npm view hyperframes version')) : null,
  claudePlugins: usesHF ? run('claude plugin list') : '', codexPlugins: usesHF ? run('codex plugin list') : '',
  ytdlp: first(run('yt-dlp --version')),
  songDur: song && existsSync(song) ? first(run(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${song}"`)) : null,
};

console.log(`video-studio preflight (engine ${engine}, tier ${tier})\n`);

console.log('Core tools');
const node = process.versions.node, needNode = usesHF ? 22 : 20;
+node.split('.')[0] >= needNode ? ok(`node ${node}`) : bad(`node ${node} (need >= ${needNode})`, 'mise use -g node@lts  (or ' + pkg('nodejs npm') + ')');
for (const [key, name, fix] of [['git', 'git', pkg('git')], ['ffmpeg', 'ffmpeg', ffmpegFix], ['ffprobe', 'ffprobe', 'comes with ffmpeg']]) {
  const v = await p[key]; v ? ok(v) : bad(name + ' not found', fix);
}
if (await p.ffmpeg) (await p.x264) ? ok('ffmpeg has libx264') : bad('ffmpeg lacks libx264 (Fedora ffmpeg-free?)', ffmpegFix);
const chromePaths = [
  process.env.CHROME_PATH, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = chromePaths.find(p => existsSync(p));
chrome ? ok(`chromium at ${chrome}`) : bad('Chromium not found', `${pkg('chromium')}, or set CHROME_PATH`);
const claudeV = await p.claude, codexV = await p.codex;
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
  (await p.hfNpm) ? ok('hyperframes on npm reachable (npx hyperframes init / render)') : warn('could not reach npm for hyperframes; check network');
  const inClaude = claudeV && /hyperframes/i.test(await p.claudePlugins);
  const inCodex = codexV && /hyperframes/i.test(await p.codexPlugins);
  inClaude && ok('hyperframes plugin installed in Claude Code');
  inCodex && ok('hyperframes plugin installed in Codex');
  if (claudeV && !inClaude) warn('Claude Code: claude plugin marketplace add heygen-com/hyperframes && claude plugin install hyperframes@hyperframes');
  if (codexV && !inCodex) warn('Codex: codex plugin marketplace add heygen-com/hyperframes && codex plugin add hyperframes@hyperframes');
}

console.log('\nAudio (optional)');
if (song && existsSync(song)) {
  const dur = await p.songDur;
  ok(`audio ${song}${dur ? ` (${(+dur).toFixed(1)} s)` : ''}`);
} else if (songRequired) bad(`audio not found at ${song}`, 'copy your audio there, or drop --song if the video has no music');
else warn('no audio at assets/song.mp3|wav (fine if the brief uses no music, composed-in-code music, or you add the song later)');

if (tier === 'B' || tier === 'C') {
  console.log('\nGeneration APIs');
  process.env.FAL_KEY ? ok('FAL_KEY is set') : bad('FAL_KEY not set', 'get a key at https://fal.ai/dashboard/keys and set it as an env var');
  process.env.ELEVENLABS_API_KEY ? ok('ELEVENLABS_API_KEY is set') : warn('ELEVENLABS_API_KEY not set (only needed for sound design)');
  existsSync('node_modules/@fal-ai/client') ? ok('@fal-ai/client installed') : warn('npm i @fal-ai/client');
  (await p.ytdlp) ? ok('yt-dlp available') : warn(`optional: yt-dlp for pulling reference videos (${pkg('yt-dlp')})`);
}

console.log(failed ? `\n${failed} blocking issue(s).` : '\nReady. Paste the brief into Claude Code or Codex from this folder.');
process.exit(failed ? 1 : 0);
