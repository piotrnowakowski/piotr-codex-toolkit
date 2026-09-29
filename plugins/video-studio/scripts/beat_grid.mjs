#!/usr/bin/env node
// Write a beat/bar grid (the timing backbone) as markdown + JSON.
//   node beat_grid.mjs --bpm=120 --fps=30 --duration=45 [--offset=0] [--beats-per-bar=4] [--out=TIMELINE.grid]
//   node beat_grid.mjs --song=assets/song.mp3 --bpm=110 [--offset=0.42]   (duration read with ffprobe)
// --offset = time of the first downbeat in seconds. BPM detection is not done here: use the lyric sheet,
// a tap-tempo, or `pip install librosa` (librosa.beat.beat_track) and pass the result in.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const a = Object.fromEntries(process.argv.slice(2).map(x => { const [k, v] = x.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const bpm = +a.bpm, fps = +(a.fps || 30), offset = +(a.offset || 0), bpb = +(a['beats-per-bar'] || 4);
let dur = a.duration ? +a.duration : null;
if (!bpm) { console.error('--bpm required'); process.exit(2); }
if (!dur && a.song) dur = +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${a.song}"`).toString().trim();
if (!dur) { console.error('--duration or --song required'); process.exit(2); }

const beat = 60 / bpm, bar = beat * bpb, fpb = beat * fps;
const beats = [];
for (let t = offset, i = 0; t <= dur + 1e-9; t = offset + ++i * beat) beats.push({ i, bar: Math.floor(i / bpb) + 1, beatInBar: (i % bpb) + 1, t: +t.toFixed(4), frame: Math.round(t * fps) });
const bars = beats.filter(b => b.beatInBar === 1);

const out = String(a.out || 'TIMELINE.grid');
writeFileSync(out + '.json', JSON.stringify({ bpm, fps, offset, beatsPerBar: bpb, duration: dur, beatSec: beat, barSec: bar, framesPerBeat: fpb, beats }, null, 1));
const md = [
  `# Beat grid`, ``,
  `- ${bpm} BPM, ${bpb}/4, first downbeat at ${offset}s, ${fps} fps, duration ${dur.toFixed(2)}s`,
  `- beat = ${beat.toFixed(4)}s (${fpb.toFixed(2)} frames${Number.isInteger(+fpb.toFixed(6)) ? ', whole frames ✓' : ' — not whole frames; consider a BPM that divides fps*60'}), bar = ${bar.toFixed(4)}s`,
  `- ${bars.length} bars. Cut on bar lines; land text hits on beats.`, ``,
  `| bar | time (s) | frame |`, `|---:|---:|---:|`,
  ...bars.map(b => `| ${b.bar} | ${b.t.toFixed(3)} | ${b.frame} |`),
].join('\n');
writeFileSync(out + '.md', md + '\n');
console.log(`wrote ${out}.md and ${out}.json (${bars.length} bars, ${beats.length} beats)`);
