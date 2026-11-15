// The reel's stage. It is rendered to a 1080x1920 video by tools/render.mjs, frame by frame:
//   ?t=SECONDS   freezes one frame (contact sheets, close-ups)
//   ?play        plays in real time from ?from=SECONDS (silent preview, for checking motion)
// window.__renderAt(t) renders any time; window.__soundEvents() lists the paper flaps and steps for the sound build.
import { Stage } from './engine.js';
import { film } from './film.js';
import { DURATION } from './timeline.js';

const canvas = document.getElementById('stage');
const params = new URLSearchParams(location.search);
const frozen = params.has('t') ? parseFloat(params.get('t')) : null;
const play = params.has('play'), from = parseFloat(params.get('from') || '0');

// every face the cards use, loaded before anything is cut, so no card is ever baked in a fallback font
const FACES = ['500 40px Fraunces', 'italic 400 40px Fraunces', 'italic 600 40px Fraunces', '300 40px Fraunces', '600 40px Fraunces'];
await Promise.all(FACES.map((f) => document.fonts.load(f, 'ÁÉÍÓÖŐÚÜŰáéíóöőúüű')));

const stage = new Stage(canvas, film);
stage.bakeBudget = 40;
window.__stage = stage;
window.__renderAt = (t) => { stage.lastT = -1; stage.render(t); };
window.__duration = DURATION;
window.__soundEvents = () => film.soundEvents(stage);

let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { stage.lastT = -1; stage.resize(); if (frozen !== null) stage.render(frozen); }, 150); });

const t0 = performance.now();
function frame(now) {
  const t = frozen !== null ? frozen : play ? (from + (now - t0) / 1000) % DURATION : 0;
  stage.render(t);
  if (frozen === null && play) requestAnimationFrame(frame);
  else window.__ready = true;
}
requestAnimationFrame(frame);
