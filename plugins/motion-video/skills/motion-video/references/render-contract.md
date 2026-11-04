# Motion and render contract

## Deterministic time

Keep the composition declarative where practical. Use unique ids across imported scenes: an id collision can attach another scene's absolute positioning while still producing a valid HTML page. Scope CSS to a scene or a stable component.

Every call to `renderAt(t)` must reset both visible and hidden states that can change. A counter, class, highlight or typed string must seek backward correctly. Test the same frame twice with a distant frame in between. Set a scene visible on `[start, start + duration)` and hold its final content until the cut. Bound loops by finite metadata; a preview clock is not a renderer.

Useful pure motion primitives:

```js
const clamp = x => Math.min(1, Math.max(0, x));
const enter = x => 1 - (1 - clamp(x)) ** 3;
const lerp = (a, b, x) => a + (b - a) * x;
function spring(t, damping = 0.8, frequency = 1) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * frequency;
  if (damping >= 1) return 1 - (1 + w * t) * Math.exp(-w * t);
  const s = Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) *
    (Math.cos(w * s * t) + damping / s * Math.sin(w * s * t));
}
```

Use overshoot for a deliberate object landing, not routine reading text. Give enter, travel and settle separate timing. Type text by slicing the full string from an absolute progress value. For a physical animation that cannot seek analytically, precompute a seeded simulation and sample it; do not evolve it according to call order.

## Three.js and liquid objects

The starter pins Three.js 0.160.0 and imports it from local `node_modules`. It raymarches capsule signed-distance fields with a smooth union, so a blob can separate into rounded bars. Set uniforms from `t`, render on demand and use a fixed pixel ratio for export. The renderer uses the configured dimensions and an orthographic screen plane.

For metal, work on lighting and material colour together. A dark environment makes gold look grey, while broad tone mapping can wash its saturation out. Use a key softbox, a rim and a horizon reflection; keep linear-light material math separate from output encoding. Do not stack an additional output conversion onto a shader that already applies one. Inspect stills instead of assuming a colour constant proves the material looks right.

Clamp a disappearing SDF object's radius fully to zero below the pixel threshold; a near-zero sphere can leave a bright pixel. Keep antialiasing and numeric tolerances proportionate to the output resolution. Verify the actual renderer on the machine; never claim a particular GPU or timing from a historical run.

## Sound

`OfflineAudioContext` provides a finite local score with no microphone or autoplay permission. Seed synthesized noise, schedule notes by absolute time and render a stereo 48 kHz PCM WAV. Keep attacks explicit; a compressor or a loud bed can hide a pluck even when its event exists. Do not fix a masked cue just by making the entire mix louder.

Use a coherent musical or tonal bed when the film needs one. Put action sounds on the action; a one-frame sound offset can be used deliberately. Leave a short tail and a final fade. Respect an existing silent brief. Voice synthesis and external music are separate choices; this workflow grants no paid API access.

The supplied ffmpeg export uses H.264 High, yuv420p, CRF 18, faststart and AAC stereo. Its audio chain is loudness normalization, resampling and a limiter with automatic gain compensation disabled. This provides headroom but **must be measured after AAC encoding**, since codec reconstruction can change peaks. Verification fails if the true peak exceeds −1 dBTP or a requested soundtrack is effectively silent. Adjust the chain when the requested delivery spec differs.

## What the tools prove

- `checks.json`: scene metadata, ids, marked bounds and deterministic repeated frames on this renderer.
- `contact-sheet.jpg` and its PNGs: samples for visual inspection, not proof of smooth motion between them.
- `render.json`: source hash, metadata, frame directory and completed frame count.
- `verification.json`: actual codecs, dimensions, frame count, duration, complete decode and encoded-audio measurements.

The contact-sheet command disables ffmpeg filter reinitialization so a change in image colour metadata does not discard buffered tiles. Check that the ending appears in the sheet; file creation alone is not evidence that every sample was included.

None of these establish that a depicted product interaction ran live, that a model answered correctly, or that someone listened to the soundtrack. Inspect motion samples or the video when relevant and describe the evidence honestly.
