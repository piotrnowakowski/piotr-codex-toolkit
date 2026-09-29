# HyperFrames engine

Repo: https://github.com/heygen-com/hyperframes (Apache 2.0, free: no account, API key or render fees)
Docs: https://hyperframes.heygen.com/introduction · Showcase: https://hyperframes.heygen.com/showcase · Playground: https://www.hyperframes.dev/
Workflow source: AI Jason, "GPT 6 + Hyperframe = Crazy combo for expert-level videos" (https://www.youtube.com/watch?v=8pRe7kkPi6g)

## What it is

The model writes the video as HTML. Each scene is a **composition**: an HTML file whose elements carry `data-*` timing attributes (start, duration, track) and are wrapped as clips. Animations are GSAP / CSS / Lottie / Three.js / Anime.js / WAAPI timelines bound to the video clock, so the engine can **seek to any frame**. That lets the model "see" what the video looks like at 1:03, which JSON or After Effects–style layer descriptions couldn't do. The CLI renders it deterministically in headless Chrome and encodes with FFmpeg.

A HyperFrames project is split into separate compositions (`compositions/01-..., 02-...`), so **reordering and redoing individual scenes is cheap**, and old compositions from past videos can be reused ("use the layout from `<old-project>/compositions/03` again").

Compared with Remotion: Remotion is React-based and HyperFrames is plain HTML/CSS/JS. AI Jason finds HTML freer to design in. Both work; HyperFrames can also port Remotion projects (`/remotion-to-hyperframes`).

## Install

Requirements: **Node.js 22+**, FFmpeg (Chrome is driven via Puppeteer).

Agent plugin (recommended: bundles all skills):
```bash
# Claude Code
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
# Codex
codex plugin marketplace add heygen-com/hyperframes
codex plugin add hyperframes@hyperframes
```
Then use `/hyperframes:hyperframes` (the router). Enable auto-update for the marketplace in `/plugin` → Marketplaces.

Or standalone skills, core set only (the router installs workflow skills on demand):
```bash
npx hyperframes skills update
```

Project CLI:
```bash
npx hyperframes init my-video
cd my-video
npx hyperframes preview      # browser preview with live reload
npx hyperframes lint         # validate compositions
npx hyperframes snapshot     # stills for visual checks
npx hyperframes render       # MP4
npx hyperframes doctor       # environment diagnostics
```

## Skills to name in the brief

Router: `/hyperframes`. **Read first.** It confirms the creative brief and routes to a workflow.

| Workflow skill | Use for |
|---|---|
| `/music-to-video` | A music track (file, video to pull audio from, or generated from a mood brief) → **beat-synced** lyric, slideshow or kinetic promo; music drives pacing |
| `/product-launch-video` | Launch or promo from a URL, brief or script; site tours; 30–90 s sweet spot |
| `/faceless-explainer` | Explaining a concept with typography, diagrams or data-viz; no product capture |
| `/motion-graphics` | Short (<10 s) kinetic type, stat hits, logo stings; MP4 **or transparent overlay** |
| `/embedded-captions`, `/talking-head-recut` | Captions and graphic overlays on existing footage |
| `/pr-to-video` | GitHub PR → feature-reveal video |
| `/general-video` | Anything else, long or multi-scene; "companion mode" co-creation |

Domain skills: `/hyperframes-core` (composition contract, determinism rules), `/hyperframes-animation` (motion rules, transitions, runtime adapters), `/hyperframes-keyframes`, `/hyperframes-creative` (frame.md / design.md, palettes, typography, **beat planning, audio-reactive visuals**), `/media-use` (resolve or generate BGM, SFX, images, icons, logos, voice; transcribe; captions), `/hyperframes-audio` (mixing, ducking), `/hyperframes-registry` (catalog of ready-made blocks and transitions; check it **before** hand-building a named look), `/hyperframes-cli`.

`frame.md` = a brand's design system rewritten for the camera. If the user has a `design.md`, tell the agent to produce a `frame.md` first so the video stays on-brand.

## The AI Jason production loop (put this into briefs)

1. **Story in text first.** The agent proposes a script; the user edits the storyline (which use case leads, which value props must appear, what the closing slogan is).
2. **Storyboard review, layout and wording only.** Comment frame by frame in the storyboard UI (feedback saves to a JSON in the project's `.hyperframes` folder). "Copy prompt" pastes it back to the agent. Don't give too much feedback at once.
3. **Approve → first animated pass.** This will be rough. Some UI won't look right.
4. **Nail scenes 1–2 to final quality** (e.g. pixel-accurate app UI from screenshots, a background that looks like a real screen recording, camera zooms that focus attention).
5. **Scene by scene after that**: "do composition 4 with the same quality and interface design." Later scenes come out right on the first try once the bar is set.
6. **Opening second and ending last.**
7. **Music last** (from `/media-use` or the user's track), unless it's a music-driven video, in which case `/music-to-video` sets the timing up front.

Craft notes from the video:
- **The default failure is "PowerPoint slides."** The user's taste and specific feedback are what lift it above that.
- **Simplify relentlessly.** Short text, fewer elements, remove toolbars and visual noise.
- **Precise camera vocabulary works:** "keep the same zoom scale and just move the camera position", "zoom in on the input field", "no zoom-out between these beats", "hold on the last frame".
- **Stage things gradually:** loading state → items pop in → camera moves to where results appear.
- **Realism details sell it:** real logos, real profile photos, plausible data, a live "waterfall" of values filling in.
- **Big-type moments:** "large centred title, Apple/Nike-ad style motion, then scale down and reveal the rest."
- Expect about 1–2 hours of back-and-forth for a ~1-minute polished piece.

## Hybrid with p5.brush

- **Easiest:** render p5.brush shots with ClaudeAnimationBase's `render.mjs` into clips (`out/plates/NN.mp4`), use them as `<video>` clips inside HyperFrames compositions, put the kinetic lyric/text layer on top in HTML/GSAP, and do the final render with `npx hyperframes render`.
- **Overlay:** render the lyric layer with transparency (`/motion-graphics` transparent output), then composite it over the p5.brush render with ffmpeg (`overlay` filter), muxing the untouched song last.
- Keep one shared `TIMELINE.md` (beats, lyric timestamps, section boundaries) as the source of truth for both engines so cuts and text hits line up.
