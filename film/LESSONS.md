# Lessons from the first paperfilm reel (AURAMANTRA), for the skill

The paperfilm format was made for 6–13 minute narrated websites. This was a 25-second, upright,
silent-text Instagram Reel delivered as an MP4. What changed, and what was learned:

## Format
- **Deliver a video, not a page.** `tools/render.mjs` drives the stage frame by frame
  (`window.__renderAt(t)` → Playwright screenshot → ffmpeg pipe) at 540×960 CSS × 2 = 1080×1920,
  30 fps, H.264 high + AAC 48 kHz, `+faststart`. About 16 minutes for 25 s here (no GPU). Run it
  in the background: foreground commands stop after 10 minutes.
- **Sound events come from the picture**: `film.soundEvents()` lists every pop/fold (`tPop`, `foldAt`)
  and every footfall (sampling `act(t).walk`); `tools/events.mjs` writes them for `build_audio.py`,
  which replaces the live paper flaps of `sound.js`.
- **Engine additions for upright films** (general, kept in `engine.js`): `film.horizon(aspect)`,
  `film.pullFit(stage)` and `film.pullY`. The template sat the horizon at 66% and the pulled-back
  planet at 52% with a small radius; a reel wants the horizon at ~73% and a bigger planet higher up.
- **The camera's zoom compounds with the stage's own tall-screen close-up (`stage.zm`)**: drive zoom
  with a track divided by `stage.zm`. A person should be ≥ ~400 px tall of 1920 in a reel's hook.

## Story
- A beat every 3–4 s instead of a chapter a minute. Hook in frame 1 (no fade from black: the template
  fades in over 3.4 s and out over 3.5 s; both removed). A slow pull-back over the first 1.5 s reveals
  the gag (the tower of the week).
- **No narrator**: short lines on hanging paper cards, centred at ~0.47 W, hanging at ~0.15–0.2 H:
  below Instagram's top bar, clear of the buttons down the right and the caption at the bottom.
  Kokoro has no Hungarian voice and Hugging Face was blocked; for an ad, text cards were better anyway
  (most people scroll muted).
- **The ending turns the brand into the image**: the planet (half before, half after) held in a paper
  lotus like the client's logo, the name glued onto the cardboard face, a card with how to book.
  The Reel's loop then plays the before/after again.
- A one-person business must not look like a big operation: one practitioner, their own real room.

## Pitfalls paid for
- **Petals or specks over a Hungarian title read as accents** ("ÁURAMANTRA"): stop weather before
  the title.
- **Tinting a sprite with `source-atop` on the main canvas tints everything under it**: tint a copy.
- **Pull-back decorations sized in sprite units vanish behind the planet**: size them in planet radii.
- **Paper blotch at full strength looks polka-dotted on big flat cards**: `blotch: 0.35, grain: 0.4`.
- **Two arms of one person in a close-up must lean in, not cross.**
- **A timed walker lies flat for 2.5 s before `popAt`**: give it `from` just before it pops.
- **Without a voice the ambience and effects must come up ~10–12 dB** against the narrated films'
  levels; master to about −16.5 dBFS RMS for a phone speaker. Keep the 3–8 kHz check.
