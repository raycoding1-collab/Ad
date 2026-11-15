# AURAMANTRA — a paper reel

A 25-second Instagram Reel (9:16, 1080×1920, 30 fps, with sound) for **AURAMANTRA massage point**,
Budapest X. kerület. Made of paper, cardboard and code, with the `paperfilm` skill.

**The video: `out/auramantra_reel.mp4`.** Cover frame: `out/cover.jpg`.

## The story (Hungarian cards, no narrator)

1. **Egész héten cipelted.** A grey, rainy Budapest street; a yellow tram goes by. A woman walks bent
   under a swaying tower of her whole week: an archive box, a laptop, folders, a calendar with Monday
   to Friday crossed out, the shopping, and an alarm clock on top. On her shoulder, a red knot.
2. **Itt leteheted.** One ground-floor window glows with candles. She sets the week down on the
   pavement; its loose pages fly up as paper butterflies; the rain stops; the door opens for her.
3. **Kioldódnak a csomók.** Inside, their room, cut open like a dollhouse: the table with its beige
   sheet and light-blue bolster, the tray of candles and creams, the oil, towels, lavender, black
   stones, her coat on a hook. Up close, two hands work the red knot loose into one smooth thread.
4. **Csak rád szabva.** A drop of warm oil falls into the practitioner's palms and a warm ring (an
   aura) goes out from it. Three long lomi lomi strokes; with each, a paper wave rolls out of the room
   and the grey world gets its colour back: amber, rose, lavender.
5. **Pihekönnyen haza.** She walks home through the flowers, light, with a little skip.
6. **The point.** Pulled back: the little planet, half grey and raining, half in bloom, one warm
   point between them, held in a paper lotus. The name is glued onto the planet's cardboard face.
   *balinéz · thai · lomi lomi — Budapest, X. ker. — Időpontfoglalás DM-ben.*

## Make it again

```sh
python3 -m http.server 8765 &                         # the stage
python3 tools/timeline.py film/film.json              # script times -> src/timeline.js
node tools/events.mjs                                 # the picture's paper flaps and footsteps -> .cache/events.json
/home/user/tts/venv/bin/python tools/build_audio.py   # score, ambience, effects -> .cache/film.wav
node tools/render.mjs out/auramantra_reel.mp4 30      # every frame at 1080x1920, muxed with the sound
```

`index.html?t=SECONDS` freezes one frame; `?play&from=SECONDS` previews silently in real time.
`node tools/reelsheet.mjs NAME "t1,t2,..." [cols]` makes contact sheets at the real size
(`SAFE=1` marks the areas Instagram's interface covers).

## How it is made

- `film/film.json`: the script: the five Hungarian cards, the brand lines, and the time of every event.
- `src/film.js`: the reel: camera, light of each stage, the cards, the knot close-up, the oil and aura,
  the waves of colour, the lotus pull-back and the title.
- `src/kinds_aura.js`: its cut-outs: Budapest blocks, the Kőbánya church spire, the yellow tram and its
  wire, umbrellas, her and her tower of the week, the house with the warm window, the room, the table
  with the client and the practitioner, flowers.
- The rest is the paperfilm engine (`src/engine.js`, `paper.js`, `people.js`, the template's cut-out
  libraries) with two small additions for upright films: a film may set its own horizon and the size
  and place of the planet when it is seen whole.
- Sound: synthesised in Python (`tools/build_audio.py`), no voice: a felt piano, a soft cimbalom, pads,
  a singing bowl, a beat heard through a wall in the rain and open once the colour returns; rain, the
  tram and its bell, the room, every paper flap and footstep of the picture. Kept under about 2.5 kHz.
- Font: Fraunces (SIL Open Font License), in `assets/fonts/`.
