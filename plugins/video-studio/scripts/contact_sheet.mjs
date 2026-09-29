#!/usr/bin/env node
// Engine-agnostic visual check: tile frames from any rendered video into one image for review.
//   node contact_sheet.mjs --video=out/video.mp4 [--every=2 | --times=0.5,3,7.2] [--cols=4] [--w=480] [--out=out/sheet.jpg]
//   node contact_sheet.mjs --video=out/video.mp4 --from=10 --to=20 --every=0.5    (dense strip of one scene)
// Each tile is stamped with its timestamp so feedback can reference exact moments.
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const a = Object.fromEntries(process.argv.slice(2).map(x => { const [k, v] = x.replace(/^--/, '').split('='); return [k, v ?? true]; }));
if (!a.video) { console.error('--video required'); process.exit(2); }
const video = String(a.video), cols = +(a.cols || 4), w = +(a.w || 480), out = String(a.out || 'out/sheet.jpg');
const dur = +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${video}"`).toString().trim();

let times;
if (a.times) times = String(a.times).split(',').map(Number);
else {
  const from = +(a.from || 0), to = Math.min(+(a.to || dur), dur - 0.05), every = +(a.every || Math.max(1, (to - from) / 16));
  times = []; for (let t = from; t <= to + 1e-9; t += every) times.push(+t.toFixed(3));
}
if (times.length > 64) { console.error(`${times.length} tiles is too many; raise --every or narrow --from/--to`); process.exit(2); }

// An explicit font file avoids fontconfig errors on Windows builds of ffmpeg.
const font = ['C:/Windows/Fonts/arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf'].find(existsSync);
const fontOpt = font ? `fontfile='${font.replace(/:/g, '\\:')}':` : '';

const tmp = mkdtempSync(join(tmpdir(), 'sheet-'));
try {
  times.forEach((t, i) => {
    const label = `${t.toFixed(2)}s`;
    execSync(`ffmpeg -v error -y -ss ${t} -i "${video}" -frames:v 1 -vf "scale=${w}:-2,drawtext=${fontOpt}text='${label}':x=8:y=8:fontsize=${Math.round(w / 18)}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4" "${join(tmp, `t${String(i).padStart(3, '0')}.png`)}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
  });
  const rows = Math.ceil(times.length / cols);
  mkdirSync(dirname(out), { recursive: true });
  execSync(`ffmpeg -v error -y -framerate 1 -i "${join(tmp, 't%03d.png')}" -vf "tile=${cols}x${rows}:padding=4:color=gray" -frames:v 1 "${out}"`);
  console.log(`wrote ${out} (${times.length} frames, ${cols}x${rows}) from ${video} [${dur.toFixed(2)}s]`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
