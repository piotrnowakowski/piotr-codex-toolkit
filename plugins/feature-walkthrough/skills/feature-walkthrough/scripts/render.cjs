#!/usr/bin/env node
// One-take silent renderer; explicit idle cuts and raw-to-final timing.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const assTime = s => {
  const n = Math.round(s * 100);
  return `${Math.floor(n / 360000)}:${String(Math.floor(n / 6000) % 60).padStart(2, '0')}:${String(Math.floor(n / 100) % 60).padStart(2, '0')}.${String(n % 100).padStart(2, '0')}`;
};
const text = s => String(s).replace(/\\/g, '\uFF3C').replace(/[{}]/g, c => c === '{' ? '(' : ')').replace(/\r?\n/g, '\\N');
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function main() {
  const file = path.resolve(process.argv[2] || 'events.json');
  const take = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = path.dirname(file), speed = take.speed;
  if (!Number.isFinite(speed) || speed <= 0 || speed > 3) throw new Error('Invalid recording speed');
  if (!take.video) throw new Error('No captured video; inspect the recording error');
  const final = path.join(out, 'walkthrough.mp4');
  if (fs.existsSync(final)) throw new Error('walkthrough.mp4 already exists; preserve it or choose a new render directory');
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', take.video], { encoding: 'utf8' }));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Empty or invalid source video');
  const cuts = take.events.filter(e => e.kind === 'cut').map(e => [e.from, e.to]).sort((a, b) => a[0] - b[0]);
  let cursor = 0, edited = 0;
  const segments = [], filters = [];
  for (const [a, b] of [...cuts, [duration, duration]]) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < cursor || b < a || b > duration) throw new Error('Invalid or overlapping idle cuts');
    if (a > cursor) {
      segments.push({ rawFrom: cursor, rawTo: a, finalFrom: edited / speed, finalTo: (edited + a - cursor) / speed });
      edited += a - cursor;
    }
    cursor = b;
  }
  if (!segments.length) throw new Error('No video remains after cuts');
  const mapTime = t => {
    let sum = 0;
    for (const s of segments) {
      if (t <= s.rawFrom) return sum / speed;
      sum += Math.max(0, Math.min(t, s.rawTo) - s.rawFrom);
      if (t <= s.rawTo) break;
    }
    return sum / speed;
  };
  const end = edited / speed;
  const captions = take.events.filter(e => e.kind === 'caption').map(e => ({ ...e, rawTime: e.t, t: mapTime(e.t) }));
  const w = take.width, h = take.height, bh = take.barHeight;
  if (![w, h, bh].every(n => Number.isInteger(n) && n > 0 && n % 2 === 0)) throw new Error('Video and strip dimensions must be positive even integers');
  const ass = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${w}`, `PlayResY: ${h + bh}`, 'WrapStyle: 0',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Guide,Arial,23,&H00FFFFFF,&H00FFFFFF,&H00172A0F,&H00172A0F,0,0,0,0,100,100,0,0,1,0,0,5,32,32,0,1',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  captions.forEach((c, i) => {
    const stop = captions[i + 1]?.t ?? end;
    if (stop <= c.t) return;
    const colour = c.tone === 'wait' ? '&H00F8BD38&' : c.tone === 'tip' ? '&H005EC522&' : '&H000B9EF5&';
    ass.push(`Dialogue: 0,${assTime(c.t)},${assTime(stop)},Guide,,0,0,0,,{\\an5\\pos(${w / 2},${h + bh / 2})\\b1\\c${colour}}${text(c.label)}{\\b0\\c&HFFFFFF&}  |  ${text(c.text)}`);
  });
  fs.writeFileSync(path.join(out, 'captions.ass'), ass.join('\n') + '\n', 'utf8');
  segments.forEach((s, i) => filters.push(`[0:v]trim=start=${s.rawFrom}:end=${s.rawTo},setpts=PTS-STARTPTS[v${i}]`));
  filters.push(`${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[joined]`);
  filters.push(`[joined]setpts=PTS/${speed},pad=${w}:${h + bh}:0:0:color=0x0f172a,subtitles=filename=captions.ass:original_size=${w}x${h + bh}[out]`);
  fs.writeFileSync(path.join(out, 'segments.json'), JSON.stringify({ source: take.video, speed, seconds: end, segments }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(captions, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'timeline.txt'), captions.map(c => `${mmss(c.t)}  ${c.label} | ${c.text}`).join('\n') + '\n', 'utf8');
  execFileSync('ffmpeg', ['-v', 'error', '-n', '-i', take.video, '-filter_complex', filters.join(';'), '-map', '[out]', '-an', '-r', '25',
    '-c:v', 'libx264', '-crf', '20', '-preset', process.env.FFMPEG_X264_PRESET || 'veryfast', '-threads', '0',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final], { cwd: out, stdio: 'inherit' });
  console.log(JSON.stringify({ final, seconds: end, sourceOk: take.ok, rehearsal: take.rehearsal, segments: segments.length }));
}
try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
