---
name: scenario
description: Step 1 of video-studio. Write the scenario, meaning a long director-style creative brief that a coding agent follows to make an AI-made video (music video, lyric video, animated short, kinetic-type piece, launch or explainer). It follows the style of the viral "Claude Pop" / "I'm Upping My P(doom)" prompts. It picks the engine (p5.brush hand-painted, HyperFrames HTML/GSAP motion graphics, or hybrid), the audio mode (the user's song, Suno lyrics + style prompt, royalty-free, composed in code, or none) and the optional AI-footage tier (fal/Seedance). It covers kinetic text, memes, the hook, scene-by-scene review gates, repos and installs. Use this whenever the user wants a video idea turned into a prompt, brief, scenario, storyline or "mega-prompt", or says "make me a video prompt", "plan a music video" or "write the scenario", even if they don't say "brief". Hand off to video-studio setup and create afterwards.
---

# Scenario: write the video brief

This skill writes a **prompt**, not a video. It's step 1 of the video-studio plugin: **scenario** (this) → **setup** (scaffold the project) → **create** (make the video). The output is a long creative brief. The user can run it with the `create` skill, or paste it into a fresh Claude Code session inside the project folder. The agent that receives it then directs, animates, renders and critiques the whole video on its own, pausing only at the review gates the brief sets.

It draws on three proven sources:

1. **@donaldjewkes's "Claude Pop" brief** (Sep 2026) gives the **voice and ambition**: a real creative mandate ("think and feel very deeply", "I'll let you cook"), taste guardrails ("not GPT slop", "not too Pixar"), and a concrete, checkable pipeline with budget permission.
2. **@other__reality's "I'm Upping My P(doom)" video** (https://github.com/JohnHeibel/PDoomVideo) gives the **hand-painted engine**: p5.js + p5.brush, a storyboard written by the agent, parallel chapter subagents, and contact-sheet self-review.
3. **AI Jason's HyperFrames workflow** (https://www.youtube.com/watch?v=8pRe7kkPi6g) gives the **motion-graphics engine and human-in-the-loop craft**: HTML/CSS/GSAP compositions, frame-by-frame storyboard review, and refining one scene at a time.

Shared files live at the plugin root, two levels above this skill's base directory (`<base>/../../references/`, `<base>/../../scripts/`). Read `references/brief-anatomy.md` before writing: the voice, the move-by-move breakdown, and short excerpts of the original (with a link to the full post). Read `references/toolchain.md` for repos, installs and keys, and `references/hyperframes.md` whenever the HyperFrames engine is involved.

## Workflow

### 1. Gather the inputs

Take everything you can from the conversation. Ask only for things that are missing and actually change the brief. Ask them in one short batch, and suggest a default for each so the user can just say "defaults".

| Input | Why it matters | Default if unknown |
|---|---|---|
| **Concept / theme** | Drives everything when there's no song | Ask; this is the one input you can't invent |
| **Audio mode** (see step 2): the user's song, a Suno track, royalty-free, composed in code, or none | Sets the timing backbone | **None / optional**. Don't block on it. |
| **Lyrics or script** | Drives the scene list and the kinetic text | From the song (Whisper if needed), or the agent writes on-screen copy from the concept |
| **Protagonist / character anchor** | Visual consistency | Clawd (Claude's crab mascot) for p5.brush; no character for pure motion graphics |
| **Style anchors** (K-pop, papery watercolour, internet brutalism, Apple/Nike ad, anime) and **anti-anchors** ("not Pixar", "not PowerPoint slides") | Stops generic output | Painted p5.brush look + one bold modern anchor; anti: glossy 3D "AI slop" and slide-deck layouts |
| **Audience and platform** (SF tech Twitter, TikTok 9:16, YouTube 16:9) | Sets the hook, aspect ratio, memes and length | Tech Twitter, 16:9, 1920×1080 |
| **Zeitgeist / memes** | Makes it land | The agent researches current timeline memes itself |
| **Engine** (step 3) and **generation tier** (step 4) | Sets tools, look and cost | Engine from the look; tier A unless the user has a FAL_KEY |
| **Collaboration mode**: autonomous, or review gates | Sets whether the agent stops for the user's approval | Review gates after the storyboard and after the first finished scene; autonomous otherwise |
| **Budget** (Claude / ChatGPT plan usage, fal credits) | Permission to iterate | "Be economical but spend what you need" |
| **Deliverables** (file name, fps, length, cutdowns) | Finish line | `out/<slug>.mp4`, 16:9, 24–30 fps. TikTok/Reels/Shorts get 2–3 loopable 15–30 s cutdowns. X gets one ≤15 s cutdown when the main video is over ~30 s. |
| **Reference material** the user already has (earlier videos, brand design.md, asset folders) | Reuse beats reinventing | None. Only mention things that really exist. |

If you can't ask (a non-interactive run, or "just do it"), use the defaults and add a short **"Assumptions"** section after the setup checklist. Refer to files by where they will be in the project (e.g. `assets/song.mp3`, `assets/lyrics.txt`), even if you can't see them yet.

### 2. Pick the audio mode (music is optional)

The video needs a **timing backbone**, but it doesn't have to be a song. Pick one mode and write the brief around it:

| Mode | Timing backbone | What the brief says |
|---|---|---|
| **Song provided** | The track's beats and lyric timestamps | Use the exact audio untouched. ffprobe it, get lyric timings (sheet or Whisper), build the beat grid, and cut on beats. Classic music video. |
| **Suno / Udio track (user makes it)** | Same as above, once the track exists | Offer to write the **lyrics plus a Suno style prompt** (genre, tempo, vocal type, mood) in the same output file. The user makes the song on the free plan, then downloads it on Pro for ~1 month (~$10). The free plan may block downloads and has no commercial rights. The brief assumes `assets/song.mp3`. |
| **Royalty-free** (Pixabay Music, YouTube Audio Library) | Its beats | The agent picks or is given an instrumental. On-screen text carries the "lyrics". |
| **Composed in code** (Tone.js / Web Audio → WAV) | The agent's own BPM grid | The agent composes an instrumental (synth, chiptune, ambient) at a chosen BPM, renders it to WAV, then animates to it. With HyperFrames, `/media-use` can also source or generate a music bed. |
| **No music** | A fixed tempo grid chosen so beats land on whole frames (e.g. **120 BPM at 30 fps = 15 frames/beat, 2 s/bar**) | The video must work silently: hook with text in the first second, captions carry the story. Cuts land on bar lines, text hits on beats. The agent renders a click track for its own review and exports with a silent audio track. Any song near the grid's BPM drops in later without re-timing. Optional SFX must be free (made in code, or CC0 sounds from Pixabay/Freesound) unless the user has ElevenLabs. |

When there's no song, replace "visualise every lyric" in the brief with "visualise every line of the script/copy". Keep the kinetic-text rules.

### 3. Pick the rendering engine

Both engines follow the same basic approach (code → headless Chrome → ffmpeg → MP4) and both are free. They differ in **look**:

- **p5.brush (ClaudeAnimationBase)** is hand-painted canvas animation: brush strokes, watercolour, paper grain, boiling linework, characters (Clawd with emotions and dances). Choose it for **character-driven music videos and illustrated shorts**. This is the P(doom) look.
- **HyperFrames (HeyGen, Apache 2.0)** uses HTML/CSS compositions animated with GSAP, CSS, Lottie, Three.js and similar. Choose it for **kinetic typography, lyric videos, motion graphics, product launches, UI demos, data and charts and explainers**. It ships Claude Code skills including `/music-to-video` (beat-synced lyric, slideshow or kinetic promo), `/product-launch-video`, `/faceless-explainer` and `/motion-graphics`. It also has a storyboard review UI with per-frame comments. Details are in `references/hyperframes.md`.
- **Hybrid (both)**: p5.brush paints the characters and world, and a HyperFrames/GSAP layer does the **big kinetic lyrics** (Donald's "lyrics really big and really present" requirement). The brief sets how they combine. Simplest: render the p5.brush plates first, then use them as background video clips inside HyperFrames compositions, with lyric and text layers on top, so a single `npx hyperframes render` produces the final cut. The alternative is to render a transparent text overlay (`/motion-graphics` supports transparent output) and composite it with ffmpeg. Folder layout: the ClaudeAnimationBase clone is the project root, and the HyperFrames project lives in `cut/` (`npx hyperframes init cut`), reading plates from `out/plates/`. Both share one `TIMELINE.md` at the root. Node 22+ for the whole project.

Choose by **look**, whatever the format (music video, launch, explainer, hype piece):
- Drawn character or painted world only → **p5.brush**
- Text, UI, charts or brand only → **HyperFrames**
- **Drawn character + big kinetic text** (e.g. "Apple-ad type but Clawd hand-drawn", or a music video with a lyric hook) → **Hybrid**

### 4. Pick the generation tier (optional AI footage)

- **Tier A: pure code.** No paid APIs. Everything is drawn in the chosen engine. The default.
- **Tier B: hybrid rotoscope (the Claude Pop method).** Character and set sheets from fal image models, then Seedance base clips (reference images, audio slices for lip sync), then everything redrawn in JS so the footage is only an underlay that is never shown. Needs FAL_KEY and credits.
- **Tier C: hybrid composite.** Same generation as B, but the footage **is shown**, with JS kinetic type, graphics and meme inserts on top. HyperFrames suits this well, because generated clips drop straight into compositions as `<video>` clips.

**Coded mascots (Clawd) in B/C.** Image and video models can't reproduce Clawd reliably. Have the agent render his model sheets (`studio.html?loop=views` / `?loop=emotions`) and feed those stills to fal as references. Seedance then only supplies motion, camera and physics. Play down lip sync.

### 5. Write the brief

Write in the user's voice: **first person, conversational, a bit dictated-sounding, mostly flowing paragraphs** (see the anatomy file). Don't turn it into a bulleted spec. The loose, enthusiastic prose is part of what makes the receiving model aim high. Keep the mechanics concrete enough to check, though: file names, timing rules, tools, gates and verification steps.

Cover these beats in roughly this order. Merge or skip beats that don't apply:

1. **The material**: the concept, the audio mode and where files live.
2. **The mandate**: complete end-to-end pass; audio untouched (if there is any); "think and feel very deeply" about visualising every lyric or line; total stylistic freedom, including abstract motion graphics.
3. **References and capability realism**: research motion design and music videos, study the attached repos or skills, "think about what is realistic for you to do".
4. **Engine and tools**: name the engine and why. Point to ANIMATION_GUIDE.md and/or the `/hyperframes` router skill. Keys are **in environment variables** only.
5. **Character and cast** (if any): character sheet, supporting cast, sets.
6. **Taste guardrails**: anti-slop lines, anti-anchors, one strong attention anchor (e.g. K-pop direction). For HyperFrames always add: **"by default this will look like PowerPoint slides; I don't want that"**. That's the engine's typical failure, according to AI Jason.
7. **Scene philosophy**: a music video, not constant lip sync; inserts, B-roll, characters doing other things.
8. **World-building and zeitgeist**: acceleration, specific memes, internet-brutalism inserts, the audience.
9. **Hook and retention**: visual hook in the first 1–3 s; **big kinetic lyrics/text at the start**; composition with negative space for text (16:9: characters right, text left; vertical: text high, character low); variety between subtitle-size and full-frame text. **Simplify**: short lines, few elements on screen, because attention spans are short.
10. **Pipeline specifics** for the engine, tier and audio mode (see `references/toolchain.md` and `references/hyperframes.md`).
11. **The scene-by-scene production loop**, with these steps in order:
    - **Story first.** A text script or storyboard (`STORYBOARD.md`, or the HyperFrames storyboard) that checks **layout and wording**, not polish.
    - **Review gate** (if collaborative): stop and let the user comment on each frame, then revise. In autonomous mode, the agent critiques its own storyboard against the brief.
    - **Set the quality bar on the first 1–2 scenes.** Polish them fully before touching the rest, because they define the look for everything after.
    - **Then go one scene/composition at a time**: "do scene N to the same standard as scenes 1–2." A model's attention on one or two scenes gives far better quality than the whole video at once. Use subagents per scene or chapter only after the quality bar is set, and give them the reference scenes plus the shared guide.
    - **Save the opening second and the ending for last**, once the story works.
    - Precise camera language helps: "keep the same zoom scale, only move the camera", "push in on the input field", "no zoom-out between these beats".
12. **Rigor and verification**: plan composition and timing before building. Contact sheets and snapshots (`render.mjs --sheet` / `npx hyperframes snapshot`), then short clips, then the full render. Watch the whole thing repeatedly (at phone size for vertical), screenshot weak moments and redo them. Lint and check with `npx hyperframes lint` / `check` for HyperFrames.
13. **Budget and confidence**: usage and credit permissions, with a hard ceiling around 80% of real credits; a sincere line of confidence in the model.
14. **Deliverables**: path, resolution, fps, audio (untouched song + SFX, or none), cutdowns.
15. **Stakes and closer**: "The goal is to make a banger for [platform], and the stretch goal is to make something better than anyone's ever seen before." End with something punchy like "make no mistakes."
16. **Attachments**: repos, skills, audio, references.

Aim for about 1,200–2,000 words of prose (the attachments list doesn't count). Shorter pieces (under ~30 s) can sit at the low end. The length is intentional: each paragraph shuts off a failure mode.

### 6. Add the setup checklist (and a Suno prompt if needed)

After the brief, write a short **"Before you paste this"** section addressed to the human, trimmed to the chosen engine, tier and audio mode from `references/toolchain.md` / `references/hyperframes.md`. It covers installs, repo clone or `npx hyperframes init`, plugin install, env vars, where to put the audio (if any), and session settings (Claude Code with Opus at high/xhigh effort, or Codex at high reasoning effort; run from the project folder). Point them to the preflight script:

```bash
node <plugin-root>/scripts/check_env.mjs --engine=p5|hyperframes|hybrid --tier=A|B|C [--song=assets/song.mp3]
```

If the audio mode is **Suno**, add a **"Make the song"** section before the brief: the full lyrics (verse/chorus labels) and a one-line style prompt (genre, BPM, vocal, mood, era references). Also tell the user to save the final track as `assets/song.mp3`.

### 7. Deliver

Save everything to `music-video-brief.md` in the current directory, or in the user's project folder if they named one. Start the file with a **settings block**, which is what the `setup` and `create` skills read, so they don't have to re-ask:

```yaml
# video-studio settings
slug: context-window          # used for the folder and out/<slug>.mp4
engine: p5 | hyperframes | hybrid
tier: A | B | C
audio: song | suno | royalty-free | code | none
audio_file: assets/song.mp3   # or none
resolution: 1920x1080         # 1080x1920 for vertical
fps: 30
grid_bpm: 120                 # only when audio is none/code; else detected from the song
review_gates: storyboard, first-scene   # or none (fully autonomous)
hyperframes_workflow: music-to-video    # when engine uses HyperFrames
```

Then: (Make the song) → the brief in a four-backtick fenced `text` block (easy to copy even if it contains code) → setup checklist → Assumptions. Show the user the path and a 3–4 line summary of the creative direction, engine and audio mode. Don't dump the full brief into chat unless they ask. Offer one round of changes, then offer the next step: **setup** (scaffold the project folder with the chosen engine, audio and brief) and then **create** (make the video).

## Security note (why keys go in env vars)

The original brief told the agent "you can see the API key" in a folder. Prompts get shared, pasted and saved in transcripts. So the brief should name the env var (`FAL_KEY`, `ELEVENLABS_API_KEY`) and never contain a key itself. If the user pastes a key into the conversation, don't copy it into the brief, and suggest they rotate it.

## Adapting to other formats

Keep the mandate → guardrails → pipeline → scene-by-scene loop → verification → stakes arc, and change these:

- **Vertical (TikTok / Reels / Shorts, 1080×1920).** Hook in about 1 s that works with the sound off. Text high, character low or to one side. Keep out of the UI zones: bottom ~20% (caption), right ~15% (buttons) and the top strip. Seamless loop; cutdowns; review at phone size.
- **Product launches and UI demos** (HyperFrames `/product-launch-video`). Replace "lyrics" with the story beats and value propositions. Demand **pixel-accurate UI** (the agent recreates the real app from screenshots the user provides). Use a continuous "screen recording" feel with deliberate camera moves, real logos and realistic data. Details that show the product's actual value (e.g. a live-updating results table) matter more than flashy transitions.
- **Explainers** (`/faceless-explainer`). Script-driven, with typography, diagrams and data-viz; no characters needed.
