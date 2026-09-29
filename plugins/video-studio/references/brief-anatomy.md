# Anatomy of the "Claude Pop" brief

Source: @donaldjewkes on X, 23 Sep 2026 (https://x.com/donaldjewkes/status/2102801469976248500). It quotes @other__reality's "Claude Opus 5.5 has the best visual design of any model I have tested so far" post (https://x.com/other__reality/status/2102514581684052169). That video's source is https://github.com/JohnHeibel/PDoomVideo.

## Contents
1. Why the voice works
2. Rhetorical moves, one by one
3. Things to generalise away
4. Voice excerpts (style example)

---

## 1. Why the voice works

- **First person and spoken.** It reads like a voice memo from a director to a trusted collaborator ("I think what might make the most sense here is...", "I'll let you cook here"). This makes the model act as a collaborator with taste instead of someone filling in a checklist.
- **Freedom and constraint alternate.** Nearly every paragraph opens a door ("you can do truly anything") and then sets a guardrail ("but try and anchor to visual references that people will be able to understand"). Keep that rhythm.
- **Opinionated taste.** "Pixar... is kind of slop." "I don't want GPT slop." Clear dislikes do more than vague likes.
- **Specifics carry the weight.** Named memes (Shinji, the Navier–Stokes / "math getting eaten" hype), a named anchor (K-pop), a named layout (characters right, lyrics left), a named technique (draw over live footage, i.e. rotoscoping). Vague briefs get average videos.
- **It's long on purpose.** Each paragraph closes off a failure mode: generic style, sync drift, cluttered text, no hook, a single pass with no revision, holding back on budget.

## 2. Rhetorical moves, one by one

| # | Move | Example line from the original | Failure it prevents |
|---|---|---|---|
| 1 | Hand over the material | "I've included an MP4 file and an original link..." | The agent guesses the inputs |
| 2 | End-to-end mandate + keep the audio | "independently do an end-to-end complete pass... Use the exact same audio track" | Partial work; remixing the song |
| 3 | Deep feeling + total freedom | "think and feel very deeply... you can do truly anything... including abstract motion graphics" | Timid, literal visuals |
| 4 | Research licence | "You can use the internet freely to pull in references. You can look at motion design." | Designing from memory alone |
| 5 | Capability realism | "think about your current capabilities and what is realistic" | Overreaching plans that never ship |
| 6 | Tool inventory with docs | ElevenLabs docs, fal key, Seedance docs in markdown | Unused tools; hallucinated APIs |
| 7 | Character anchor | a personified sunflower-esque Claude protagonist matching the feminine vocals | No visual consistency |
| 8 | Anti-slop taste | "I don't want you to produce something that is GPT slop... wouldn't fit too heavily to Pixar" | Generic AI look |
| 9 | Coherent style that suits the models | "come up with a coherent style that works well with the image gen models" | Styles the generators can't reproduce |
| 10 | Attention anchor | "K-pop... how they direct human attention and manage human psychology" | Flat pacing |
| 11 | Cast and sets | "a few backup dancers and some supporting characters... design your own sets" | Empty world |
| 12 | Music-video grammar | "You don't need... visible lip movement throughout... inserts... characters doing something else" | Nonstop talking heads |
| 13 | Zeitgeist mining | "audit all of the different events... Shinji meme... internet brutalism" | Doesn't land with the audience |
| 14 | Audience | "appreciated... by a San Francisco tech Twitter audience" | Wrong reference set |
| 15 | Hook | "a very strong, compelling visual hook... really quickly" | Scroll-past |
| 16 | Sync rigor | "cut up the song and actually pass it in as a reference in seedance... build out the right verification loops" | Lip sync drift |
| 17 | Rotoscope layer | "reconstruct the video from scratch as sort of an overlay... we don't even see the base assets" | Raw AI footage look |
| 18 | Kinetic lyrics + composition | "lyrics be really big... background less busy there... characters on the right as lyrics appear on the left" | Text fights the picture |
| 19 | Variance | "sometimes... subtitles, and then other times... really big" | Monotony |
| 20 | Confidence | "Your capabilities are far beyond what you understand" | Self-limiting |
| 21 | Budget | "spend all of the usage... aggressively, but also economically... roughly two grand in fal credits" | Under-iterating, or burning credits |
| 22 | Stakes | "make a banger for Twitter... stretch goal... better than anyone's ever seen" | Aiming for "fine" |
| 23 | Planning warning | "when things cohere together, it can be jarring... be really rigorous in planning of composition and timing" | Pieces that don't mesh |
| 24 | Iteration licence | "watch the entire video multiple times, take screenshots... revisit" | A single pass |
| 25 | Honest baseline | "The reference GitHub... is good, but it's really not there" | Copying the reference |
| 26 | Closer | "make no mistakes." | — (tone) |

## 3. Things to generalise away

- **Voice-dictation artefacts.** "foul" = **fal** (fal.ai), "Navi Stokes" = **Navier–Stokes**, "/asic" was the author's private folder, and "skill mesh" / "skill video scoring" were the author's own skills. Only mention folders or skills the current user really has.
- **API keys "you can see".** Replace these with env var names (see the SKILL.md security note).
- **"Spend all of the usage."** Match this to the user's real plan and budget. Keep the "aggressively but economically" balance.
- **Model versions.** Name the models the user actually has access to. Tell the agent to check the current model IDs in the provider docs instead of hard-coding them.

## 4. Voice excerpts (style example)

The full original prompt is in the post: https://x.com/donaldjewkes/status/2102801469976248500. Read it there for the complete rhythm. These short excerpts show the voice to reproduce: first person, spoken, generous with freedom, specific about the pipeline.

> "I want you to independently do an end-to-end complete pass on making an updated version of this video."

> "You do not need to anchor to the current style, you can do truly anything that you think might best let you visually express yourself, including abstract motion graphics."

> "I don't want you to produce something that is GPT slop."

> "It's like that animation technique where you shoot first in traditional film and then draw over top of it."

> "You want to have some variance, so sometimes I think lyrics will just appear more like subtitles, and then other times they're going to be really present and really big."

> "You're going to want to watch the entire video multiple times, take screenshots at individual parts, and think about if something is really up to the bar of quality that we need here."

> "The goal is to make a banger for Twitter, and the stretch goal is to make something better than anyone's ever seen before."

> "make no mistakes."

What the full text adds beyond these lines: its order of moves matches the table in § 2, and its length (about 1,800 words) is part of the method, because each paragraph closes off one failure mode. Aim for the same arc and length, in the current user's own words.
