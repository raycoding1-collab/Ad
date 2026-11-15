// AURAMANTRA massage point: a 24-second paper reel (9:16). One woman carries her whole week through a
// grey, rainy city; one warm window glows; inside, the knots come undone; the long strokes of lomi lomi
// roll out as waves and bring the world's colour back; she goes home light. Pulled back, the little
// planet is half grey and half in bloom, with one warm point between them, where a paper lotus opens.
// Times come from src/timeline.js (generated from film/film.json).
import { monotone, track, noise, fbm, smooth, sramp, clamp, spring, hash, rng, lerp, mix, shade, rgb, DEG } from './util.js';
import { put, ellipse, strip, makeCanvas, release } from './paper.js';
import { KINDS } from './cutouts.js';
import { LOOKS } from './people.js';
import './kinds_nature.js';
import './kinds_built.js';
import './kinds_modern.js';
import './kinds_china.js';
import { tangle, HOUSE, BLOOM, rect } from './kinds_aura.js';
import { makeFx } from './sky_china.js';
import { BlurSheet } from './engine.js';
import { EV, DURATION, CARDS, BRAND } from './timeline.js';

const ev = (k, d) => EV[k] ?? d;
const E = [];
const add = (kind, layer, a, o = {}) => { const e = { kind, layer, a, ...o }; E.push(e); return e; };
const R = rng(11);
function grassRun(a0, a1, step, layer, o = {}) { for (let a = a0; a < a1; a += step * (0.7 + R() * 0.8)) { if (o.skip && o.skip(a)) continue; add('grass', layer, a, { v: (R() * 6) | 0, z: R() < 0.5 ? 1 : 3, flip: R() < 0.5, scale: (o.s || 1) * (0.8 + R() * 0.5), loud: 0.2, ...(o.o || {}) }); } }
const HOOK = { lights: [], sky: [], ground: [], over: [] };
const hook = (o) => { for (const k in o) HOOK[k].push(o[k]); };
const drop = (t, t0, t1 = 1e9) => clamp(spring(t - t0, 5.5, 0.42), 0, 1.4) - (t > t1 ? spring(t - t1, 4, 0.7) * 1.4 : 0);
const flick = (t, s) => 0.84 + 0.16 * fbm(t * 7.3 + s, 60) + 0.05 * Math.sin(t * 31 + s);
const por = (st) => st.aspectK < 0.4; // the reel is upright; the page also works sideways for checking

// --------------------------------------------------------------- places ---
const A_HOUSE = 36, A_DOOR = A_HOUSE + (HOUSE.door[0] + HOUSE.door[1]) / 2 / 17.45, A_WIN = A_HOUSE + (HOUSE.win[0] + HOUSE.win[2]) / 2 / 17.45;
const A_STOP = A_HOUSE - 7.0, A_STACK = A_STOP - 2.6;
const A_ROOM = 58, A_OUT = 74;
const T = {
  arrive: ev('arrive', 4.7), setDown: ev('setDown', 5.1), walk2: ev('walk2', 6.1), doorOpen: ev('doorOpen', 6.9), walkIn: ev('walkIn', 7.45), doorClose: ev('doorClose', 7.9),
  travel1: ev('travel1', 8), knotIn: ev('knotIn', 9.6), untie: ev('untie', [10.4, 12.2]), knotOut: ev('knotOut', 12.9),
  oil: ev('oil', 13.3), drop: ev('drop', 13.75), waves: ev('waves', [14.4, 15.4, 16.4]), exit: ev('exit', 17.3), pull: ev('pull', 20.4), lotus: ev('lotus', 21.3), logo: ev('logo', 22),
};

// ------------------------------------------------------------------ camera ---
const cam = monotone([
  // the week: walking with her through the rain
  [0, A_STOP - 4.7 * 4 - 0.3], [T.arrive, A_STOP - 0.2], [T.walk2, A_STOP + 1.6], [T.walkIn, A_DOOR - 1.6], [8.05, A_DOOR - 1.1],
  // inside: the room
  [8.75, A_ROOM - 1], [12.9, A_ROOM + 0.4], [13.6, A_ROOM + 1], [16.8, A_ROOM + 4],
  // home, light
  [18, A_OUT - 4], [20.4, A_OUT + 4], [24.5, A_OUT + 9], [40, A_OUT + 20],
]);
// how close the camera is: close on her for the hook, back a little for the house, close in the room
const zoomK = track([[0, 1.82], [3.4, 1.74], [4.8, 1.5], [6.2, 1.42], [7.6, 1.5], [8.05, 1.52], [8.7, 1.62], [12.9, 1.72], [13.6, 1.6], [16.8, 1.3], [17.6, 1.5], [20.4, 1.4]]);

// ------------------------------------------------- paint and shape of land --
// The grey street, the house, the room, and the world beyond that gets its colour back.
const GREY = [104, 104, 106], STREET = [92, 92, 98], BLOOMG = [150, 168, 104];
let NOW = 0; // film time, for the ground's colour coming back
const bloomK = (a, t) => { // how much colour has come back at angle a: the waves roll outwards from the room
  let k = 0;
  T.waves.forEach((tw, i) => { const reach = (t - tw) * 26; k = Math.max(k, (i + 1) / 3 * sramp(reach - (a - A_ROOM - 6), 0, 6)); });
  return k * sramp(a, A_ROOM + 4, A_ROOM + 9);
};
function ground(layer, a) {
  const city = a < A_HOUSE + 9, c0 = city ? STREET : mix(GREY, [130, 120, 108], sramp(a, A_ROOM - 10, A_ROOM)), k = city ? 0 : bloomK(a, NOW);
  const c = mix(c0, mix(BLOOMG, [176, 160, 110], 0.5 + 0.5 * noise(a * 0.2, 4)), k);
  if (layer === 'main') return c;
  if (layer === 'mid') return mix(shade(c, 0.05), [150, 152, 160], city ? 0.22 : 0.12 * (1 - k));
  if (layer === 'far') return mix(c, [150, 154, 166], city ? 0.5 : 0.4 - 0.2 * k);
  if (layer === 'front') return shade(c, -0.36);
  return shade(c, -0.55);
}
const profile = {
  far: (a) => noise(a * 0.11, 5) * 10 + 14 + sramp(a, A_ROOM, A_ROOM + 20) * (Math.abs(noise(a * 0.3, 41)) * 40 + 10),
  mid: (a) => noise(a * 0.33, 3) * 3 + sramp(a, A_ROOM + 6, A_ROOM + 18) * (noise(a * 0.2, 9) * 14 + 10),
  main: (a) => noise(a * 0.9, 1) * 0.8 + sramp(a, A_ROOM + 10, A_ROOM + 20) * noise(a * 0.21, 2) * 3,
  front: (a) => noise(a * 0.5, 7) * 4 + noise(a * 0.13, 17) * 6,
  core: (a) => noise(a * 0.2, 8) * 8,
};

// ===================================================== 1. The week ===
const LAMPS = [9.5, 17, A_STOP - 4.4];
// A grey street in Budapest's tenth district, in the rain. She walks under a swaying tower of
// everything the week left on her: and on her shoulder, a red knot.
const walkA = monotone([[0, A_STOP - 4.7 * 4], [T.arrive - 0.35, A_STOP - 0.5], [T.arrive, A_STOP], [T.walk2, A_STOP], [T.walk2 + 0.3, A_STOP + 0.9], [T.walkIn - 0.25, A_DOOR - 0.5], [T.walkIn + 0.25, A_DOOR + 0.3], [9, A_DOOR + 0.3]]);
const leanOf = (t) => lerp(17, 0, sramp(t, T.setDown + 0.2, T.setDown + 1.0)); // bent under it, then upright
const walking = (t) => t < T.arrive - 0.05 || (t > T.walk2 && t < T.walkIn + 0.25);
{
  const her = add('au_her', 'main', 0, {
    v: 'auHer', z: 2, scale: 1.15, popAt: -3, to: T.doorClose + 0.25, pace: 4.3, loud: 0,
    move: (t) => walkA(clamp(t, 0, 9)),
    act: (t) => {
      const w = walking(t), lean = leanOf(t) - (t > T.walk2 ? 3 : 0), ph = t < T.walk2 ? t * 4.3 + 1.7 : 4.3 * T.walk2 + 1.7 + (t - T.walk2) * 6.6;
      const o = { lean, head: lerp(12, -4, sramp(t, T.setDown + 0.3, T.setDown + 1)) - 14 * sramp(t, ev('glimpse', 3.6), ev('glimpse', 3.6) + 0.5) * (1 - sramp(t, T.setDown, T.setDown + 0.4)), knot: 1 };
      if (w) Object.assign(o, { walk: ph });
      const walking_ = w;
      // arms reach back to hold the tower; once it is down, a long stretch, then they fall loose
      const hold = 1 - sramp(t, T.setDown, T.setDown + 0.5), str = sramp(t, T.setDown + 0.7, T.setDown + 1.1) * (1 - sramp(t, T.setDown + 1.5, T.setDown + 2.0));
      o.back = [lerp(walking_ ? Math.sin(ph) * 22 : 4, 58, hold) - str * 150, lerp(-12, -72, hold) - str * 20];
      o.front = [lerp(walking_ ? -Math.sin(ph) * 22 : -6, 42, hold) - str * 160, lerp(-14, -80, hold) - str * 10];
      return o;
    },
  });
  her.a = 0;
  // the tower of the week rides on her back, then is set down behind her and stays there, in the rain
  const backPos = (t) => { const L = leanOf(t) * DEG, hgt = 74; return { da: (-12 + Math.sin(L) * hgt) * 1.15 / 17.45, h: Math.cos(L) * hgt * 1.15 }; };
  add('au_stack', 'main', 0, {
    z: 1.8, scale: 1.15, popAt: -3, loud: 0,
    move: (t) => { const tt = clamp(t, 0, 9), b = backPos(tt), down = sramp(tt, T.setDown, T.setDown + 0.45); return lerp(walkA(tt) + b.da - 0.15, A_STACK, down); },
    lift: (t) => { const tt = clamp(t, 0, 9), b = backPos(tt), down = clamp(spring(tt - T.setDown, 9, 0.5)), walking = tt < T.arrive; return lerp(b.h + (walking ? Math.abs(Math.cos(tt * 4.3 + 1.7)) * 2.2 : 0), 0, down); },
    rot: (t) => lerp(leanOf(clamp(t, 0, 9)) * 0.9, 0, sramp(t, T.setDown, T.setDown + 0.45)),
    sway: (t) => (t < T.arrive ? 1.4 : t < T.setDown ? 0.8 : 0.5 * Math.exp(-(t - T.setDown) * 1.2) + 0.12),
    ring: (t) => sramp(t, ev('alarm', 1.6), ev('alarm', 1.6) + 0.1) * (1 - sramp(t, ev('alarm', 1.6) + 1.1, ev('alarm', 1.6) + 1.3)),
  });
  // the street: lamps, the overhead line, a tram going the other way, people under umbrellas
  for (const a of LAMPS) add('lamp', 'main', a, { v: 1, z: 0.5, scale: 1.25, lit: () => 1 });
  for (let a = 4; a < 60; a += 7.2) add('au_tpole', 'mid', a, { z: 2, scale: 0.9, span: 7.2 });
  add('au_tram', 'mid', 40, { z: 3, scale: 0.72, popAt: -3, move: (t) => -clamp((t - ev('tram', 0.6)) * 4.6, 0, 30), wide: 20, to: 7.5 });
  // they pass behind her, going the other way (each leaves the street before the house)
  add('au_brolly', 'main', 19.5, { v: 'auBrollyA', z: 1.2, flip: true, scale: 1.08, pace: 5.4, move: (t) => -clamp(t * 1.5, 0, 9), to: 6 });
  add('au_brolly', 'main', 26.5, { v: 'auBrollyB', z: 1.2, flip: true, scale: 1.02, pace: 5.0, move: (t) => -clamp(t * 1.3, 0, 8), to: 7 });
  add('au_brolly', 'mid', 18, { v: 'auBrollyC', z: 3.5, flip: true, scale: 0.8, pace: 5.2, move: (t) => -clamp(t * 1.1, 0, 7), to: 7 });
  // Budapest behind: blocks of flats near, the city and the church spire far
  for (const [a, v, s] of [[2, 0, 0.78], [10.5, 3, 0.74], [17.5, 1, 0.82], [25, 2, 0.74], [33.5, 4, 0.7], [44, 5, 0.8], [51, 0, 0.72]]) add('au_block', 'mid', a, { v, z: 0, scale: s, lit: 0.22 });
  for (const [a, v, s] of [[-6, 4, 0.55], [6, 1, 0.6], [16, 5, 0.5], [30, 3, 0.56], [44, 0, 0.5], [56, 2, 0.6]]) add('au_block', 'far', a, { v, z: 0, scale: s, lit: 0.12 });
  add('au_church', 'far', 22, { z: 1, scale: 0.85 });
  for (let a = -6; a < A_HOUSE + 12; a += 4.2 + R() * 2.5) add('au_hedge', 'front', a, { v: (R() * 3) | 0, z: 1, scale: 0.9 + R() * 0.5, flip: R() < 0.5, loud: 0.2 });
  // the house with the warm window, and its door
  add('au_house', 'main', A_HOUSE, { z: 0.8, scale: 1.0, wide: 10, warm: (t) => 0.9 + 0.1 * sramp(t, ev('glimpse', 3.9), 4.6), door: (t) => sramp(t, T.doorOpen, T.doorOpen + 0.35) * (1 - sramp(t, T.doorClose, T.doorClose + 0.3)) });
  add('au_door', 'main', A_HOUSE, { z: 3, scale: 1.0, open: (t) => sramp(t, T.doorOpen, T.doorOpen + 0.35) * (1 - sramp(t, T.doorClose, T.doorClose + 0.3)), loud: 0.4 });

  hook({
    lights(t, c, L) {
      if (t > 9.5) return;
      for (const a of LAMPS) L.push({ a: a + 0.6, h: 130, r: 300, k: 0.8, color: [255, 206, 140] });
      // the warm window spills onto the wet pavement; the open door spills more
      const d = sramp(t, T.doorOpen, T.doorOpen + 0.35) * (1 - sramp(t, T.doorClose, T.doorClose + 0.3));
      L.push({ a: A_WIN, h: 60, r: 520, k: 0.85 * flick(t, 3), color: [255, 176, 100] });
      L.push({ a: A_DOOR, h: 40, r: 300 + 200 * d, k: 0.35 + 0.8 * d, color: [255, 196, 120] });
      L.push({ a: A_DOOR, h: 170, r: 120, k: 0.6, color: [255, 214, 150] });
    },
    ground(g, st, t, S, G) {
      if (t > 9.5) return;
      // puddles on the street, with the lamps and the window in them
      for (const [a, w] of [[8, 1.6], [13.5, 2.4], [19.4, 1.4], [A_STOP + 1.2, 2.2], [A_DOOR - 2, 1.8]]) {
        if (Math.abs(a - G.c) > st.visE + 4) continue;
        const [x, y] = G.rad(a, -3), rel = (a - G.c) * DEG;
        g.save(); g.translate(x, y); g.rotate(rel); g.scale(1, 0.18);
        g.fillStyle = 'rgba(40,46,58,.55)'; g.beginPath(); g.ellipse(0, 0, w * 17.45 * 0.5, 22, 0, 0, 7); g.fill();
        const near = Math.abs(a - A_WIN) < 4 || Math.abs(a - A_STOP) < 2;
        g.fillStyle = near ? 'rgba(255,190,120,.35)' : 'rgba(255,214,160,.18)'; g.beginPath(); g.ellipse(0, -4, w * 17.45 * 0.3, 9, 0, 0, 7); g.fill();
        // rings where the drops land
        const rain = 1 - sramp(t, ev('rainStop', 6.4) - 0.3, ev('rainStop', 6.4) + 0.6);
        g.strokeStyle = `rgba(220,230,240,${0.4 * rain})`; g.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) { const ph = ((t * 1.3 + hash(k * 7 + a) ) % 1); g.beginPath(); g.ellipse((hash(k + a * 3) - 0.5) * w * 12, 0, 3 + ph * 16, (3 + ph * 16) * 0.8, 0, 0, 7); g.globalAlpha = 1 - ph; g.stroke(); g.globalAlpha = 1; }
        g.restore();
      }
    },
  });
}

// ===================================================== 2. The warm window ===
// She sets the week down. The loose pages lift off the tower and turn into paper butterflies.
const BUTTER = (() => { const r = rng(606); return Array.from({ length: 14 }, (_, i) => ({ t0: ev('butterflies', 6.25) + i * 0.07 + r() * 0.1, dx: (r() - 0.5) * 1.6, vx: 0.4 + r() * 1.4, vy: 0.8 + r() * 0.6, ph: r() * 6, col: ['#efe6d2', '#f2d9a8', '#e9c2b8', '#d9d2ea', '#c8dcc8'][i % 5], s: 0.8 + r() * 0.5 })); })();
function butterfly(g, x, y, s, flap, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  for (const side of [-1, 1]) {
    g.save(); g.scale(side * (0.25 + 0.75 * Math.abs(flap)), 1);
    g.fillStyle = col; g.strokeStyle = 'rgba(90,70,50,.35)'; g.lineWidth = s * 0.3;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 4, -s * 7, s * 10, -s * 6, s * 8.5, -s * 1); g.bezierCurveTo(s * 9, s * 3, s * 5, s * 6, 0, s * 1.5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  g.fillStyle = '#4a3a30'; g.fillRect(-s * 0.5, -s * 2, s, s * 5);
  g.restore();
}
hook({
  over(g, st, t, S) {
    if (t < ev('butterflies', 6.25) - 0.1 || t > 19) return;
    const pu = Math.max(st.eu, Math.min(st.W, st.H) / 820);
    for (const b of BUTTER) {
      const age = t - b.t0; if (age < 0) continue;
      // each leaves the top of the tower as a page, flutters up and away to the right (towards the room)
      const [x0, y0] = st.place('main', A_STACK + b.dx, 230 * 1.15, t);
      const x = x0 + (b.vx * age * 60 + Math.sin(age * 2.2 + b.ph) * 26 + age * age * 26) * pu * 1.6, y = y0 - (b.vy * age * 90 - Math.sin(age * 3 + b.ph) * 14) * pu * 1.4;
      if (y < -40 || x > st.W + 60) continue;
      const fold = clamp(age / 0.45), s = b.s * pu * 2.4 * lerp(1.4, 1, fold);
      if (fold < 1) { g.save(); g.translate(x, y); g.rotate(age * 6 + b.ph); g.fillStyle = '#f2ead8'; g.globalAlpha = 1 - fold; g.fillRect(-s * 4, -s * 5, s * 8, s * 10); g.restore(); g.globalAlpha = 1; }
      butterfly(g, x, y, s, Math.sin(age * 13 + b.ph), b.col, Math.sin(age * 1.7 + b.ph) * 0.4);
    }
  },
});

// ===================================================== 3. The knots ===
// (built next)

// ===================================================== 4. Lomi lomi ===
// (built next)

// ===================================================== 5. Home, light ===
// (built next)

E.sort((p, q) => (p.z || 0) - (q.z || 0) || p.a - q.a);
const byLayer = {};
for (const e of E) (byLayer[e.layer] ||= []).push(e);

// -------------------------------------------------------- light, by stage ---
// No two stages share one sky: grey rain; the warm glow by the door; candle amber in the room;
// colour coming back with the waves; a golden late afternoon; a soft dawn for the whole planet.
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const LOOK = (sky, amb, grade, extra = {}) => ({ sky: sky.map(hx), amb, grade, ...extra });
const BASE = LOOK(['#3a4250', '#566070', '#7c8590', '#9a9ea2'], [150, 158, 176], [120, 140, 170, 0.22], { motes: 0 });
const ERAS = [
  [-5, 5.2, BASE],
  [5.2, 8.2, LOOK(['#3e4656', '#646a78', '#a48c84', '#d6a47a'], [196, 182, 178], [255, 170, 110, 0.12], { motes: 0.2, mote: [255, 200, 150] })], // the warm window: a break in the grey
  [8.2, 14.2, LOOK(['#2a2638', '#4a3a52', '#8a5a5c', '#c08060'], [132, 108, 100], [255, 160, 100, 0.2], { motes: 0.9, mote: [255, 196, 130] })],  // the room: candle amber
  [14.2, 17.4, LOOK(['#6c78b0', '#b49ac0', '#efb8b0', '#f8d2b0'], [250, 232, 226], [255, 190, 190, 0.12], { motes: 0.6, mote: [255, 220, 230] })], // the waves: colour comes back
  [17.4, 20.6, LOOK(['#5f9ad2', '#a4c6e0', '#f6d8b0', '#ffc88c'], [255, 244, 228], [255, 190, 120, 0.14], { motes: 0.8, mote: [255, 226, 170], rays: 0.9 })], // home, light: golden
  [20.6, 30, LOOK(['#28305a', '#4c4c80', '#b88aa8', '#f2bea0'], [244, 226, 220], [255, 190, 170, 0.1], { motes: 0.3 })], // the whole planet: a soft dawn
];
const mixA = (a, b, k) => a.map((v, i) => (Array.isArray(v) ? mixA(v, b[i], k) : v + (b[i] - v) * k));
function eraLook(t) {
  let { sky, amb, grade } = BASE, mote = [255, 220, 180], motes = 0, rays = 0;
  for (const [t0, t1, L] of ERAS) {
    const k = sramp(t, t0 - 0.6, t0 + 0.6) * (1 - sramp(t, t1 - 0.6, t1 + 0.6)); if (k <= 0.001) continue;
    sky = mixA(sky, L.sky, k); amb = mixA(amb, L.amb, k); grade = mixA(grade, L.grade, k);
    if (L.mote) mote = mixA(mote, L.mote, k);
    motes += ((L.motes ?? 0) - motes) * k; if (L.rays) rays = Math.max(rays, L.rays * k);
  }
  return { sky, amb, grade, mote, motes, rays };
}

function state(t, stage) {
  NOW = t;
  const c = cam(t), lights = [], emitters = [], smoke = [];
  for (const f of HOOK.lights) f(t, c, lights, emitters, smoke, stage);
  const zoom = zoomK(t) / stage.zm; // the stage's own close-up for tall screens is folded into the track
  const lk = eraLook(t), pull = sramp(t, T.pull, T.pull + 2.6);
  let sun = null;
  if (lk.rays > 0.01 && stage && stage.W) sun = { x: (stage.W * 0.22 - stage.cx) / stage.u, y: (stage.H * 0.3 - stage.hy) / stage.u, k: lk.rays * sramp(t, 17.6, 18.4) * (1 - sramp(t, 20.2, 20.8)), noDisc: true };
  return {
    fire: { lit: 0, reach: 0, blow: 0 }, lights, emitters, smoke,
    sky: lk.sky, ambient: lk.amb, ground: null,
    stars: pull * 0.5, sun, cloud: 1 - sramp(t, 7, 9) * 0.5, snow: 0,
    motes: lk.motes, moteColor: lk.mote,
    emit: true, screen: 0, blink: 0, bloom: 0.22 + 0.2 * sramp(t, 8, 9) * (1 - sramp(t, 13.5, 14.5)), grade: lk.grade, rays: 1,
    zoom, pull, rustle: 0, shake: 0,
    fade: 0,
  };
}

const clouds = [
  { v: 0, x: -520, yf: 0.62, s: 1.1, par: 2.2, drift: 3.0 },
  { v: 1, x: 260, yf: 0.76, s: 0.9, par: 1.6, drift: 2.2 },
  { v: 2, x: 820, yf: 0.55, s: 1.2, par: 2.6, drift: 3.6 },
  { v: 3, x: -1050, yf: 0.82, s: 0.8, par: 1.4, drift: 1.8 },
];

// ------------------------------------------------------------- the cards ---
// Each line hangs on two threads: a cut card of cream paper, dropped in on its line and lifted away.
// They hang below Instagram's top bar and clear of the buttons down the right.
const CARD_CACHE = new Map();
function cardSprite(i, st) {
  const key = i + '|' + st.W;
  if (CARD_CACHE.has(key)) return CARD_CACHE.get(key);
  const text = CARDS[i].text, s = st.W / 560, w = 470, h = 108;
  const sh = new BlurSheet('card' + i, [-w / 2, -h / 2, w / 2, h / 2], s, { pad: 14 }, 0);
  sh.piece([[-w / 2, -h / 2 + 3], [-w / 4, -h / 2 - 1], [w / 4, -h / 2 + 2], [w / 2, -h / 2], [w / 2 - 2, h / 2 - 2], [w / 5, h / 2 + 1], [-w / 3, h / 2 - 1], [-w / 2 + 2, h / 2]], '#f3ead8', { round: 3, rough: 1.2, seg: 60, lift: 3, thick: 2.2, paint: (g) => {
    g.fillStyle = '#2e241e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 52; g.font = `italic 460 ${fs}px Fraunces`; while (g.measureText(text).width > w - 56 && fs > 30) { fs -= 2; g.font = `italic 460 ${fs}px Fraunces`; }
    g.fillText(text, 0, 2);
    g.fillStyle = 'rgba(177,48,42,.85)'; g.beginPath(); g.arc(0, h / 2 - 15, 2.6, 0, 7); g.fill();
  } });
  const spr = sh.finish({ shadowBlur: 7 });
  CARD_CACHE.set(key, spr); return spr;
}
function hangCard(g, st, spr, x, y, swing, alpha = 1) {
  const sc = st.W / 560;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(swing);
  g.strokeStyle = 'rgba(214,204,186,0.5)'; g.lineWidth = Math.max(1, st.W / 720);
  for (const dx of [-spr.w * 0.36, spr.w * 0.36]) { g.beginPath(); g.moveTo(dx * sc, -40 * sc); g.lineTo(dx * sc - Math.sin(swing) * (y + 60), -y - 60); g.stroke(); }
  g.scale(sc, sc); put(g, spr, 0.3, 5, 8);
  g.restore(); g.globalAlpha = 1;
}
function cards(g, st, t) {
  CARDS.forEach((c, i) => {
    if (t < c.t0 - 0.05 || t > c.t1 + 1.2) return;
    const k = drop(t, c.t0, c.t1), y = st.H * lerp(-0.12, 0.17, k);
    if (y < -st.H * 0.1) return;
    hangCard(g, st, cardSprite(i, st), st.W * 0.47, y, Math.sin(t * 1.1 + i) * 1.6 * DEG + (1 - clamp(k)) * 4 * DEG);
  });
}

// ------------------------------------------------------- sky and the air ---
function sky(g, st, t, S) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const f of HOOK.sky) f(g, st, t, S);
}
function groundFx(g, st, t, S) {
  const c = cam(t), rad = (a, h) => { const rel = (a - c) * DEG, r = 1000 + profile.main(a) + h; return [Math.sin(rel) * r, -Math.cos(rel) * r]; };
  const vis = st.visE + 4, from = c - vis, to = c + vis;
  const run = (a0, a1, fn) => { const s0 = Math.max(a0, from), s1 = Math.min(a1, to); if (s0 < s1) fn(s0, s1); };
  const GF = { c, rad, run, t, S };
  // the kerb along the street
  run(-20, A_HOUSE + 8, (a0, a1) => { g.save(); g.strokeStyle = 'rgba(200,200,205,.18)'; g.lineWidth = 2; g.beginPath(); for (let a = a0; a <= a1; a += 0.3) { const [x, y] = rad(a, -1); a === a0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.restore(); });
  for (const f of HOOK.ground) f(g, st, t, S, GF);
}

// rain: thin slanting strokes of cellophane-grey paper, and splashes along the street
const WX = [['rain', -5, ev('rainStop', 6.4) + 0.5], ['petals', 17.6, 26]];
function weather(g, st, t) {
  const { W, H } = st, u = st.eu, cx = st.cx, cy = st.ecy, Rr = st.eR, fr = (x) => x - Math.floor(x);
  const pu = Math.max(u, Math.min(W, H) / 820);
  for (const [kind, t0, t1] of WX) {
    const k = sramp(t, t0, t0 + 1) * (1 - sramp(t, t1 - 1.2, t1)); if (k < 0.01) continue;
    g.save();
    if (kind === 'rain') {
      g.lineCap = 'round';
      for (let i = 0; i < 170; i++) {
        const sp = 0.75 + hash(i * 3) * 0.5, depth = hash(i * 11), x = W * (fr(hash(i) - t * 0.03) * 1.2 - 0.1), y = (fr(hash(i * 7) + t * 0.9 * sp) * 1.15 - 0.08) * H;
        const len = (18 + depth * 30) * pu, dx = len * 0.18;
        g.strokeStyle = `rgba(214,222,236,${(0.16 + depth * 0.3) * k})`; g.lineWidth = (0.7 + depth * 1.1) * pu;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx, y + len); g.stroke();
      }
      // splashes on the street
      for (let i = 0; i < 46; i++) {
        const ph = fr(t * 2.2 + hash(i * 5)), x = W * hash(i * 13 + Math.floor(t * 2.2 + hash(i * 5)) * 7), dxs = x - cx;
        if (Math.abs(dxs) > Rr) continue;
        const y = cy - Math.sqrt(Rr * Rr - dxs * dxs) + (4 + hash(i) * 26) * u;
        g.strokeStyle = `rgba(220,228,240,${0.5 * k * (1 - ph)})`; g.lineWidth = 1.1 * pu;
        g.beginPath(); g.ellipse(x, y, (2 + ph * 9) * pu, (1 + ph * 3) * pu, 0, Math.PI, 0); g.stroke();
      }
    } else if (kind === 'petals') {
      for (let i = 0; i < 40; i++) {
        const sp = 0.6 + hash(i * 3) * 0.8, x = W * (1.15 - fr(hash(i) + t * 0.03 * sp) * 1.3) + Math.sin(t * 1.3 * sp + i) * 14 * u, y = H * fr(hash(i * 7) + t * 0.05 * sp) - 20 * u;
        g.save(); g.translate(x, y); g.rotate(t * 2.2 * sp + i); g.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(t * 3 * sp + i))); g.globalAlpha = 0.9 * k;
        g.fillStyle = ['#f6ccd2', '#fbe2e6', '#f2d2a8', '#e2d4f0'][i % 4]; g.beginPath(); g.ellipse(0, 0, 5.2 * pu, 3.4 * pu, 0, 0, 7); g.fill(); g.restore();
      }
    }
    g.restore();
  }
}

function overFx(g, st, t, S) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  weather(g, st, t);
  for (const f of HOOK.over) f(g, st, t, S);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  cards(g, st, t);
}

function shadowDx(e, a, t, S) {
  let dx = 0;
  if (t < 9 && Math.abs(a - A_WIN) < 8) dx += clamp((a - A_WIN) / 3, -1, 1) * 8;
  if (S.sun && S.sun.k > 0) dx -= Math.sign(S.sun.x) * 7 * S.sun.k;
  return e.flip ? -dx : dx;
}

function bake(mk, mkSoft, stage) {
  const mkBig = (name, box, o = {}) => new BlurSheet(name, box, Math.max(1.4, Math.min(stage.W * 0.62, stage.H * 0.56) / 270 * 1.15), o, 0);
  CARD_CACHE.forEach((s) => { release(s.img); release(s.shadow); }); CARD_CACHE.clear();
  return makeFx(mk, mkSoft, mkBig, stage);
}

// For the sound build: every paper flap (a cut-out springing up or folding), and her footsteps.
function soundEvents(stage) {
  const flaps = [];
  for (const e of E) {
    const loud = e.loud ?? 1; if (loud <= 0) continue;
    const t0 = e.tPop; if (t0 > 0 && t0 < DURATION) flaps.push({ t: +t0.toFixed(3), layer: e.layer, loud, a: e.a });
    const f = e.foldAt ?? e.to; if (f !== undefined && f > 0 && f < DURATION) flaps.push({ t: +f.toFixed(3), layer: e.layer, loud: loud * 0.8, a: e.a, fold: 1 });
  }
  return { flaps, cam: Array.from({ length: Math.ceil(DURATION * 10) }, (_, i) => +cam(i / 10).toFixed(2)) };
}

export const film = { horizon: (aspect) => lerp(0.735, 0.68, sramp(aspect, 0.6, 1.5)), titleT: 2, keepFull: () => false, duration: DURATION, cam, state, entities: E, byLayer, profile, ground, clouds, bake, shadowDx, body: [92, 74, 60], soundEvents, fx: { sky, ground: groundFx, over: overFx } };
