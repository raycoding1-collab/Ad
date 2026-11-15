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
const A_ROOM = 58, A_EDGE = A_ROOM + 8.6; // the room, and its right-hand side where the world begins again
const WAVE = 9; // how fast each wave of colour rolls out over the world, degrees a second
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
  [8.75, A_ROOM - 0.6], [12.9, A_ROOM + 0.2], [13.6, A_ROOM + 0.3], [14.3, A_ROOM + 1.2], [15.4, A_ROOM + 6.5], [16.8, A_ROOM + 8],
  // home, light, and the whole planet
  [17.3, A_ROOM + 8.6], [20.4, A_ROOM + 12.4], [25.5, A_ROOM + 13.6], [40, A_ROOM + 20],
]);
// how close the camera is: close on her for the hook, back a little for the house, close in the room
const zoomK = track([[0, 3.05], [1.5, 2.5], [3.4, 2.4], [4.8, 1.86], [6.2, 1.74], [7.6, 1.95], [8.05, 2.1], [8.75, 3.35], [12.9, 3.5], [13.5, 3.6], [14.3, 3.0], [15.4, 1.85], [16.8, 1.8], [17.4, 2.2], [20.4, 2.05]]);

// ------------------------------------------------- paint and shape of land --
// The grey street, the house, the room, and the world beyond that gets its colour back.
const GREY = [104, 104, 106], STREET = [92, 92, 98], BLOOMG = [150, 168, 104];
let NOW = 0; // film time, for the ground's colour coming back
// Each layer turns at its own speed, so each has its own line where the colour starts: chosen so that
// all three meet at the top of the planet when it is seen whole.
const SPLIT = { main: A_EDGE, front: A_EDGE, core: A_EDGE, mid: A_ROOM + 13, far: A_ROOM + 18.5 };
const waveAt = (i, a, A0) => T.waves[i] + Math.max(0, a - A0) / WAVE; // when wave i reaches angle a
const bloomK = (a, t, A0 = A_EDGE) => { // how much colour has come back at angle a
  if (a < A0 - 1) return 0;
  let k = 0;
  T.waves.forEach((tw, i) => { const reach = (t - tw) * WAVE; k = Math.max(k, (0.45 + 0.55 * i / 2) * sramp(reach - (a - A0), -0.5, 2.5)); });
  // whatever the waves have not reached by the time we pull back comes in with the pull
  k = Math.max(k, sramp(t, T.pull + 0.4 + Math.max(0, a - A0) * 0.004, T.pull + 2.2 + Math.max(0, a - A0) * 0.004));
  return k * sramp(a, A0 - 1, A0 + 1);
};
function ground(layer, a) {
  const A0 = SPLIT[layer], k = bloomK(a, NOW, A0);
  const c0 = a < A_HOUSE + 9 ? STREET : mix(GREY, [120, 112, 104], sramp(a, A_ROOM - 10, A_ROOM) * (1 - sramp(a, A_EDGE, A_EDGE + 2)));
  const c = mix(c0, mix(BLOOMG, [184, 168, 112], 0.5 + 0.5 * noise(a * 0.2, 4)), k);
  if (layer === 'main') return c;
  if (layer === 'mid') return mix(shade(c, 0.05), [150, 152, 160], 0.22 * (1 - k) + 0.06);
  if (layer === 'far') return mix(c, [150, 154, 166], 0.5 - 0.25 * k);
  if (layer === 'front') return shade(c, -0.36);
  return shade(c, -0.55);
}
const profile = {
  far: (a) => noise(a * 0.11, 5) * 10 + 14 + sramp(a, SPLIT.far, SPLIT.far + 10) * (Math.abs(noise(a * 0.3, 41)) * 50 + 14),
  mid: (a) => noise(a * 0.33, 3) * 3 + sramp(a, SPLIT.mid, SPLIT.mid + 8) * (noise(a * 0.2, 9) * 14 + 12),
  main: (a) => noise(a * 0.9, 1) * 0.8 + sramp(a, A_EDGE + 3, A_EDGE + 12) * noise(a * 0.21, 2) * 3,
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
  add('au_brolly', 'mid', 21, { v: 'auBrollyA', z: 3.4, flip: true, scale: 0.86, pace: 5.4, move: (t) => -clamp(t * 1.2, 0, 8), to: 7 });
  add('au_brolly', 'mid', 12.5, { v: 'auBrollyC', z: 3.5, flip: true, scale: 0.82, pace: 5.2, move: (t) => -clamp(t * 1.1, 0, 7), to: 7 });
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
      const fold = clamp(age / 0.45), s = b.s * pu * 3.6 * lerp(1.4, 1, fold);
      if (fold < 1) { g.save(); g.translate(x, y); g.rotate(age * 6 + b.ph); g.fillStyle = '#f2ead8'; g.globalAlpha = 1 - fold; g.fillRect(-s * 4, -s * 5, s * 8, s * 10); g.restore(); g.globalAlpha = 1; }
      butterfly(g, x, y, s, Math.sin(age * 13 + b.ph), b.col, Math.sin(age * 1.7 + b.ph) * 0.4);
    }
  },
});

// ===================================================== 3. The knots ===
// Inside, warm: candlelight, the paper lamp, the rain on the window. She lies face down; the practitioner,
// behind the table, works at the knot on her shoulder until it comes loose. Up close, it is drawn out
// into one smooth thread.
const untieK = (t) => sramp(t, T.untie[0], T.untie[1]); // 0 knotted .. 1 undone
const stroke = (t) => { // which long stroke is under way, and how far along: { i, s } (s in 0..1 out, then back)
  for (let i = T.waves.length - 1; i >= 0; i--) { const d = t - (T.waves[i] - 0.45); if (d >= 0 && d < 1) return { i, s: d }; }
  return null;
};
{
  add('au_room', 'main', A_ROOM, { z: 0.5, wide: 12, loud: 0.8, warm: () => 1, day: (t) => sramp(t, T.waves[0] + 0.3, T.waves[0] + 1.2) });
  add('au_couch', 'main', A_ROOM, {
    z: 1, wide: 8, loud: 0.6,
    client: (t) => 1 - sramp(t, T.exit - 0.2, T.exit + 0.05),
    knot: (t) => ({ k: 1 - untieK(t), show: 1 - sramp(t, T.untie[1] + 0.2, T.untie[1] + 0.9) }),
    // She stands still on the near side of the table, by the client's hips, facing her shoulders, feet planted.
    // Every movement comes from her arms and her weight, never from sliding along the table.
    pract: (t) => {
      const px = 18, face = -1, mixP = (a, b, k) => ({ lean: lerp(a.lean, b.lean, k), head: lerp(a.head, b.head, k), hands: a.hands.map((h, i) => [lerp(h[0], b.hands[i][0], k), lerp(h[1], b.hands[i][1], k)]) });
      // kneading the knot: slow, alternating presses, her body rocking gently into each one; softer as it gives
      const u = untieK(t), amp = 1 - 0.55 * u, w = t * 4.2, pA = (1 - Math.cos(w)) / 2, pB = (1 - Math.cos(w + Math.PI)) / 2;
      let P = { lean: 17 + 2 * Math.sin(w) * amp, head: 24, hands: [[-19 - 3 * u, -71.5 + pA * 2.2 * amp], [-27 - 3 * u, -71 + pB * 2.2 * amp]] };
      // the oil: hands cupped in front of her, then the palms rubbed together to warm it
      const rub = sramp(t, T.drop + 0.15, T.drop + 0.35) * Math.sin(t * 15) * 1.6;
      P = mixP(P, { lean: 4, head: 30, hands: [[-6 + rub, -82], [-9 - rub, -81.5]] }, sramp(t, T.oil - 0.35, T.oil + 0.15));
      // lomi lomi: one long flowing movement, shoulders to lower back, back up, and down again; hands never leave her
      const W0 = T.waves[0] - 0.45, W2 = T.waves[2] + 0.55;
      let pos = 0;
      if (t > W0) { const q = clamp((t - W0) / (W2 - W0)) * 3, i = Math.min(2, Math.floor(q)), f = smooth(q - i); pos = i % 2 ? 1 - f : f; }
      const S = { lean: lerp(24, 10, pos), head: lerp(24, 18, pos), hands: [[lerp(-32, -14, pos), -71 + Math.sin(pos * Math.PI) * 0.8], [lerp(-25, -8, pos), -70.5 + Math.sin(pos * Math.PI) * 0.8]] };
      P = mixP(P, S, sramp(t, W0 - 0.35, W0));
      // done: she lifts her hands and straightens
      P = mixP(P, { lean: 1, head: 6, hands: [[px - 4, -50], [px + 2, -50]] }, sramp(t, T.exit - 0.35, T.exit + 0.15));
      return { px, face, ...P };
    },
  });
  hook({
    lights(t, c, L) {
      if (t < 7.6 || t > T.pull + 3) return;
      L.push({ a: A_ROOM - 0.6, h: 176, r: 520, k: 0.9 * (0.93 + 0.07 * fbm(t * 2, 7)), color: [255, 196, 130] });
      L.push({ a: A_ROOM + 4.8, h: 76, r: 260, k: 0.8 * flick(t, 9), color: [255, 170, 90] });
      // the oil's warmth spreading through the room
      const pulse = Math.exp(-(((t - T.drop - 0.5) / 0.6) ** 2));
      L.push({ a: A_ROOM - 2, h: 100, r: 400 + 400 * pulse, k: 0.9 * pulse, color: [255, 200, 120] });
    },
  });
}
// The close-up: shoulders seen from above on a card; the red knot; two hands working it loose.
const KNOT_FX = { key: '', back: null, hand: null };
function knotSprites(st) {
  const key = st.W + 'x' + st.H; if (KNOT_FX.key === key) return KNOT_FX;
  for (const s of [KNOT_FX.back, KNOT_FX.hand]) if (s) { release(s.img); release(s.shadow); }
  const sc = st.W / 600, cw = 500, ch = 380, skin = '#d2a07a';
  const sh = new BlurSheet('knot-back', [-cw / 2, -ch / 2, cw / 2, ch / 2], sc, { pad: 16 }, 0);
  sh.piece([[-cw / 2, -ch / 2 + 6], [0, -ch / 2], [cw / 2, -ch / 2 + 4], [cw / 2 - 3, ch / 2], [0, ch / 2 - 2], [-cw / 2 + 2, ch / 2]], '#efe4cf', { round: 6, rough: 1.2, seg: 70, lift: 3, blotch: 0.35, grain: 0.4, thick: 2.4 });
  // the upper back from above: neck, the slope of the shoulders, shoulder blades, the line of the spine
  sh.piece([[-34, -ch / 2 + 22], [34, -ch / 2 + 22], [40, -112], [150, -86], [208, -40], [222, 30], [214, ch / 2 - 20], [-214, ch / 2 - 20], [-222, 30], [-208, -40], [-150, -86], [-40, -112]], skin, { round: 22, rough: 1.4, seg: 30, lift: 2.6, paint: (g) => {
    const gr = g.createRadialGradient(0, -40, 20, 0, -20, 260); gr.addColorStop(0, 'rgba(255,230,200,.25)'); gr.addColorStop(1, 'rgba(120,70,40,.3)'); g.fillStyle = gr; g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.strokeStyle = 'rgba(130,80,50,.35)'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(4, 40, 0, ch / 2 - 24); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 40, -60); g.quadraticCurveTo(s * 110, -70, s * 120, 10); g.quadraticCurveTo(s * 100, 60, s * 50, 70); g.stroke(); }
  } });
  sh.piece([[-cw / 2 + 6, ch / 2 - 40], [cw / 2 - 6, ch / 2 - 46], [cw / 2 - 4, ch / 2 - 4], [-cw / 2 + 4, ch / 2 - 2]], '#f6f1e6', { round: 4, lift: 2.2, paint: (g) => { g.strokeStyle = 'rgba(150,140,120,.3)'; g.lineWidth = 1; for (let x = -cw / 2 + 20; x < cw / 2; x += 18) { g.beginPath(); g.moveTo(x, ch / 2 - 40); g.lineTo(x + 4, ch / 2); g.stroke(); } } });
  KNOT_FX.back = { ...sh.finish({ shadowBlur: 10 }), cw, ch, sc };
  // a hand, palm down, fingers up
  const hs = new BlurSheet('knot-hand', [-48, -110, 40, 200], sc, { pad: 10 }, 0), hc = '#e2b48f';
  hs.piece([[-30, 200], [30, 200], [27, 30], [-27, 30]], '#d8cfbd', { round: 6, lift: 0, paint: (g) => { g.strokeStyle = 'rgba(150,130,100,.35)'; g.lineWidth = 1.4; for (let x = -18; x < 20; x += 12) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 3, 200); g.stroke(); } } });
  hs.piece([[-24, 34], [24, 34], [27, -20], [-27, -20]], hc, { round: 12, lift: 1.6 });
  [[-19, -26, -84, 8.6], [-6.5, -26, -100, 9], [6.5, -26, -96, 9], [19, -24, -74, 8]].forEach(([x, y0, y1, w]) => hs.piece([[x - w / 2, y0], [x + w / 2, y0], [x + w / 2 - 0.5, y1 + 4], [x, y1], [x - w / 2 + 0.5, y1 + 4]], hc, { round: 4.2, lift: 1.4, paint: (g) => { g.fillStyle = 'rgba(255,220,200,.35)'; g.beginPath(); g.ellipse(x, y1 + 6, w * 0.32, 4, 0, 0, 7); g.fill(); } }));
  hs.piece([[-24, 8], [-30, -2], [-46, -30], [-42, -36], [-24, -18], [-16, -6]], hc, { round: 5, lift: 1.6 });
  KNOT_FX.hand = hs.finish({ shadowBlur: 5 });
  KNOT_FX.key = key; return KNOT_FX;
}
function knotCard(g, st, t) {
  const k = sramp(t, T.knotIn - 0.1, T.knotIn + 0.5) * (1 - sramp(t, T.knotOut - 0.4, T.knotOut + 0.1)); if (k < 0.01) return;
  const { W, H } = st, F = knotSprites(st), B = F.back, sc = B.sc;
  // the room's own light behind it: dimmed, warm, with the candles still glowing at the edges
  g.fillStyle = `rgba(26,14,10,${0.58 * k})`; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const x = W * hash(i * 7 + 1), y = H * (0.25 + 0.6 * hash(i * 3 + 2)), f = 0.6 + 0.4 * Math.sin(t * (1 + hash(i)) + i); st.stamp(g, st.dot(255, 170, 90), x, y, W * (0.03 + 0.04 * hash(i * 5)), 0.35 * k * f); }
  g.globalCompositeOperation = 'source-over';
  const rise = drop(t, T.knotIn, T.knotOut - 0.35), cx = W * 0.5, cy = lerp(H * 1.25, H * 0.5, clamp(rise)) + (rise > 1 ? (rise - 1) * -H * 0.05 : 0);
  g.save(); g.translate(cx, cy); g.rotate(Math.sin(t * 0.8) * 0.8 * DEG); g.scale(sc, sc);
  put(g, B, 0.35, 6, 10);
  // the knot on the left shoulder, coming loose and drawn out to one smooth line
  const u = untieK(t), kx = -96, ky = -30;
  g.save(); g.translate(kx, ky);
  tangle(g, lerp(0, 96, smooth(u)), 0, 46, 380 * smooth(u), 1 - u, t, 7, 7, 1);
  g.restore();
  // the hands: pressing, small circles; as it gives they slide out along the thread and lift away
  const ease = smooth(clamp((u - 0.15) / 0.85)), lift = sramp(t, T.untie[1] - 0.5, T.untie[1] + 0.1), w = t * 3.4; // the hands are gone before the card drops away
  for (const [side, ph] of [[-1, 0], [1, 3]]) {
    const press = 1 - 0.03 * Math.max(0, Math.sin(w + ph)) * (1 - ease);
    const hx = kx + side * (50 + ease * 70) + Math.cos(w + ph) * 6 * (1 - ease), hy = ky - 34 + Math.sin(w + ph) * 4 * (1 - ease) - lift * 30;
    // both arms come from one body above: leaning in, never crossing
    g.save(); g.translate(hx, hy); g.rotate((180 + side * (7 - ease * 4)) * DEG); g.scale(press * (1 + lift * 0.12), press * (1 + lift * 0.12)); g.globalAlpha = 1 - lift;
    put(g, F.hand, 0.3 + lift * 0.3, 4 + lift * 10, 6 + lift * 14);
    g.restore();
  }
  g.restore();
}
hook({ over(g, st, t) { knotCard(g, st, t); } });

// ===================================================== 4. Lomi lomi ===
// A drop of warm oil falls into her palms, and a warm ring goes out from it: an aura. Then three long,
// flowing strokes, and with each one a wave rolls out of the room and the world gets its colour back.
hook({
  over(g, st, t) {
    if (t < T.oil - 0.1 || t > T.drop + 1.8) return;
    const { W, H } = st, [hx, hy] = st.place('main', A_ROOM + (-7.5) / 17.45, 84, t), pu = Math.max(st.eu, Math.min(W, H) / 820);
    // the drop: a bead of amber light, falling
    if (t < T.drop) {
      const k = clamp((t - T.oil) / (T.drop - T.oil)), y = lerp(-H * 0.04, hy, k * k), s = 6 * pu;
      g.globalCompositeOperation = 'lighter'; st.stamp(g, st.dot(255, 190, 90, '255,240,200'), hx, y, s * 6, 0.8); g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(hx, y); g.scale(s, s * (1 + k * 0.3));
      g.fillStyle = '#d9902c'; g.beginPath(); g.moveTo(0, -3.2); g.bezierCurveTo(1.6, -1, 2.2, 0.6, 2.2, 1.3); g.arc(0, 1.3, 2.2, 0, Math.PI); g.bezierCurveTo(-2.2, 0.6, -1.6, -1, 0, -3.2); g.fill();
      g.fillStyle = 'rgba(255,240,200,.85)'; g.beginPath(); g.ellipse(-0.7, 0.6, 0.5, 0.9, -0.3, 0, 7); g.fill();
      g.restore();
    }
    // the aura: warm rings going out from her hands, through the room and beyond the frame
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = t - T.drop - i * 0.22; if (a < 0 || a > 1.5) continue;
      const r = (a / 1.5) ** 0.7 * H * 0.9, al = (1 - a / 1.5) ** 1.6 * (0.5 - i * 0.12);
      const gr = g.createRadialGradient(hx, hy, Math.max(0, r - 40 * pu), hx, hy, r + 10 * pu);
      gr.addColorStop(0, 'rgba(255,190,100,0)'); gr.addColorStop(0.7, `rgba(255,200,120,${al})`); gr.addColorStop(1, 'rgba(255,190,100,0)');
      g.fillStyle = gr; g.fillRect(hx - r - 20, hy - r - 20, (r + 20) * 2, (r + 20) * 2);
    }
    const flash = Math.exp(-(((t - T.drop) / 0.12) ** 2));
    st.stamp(g, st.dot(255, 214, 140, '255,250,230'), hx, hy, 40 * pu, flash * 0.9);
    g.globalCompositeOperation = 'source-over';
  },
  // the waves: layered paper rolling along the ground, out of the room and across the grey
  ground(g, st, t, S, G) {
    const COL = [['#e9b26a', '#f6d7a2'], ['#e48f9a', '#f6c4c8'], ['#a993cc', '#d8cdea']];
    T.waves.forEach((tw, i) => {
      const age = t - tw; if (age < 0 || age > 9) return;
      const front = A_EDGE - 1.5 + age * WAVE, len = 9, h0 = 64, back = Math.max(front - len, A_EDGE + 0.2); // it starts at the room's edge, never inside it
      if (front <= back + 0.05 || back > G.c + st.visE + 6 || front < G.c - st.visE - 6) return;
      const fade = 1 - sramp(age, 6, 9), hOf = (a, dh) => (h0 + dh) * Math.sin(Math.PI * Math.min(1, (a - (front - len)) / len * 1.15)) ** 1.5;
      for (const [lay, dh, col, al] of [[0, 0, COL[i][0], 0.9], [1, -16, COL[i][1], 0.95], [2, -34, '#fbf4ea', 0.9]]) {
        g.fillStyle = col; g.globalAlpha = al * fade; g.beginPath();
        const steps = 40;
        for (let j = 0; j <= steps; j++) { const a = back + (j / steps) * (front - back), q = (a - (front - len)) / len, hh = hOf(a, dh) * (0.85 + 0.15 * Math.sin(q * 9 - t * 6)) * sramp(a, A_EDGE + 0.2, A_EDGE + 1.2); const [x, y] = G.rad(a, hh); j ? g.lineTo(x, y) : g.moveTo(x, y); }
        // the curl at the front
        const [cx, cy] = G.rad(front + 0.2, (h0 + dh) * 0.55), rr = (h0 + dh) * 0.45;
        g.arc(cx, cy, rr, -Math.PI * 0.9 + (front - G.c) * DEG, Math.PI * 0.5 + (front - G.c) * DEG);
        for (let j = steps; j >= 0; j--) { const a = back + (j / steps) * (front - back), [x, y] = G.rad(a, -4); g.lineTo(x, y); }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 0.8 * fade; g.strokeStyle = 'rgba(255,250,240,.95)'; g.lineWidth = 3.2; g.beginPath();
      for (let j = 0; j <= 30; j++) { const a = back + (j / 30) * (front - back), hh = hOf(a, -4) * sramp(a, A_EDGE + 0.2, A_EDGE + 1.2); const [x, y] = G.rad(a, hh); j ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.globalAlpha = 1;
    });
  },
});

// ===================================================== 5. Home, light ===
// The world the waves have reached: a meadow in the colours they brought, blossom, and a soft hill line.
{
  const popFor = (a, i, A0 = A_EDGE) => Math.min(waveAt(i, a, A0) + 0.15 + R() * 0.25, T.pull + 0.5 + Math.max(0, a - A0) * 0.006 + R() * 0.6);
  // flowers on the main ground: each wave brings its own colours
  for (let a = A_EDGE + 1.2; a < A_ROOM + 125; a += (a < A_ROOM + 40 ? 1.05 : 3.2) * (0.7 + R() * 0.6)) {
    const i = (R() * 3) | 0, col = [0, 1, 2, 3, 4, 5][i * 2 + ((R() * 2) | 0)];
    add('au_flower', 'main', a, { v: col * 4 + ((R() * 4) | 0), z: 1.5 + R(), scale: 0.95 + R() * 0.6, flip: R() < 0.5, popAt: popFor(a, i), loud: 0.35 });
  }
  for (let a = A_EDGE + 0.6; a < A_ROOM + 125; a += 2.2 * (0.7 + R() * 0.8)) add('grass', 'main', a, { v: (R() * 6) | 0, z: R() < 0.5 ? 1 : 3, flip: R() < 0.5, scale: 0.9 + R() * 0.5, popAt: popFor(a, 0), loud: 0.15 });
  // blossom trees and green trees, near and far
  for (const [a, v, s, i] of [[A_EDGE + 9, 0, 1.0, 1], [A_EDGE + 19, 1, 1.1, 1], [A_EDGE + 31, 2, 0.95, 2], [A_ROOM + 62, 0, 1, 2], [A_ROOM + 90, 1, 1, 2]]) add('apricot', 'main', a, { v, z: 0.8, scale: s, popAt: popFor(a, i), loud: 0.7 });
  for (let a = SPLIT.mid + 1; a < A_ROOM + 190; a += 5 + R() * 6) add(R() < 0.55 ? 'apricot' : 'oak', 'mid', a, { v: (R() * 3) | 0, z: 0.5, scale: 0.55 + R() * 0.2, popAt: popFor(a, 1, SPLIT.mid), loud: 0.3 });
  for (let a = SPLIT.far + 1; a < A_ROOM + 250; a += 7 + R() * 8) add('oak', 'far', a, { v: (R() * 3) | 0, z: 0.5, scale: 0.5 + R() * 0.2, popAt: popFor(a, 2, SPLIT.far), loud: 0.15 });
  for (let a = A_EDGE + 2; a < A_ROOM + 80; a += 3 + R() * 3) add('au_flower', 'front', a, { v: ((R() * 6) | 0) * 4 + ((R() * 4) | 0), z: 1, scale: 1.8 + R() * 0.6, popAt: popFor(a, (R() * 3) | 0), loud: 0.2 });
  // the grey side goes on round the planet: more of the city, for when it is seen whole
  for (let a = -6; a > -54; a -= 7 + R() * 4) add('au_block', 'mid', a, { v: (R() * 6) | 0, z: 0, scale: 0.7 + R() * 0.12, lit: 0.2 });
  for (let a = -14; a > -115; a -= 9 + R() * 6) add('au_block', 'far', a, { v: (R() * 6) | 0, z: 0, scale: 0.5 + R() * 0.1, lit: 0.12 });
  for (let a = -10; a > -60; a -= 6 + R() * 5) add('au_hedge', 'front', a, { v: (R() * 3) | 0, z: 1, scale: 0.9 + R() * 0.4 });

  // she goes home light: quick, springy steps, the knot gone, and a little skip
  const walk3 = monotone([[T.exit, A_EDGE - 0.6], [T.pull, A_ROOM + 13.2], [24.5, A_ROOM + 15], [30, A_ROOM + 15]]);
  const SKIP = ev('stretch', 18.6);
  add('au_her', 'main', 0, {
    v: 'auHer', z: 2.2, scale: 1.15, from: T.exit - 0.05, popAt: T.exit, loud: 0.6, pace: 5.6,
    move: (t) => walk3(clamp(t, T.exit, 30)),
    lift: (t) => Math.abs(Math.sin(t * 5.6 + 0.4)) * 3.5 + Math.max(0, Math.sin(clamp((t - SKIP) / 0.55) * Math.PI)) * 22,
    act: (t) => {
      const ph = t * 5.6 + 0.4, sk = Math.sin(clamp((t - SKIP) / 0.55) * Math.PI);
      return { walk: ph, lean: -2, head: -8 + Math.sin(t * 1.3) * 3, knot: 0, back: [Math.sin(ph) * 30 - sk * 120, -10 - sk * 30], front: [-Math.sin(ph) * 30 - sk * 140, -16 - sk * 20] };
    },
  });
  hook({
    lights(t, c, L) {
      if (t < T.waves[0]) return;
      for (const [i, tw] of T.waves.entries()) { const age = t - tw; if (age < 0 || age > 4) continue; L.push({ a: A_EDGE + age * WAVE - 1.5, h: 20, r: 260, k: 0.45 * (1 - age / 4), color: [[255, 200, 130], [255, 170, 170], [200, 180, 255]][i] }); }
    },
    // a few of the butterflies stay with her on the way home
    over(g, st, t) {
      if (t < T.exit + 0.3 || t > T.pull + 1) return;
      const pu = Math.max(st.eu, Math.min(st.W, st.H) / 820), fade = sramp(t, T.exit + 0.3, T.exit + 1) * (1 - sramp(t, T.pull, T.pull + 1));
      for (let i = 0; i < 4; i++) {
        const [x0, y0] = st.place('main', walk3(clamp(t, T.exit, 30)) + 0.5, 150 + i * 22, t);
        const x = x0 + Math.sin(t * (1.2 + i * 0.3) + i * 2) * 60 * pu + (i - 1.5) * 26 * pu, y = y0 + Math.cos(t * (1.6 + i * 0.2) + i) * 30 * pu;
        g.globalAlpha = fade; butterfly(g, x, y, (0.9 + 0.15 * i) * pu * 2.3, Math.sin(t * 13 + i * 2), BUTTER[i].col, Math.sin(t * 1.7 + i) * 0.4); g.globalAlpha = 1;
      }
    },
  });
}

// ===================================================== 6. The point ===
// Pulled back, the little planet: half of it still grey and raining, half of it in bloom, and between
// them one warm point. A paper lotus opens behind it and holds it, the way the logo holds its flower.
// [angle from upright, length in planet radii]: long at the centre, short at the sides, so the crown stays in an upright frame
const PETALS = [[-82, 1.22], [-60, 1.62], [-39, 2.02], [-19, 2.32], [0, 2.46], [19, 2.32], [39, 2.02], [60, 1.62], [82, 1.22]];
const LOTUS_FX = { key: '', petal: null, small: null };
function lotusSprites(st) {
  const key = st.W + 'x' + st.H; if (LOTUS_FX.key === key) return LOTUS_FX;
  for (const s of [LOTUS_FX.petal, LOTUS_FX.small]) if (s) { release(s.img); release(s.shadow); }
  const sc = st.W / 600;
  const petal = (name, len, wid, c0, c1) => {
    const sh = new BlurSheet(name, [-wid, -len, wid, 6], sc, { pad: 12 }, 0), pts = [];
    for (let i = 0; i <= 16; i++) { const q = i / 16, y = -q * len, x = wid * Math.sin(Math.PI * q ** 0.85) * (1 - 0.15 * q); pts.push([x, y]); }
    for (let i = 15; i >= 1; i--) { const [x, y] = pts[i]; pts.push([-x, y]); }
    sh.piece(pts, c0, { round: 4, rough: 0.8, seg: 30, lift: 2.4, thick: 2, paint: (g) => {
      const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,240,230,.1)'); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(-wid, -len, wid * 2, len);
      g.strokeStyle = 'rgba(160,110,100,.28)'; g.lineWidth = 1.2; for (const dx of [-0.35, 0, 0.35]) { g.beginPath(); g.moveTo(dx * wid * 0.3, -6); g.quadraticCurveTo(dx * wid * 0.9, -len * 0.5, dx * wid * 0.2, -len * 0.92); g.stroke(); }
    } });
    return sh.finish({ shadowBlur: 8 });
  };
  LOTUS_FX.petal = petal('lotus-petal', 300, 88, '#f6eee2', 'rgba(232,160,170,.75)');
  LOTUS_FX.small = petal('lotus-small', 170, 60, '#f3e6d6', 'rgba(226,150,160,.7)');
  LOTUS_FX.key = key; return LOTUS_FX;
}
const pullR = (st) => st.W * 0.36; // the planet's radius when seen whole
function lotus(g, st, t, front) {
  const k0 = sramp(t, T.lotus - 0.3, T.lotus + 0.2); if (k0 < 0.01) return;
  const F = lotusSprites(st), Rp = pullR(st), cx = st.cx, cy = st.ecy, base = cy + Rp * (front ? 1.04 : 0.7);
  const list = front ? [[-74, 0.78], [74, 0.78], [-46, 0.7], [46, 0.7]] : PETALS;
  list.forEach(([ang, len], i) => {
    const order = front ? 6 + i : Math.abs(ang) / 19.5, tt = t - T.lotus - order * 0.08;
    const open = clamp(spring(tt, 7, 0.5), 0, 1.25), a = ang * (front ? lerp(0.6, 1, Math.min(1, open)) + Math.max(0, open - 1) * 0.4 : open);
    if (tt < -0.05) return;
    g.save(); g.translate(cx, base); g.rotate(a * DEG); const s = (front ? Rp * 1.05 / 170 : Rp / 300) * len * lerp(0.55, 1, clamp(open));
    g.scale(s, s); g.globalAlpha = k0;
    put(g, front ? F.small : F.petal, 0.25, 4, 8);
    g.restore();
  });
}
function aura(g, st, t) {
  const k = sramp(t, T.pull + 1.2, T.pull + 2.6); if (k < 0.01) return;
  const Rp = pullR(st), cx = st.cx, cy = st.ecy, pul = 0.85 + 0.15 * Math.sin(t * 1.6);
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, Rp * 0.96, cx, cy, Rp * 1.55);
  gr.addColorStop(0, `rgba(255,200,140,${0.42 * k * pul})`); gr.addColorStop(0.35, `rgba(255,180,150,${0.16 * k * pul})`); gr.addColorStop(1, 'rgba(255,170,150,0)');
  g.fillStyle = gr; g.fillRect(cx - Rp * 1.6, cy - Rp * 1.6, Rp * 3.2, Rp * 3.2);
  g.globalCompositeOperation = 'source-over';
}
// the warm point: the room, glowing on the line between the grey and the colour
function warmPoint(g, st, t) {
  const k = sramp(t, T.pull + 0.6, T.pull + 2); if (k < 0.01) return;
  const [x, y] = st.place('main', A_ROOM, 70, t), pu = Math.min(st.W, st.H) / 820, pul = 0.8 + 0.2 * Math.sin(t * 2.4);
  g.globalCompositeOperation = 'lighter';
  st.stamp(g, st.dot(255, 170, 90), x, y, 70 * pu * pul, 0.7 * k);
  st.stamp(g, st.dot(255, 214, 150, '255,248,230'), x, y, 18 * pu, k);
  g.globalCompositeOperation = 'source-over';
}
// a little grey cloud still raining over the grey half
const RAINCLOUD = { c: null, src: null };
function rainCloud(g, st, t) {
  const k = sramp(t, T.pull + 1.4, T.pull + 2.6); if (k < 0.01) return;
  const Rp = pullR(st), x = st.cx - Rp * 0.86, y = st.ecy - Rp * 0.92, pu = Math.min(st.W, st.H) / 820, spr = st.fx.clouds[1];
  g.save(); g.globalAlpha = k; g.strokeStyle = 'rgba(200,210,225,.55)'; g.lineWidth = 1.4 * pu; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const ph = (t * 1.4 + hash(i * 3)) % 1, xx = x + (hash(i) - 0.5) * 80 * pu, yy = y + 10 * pu + ph * 70 * pu; g.globalAlpha = k * (1 - ph); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - 3 * pu, yy + 12 * pu); g.stroke(); }
  if (!RAINCLOUD.c || RAINCLOUD.src !== spr.spr.img) {
    const c = makeCanvas(spr.spr.img.width, spr.spr.img.height), cg = c.getContext('2d');
    cg.drawImage(spr.spr.img, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(70,78,92,.5)'; cg.fillRect(0, 0, c.width, c.height);
    if (RAINCLOUD.c) release(RAINCLOUD.c); RAINCLOUD.c = c; RAINCLOUD.src = spr.spr.img;
  }
  g.globalAlpha = k; g.translate(x, y); g.scale(pu * 1.05, pu * 1.05); put(g, { ...spr.spr, img: RAINCLOUD.c }, 0.2, 4, 6);
  g.restore();
}
// The name, last: cut cream letters glued onto the planet's cardboard face, with the lotus mark;
// below it a card like the others with what they do, where, and how to book.
const LOGO_FX = { key: '', spr: null };
function ctaSprite(st) {
  const key = st.W + 'x' + st.H; if (LOGO_FX.key === key) return LOGO_FX.spr;
  if (LOGO_FX.spr) { release(LOGO_FX.spr.img); release(LOGO_FX.spr.shadow); }
  const sc = st.W / 600, w = 440, h = 150;
  const sh = new BlurSheet('cta', [-w / 2, -h / 2, w / 2, h / 2], sc, { pad: 14 }, 0);
  const fit = (g, font, size, text, max) => { let fs = size; g.font = font(fs); while (g.measureText(text).width > max && fs > 12) { fs -= 1; g.font = font(fs); } };
  sh.piece([[-w / 2, -h / 2 + 3], [0, -h / 2 - 1], [w / 2, -h / 2 + 2], [w / 2 - 2, h / 2 - 2], [0, h / 2 + 1], [-w / 2 + 2, h / 2]], '#f6efe2', { round: 4, rough: 1.1, seg: 70, lift: 3, blotch: 0.35, grain: 0.4, thick: 2.4, paint: (g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#4a3e36'; fit(g, (f) => `italic 400 ${f}px Fraunces`, 26, BRAND.line, w - 50); g.fillText(BRAND.line, 0, -h / 2 + 30);
    g.fillStyle = '#4a3e36'; fit(g, (f) => `400 ${f}px Fraunces`, 23, BRAND.where, w - 50); g.fillText(BRAND.where, 0, -2);
    g.fillStyle = 'rgba(177,48,42,.85)'; g.fillRect(-22, 18, 44, 1.6);
    g.fillStyle = '#2a2420'; fit(g, (f) => `620 ${f}px Fraunces`, 28, BRAND.cta, w - 50); g.fillText(BRAND.cta, 0, h / 2 - 30);
  } });
  LOGO_FX.spr = sh.finish({ shadowBlur: 8 }); LOGO_FX.key = key; return LOGO_FX.spr;
}
function lotusMark(g, cx, cy, s) {
  for (const [a, l] of [[-64, 0.6], [-34, 0.86], [0, 1], [34, 0.86], [64, 0.6]]) { const ar = a * DEG, tx = cx + Math.sin(ar) * 30 * l * s, ty = cy - Math.cos(ar) * 34 * l * s; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.sin(ar - 0.5) * 22 * l * s, cy - Math.cos(ar - 0.5) * 22 * l * s, tx, ty); g.quadraticCurveTo(cx + Math.sin(ar + 0.5) * 22 * l * s, cy - Math.cos(ar + 0.5) * 22 * l * s, cx, cy); g.stroke(); }
  g.beginPath(); g.moveTo(cx - 28 * s, cy + 4 * s); g.quadraticCurveTo(cx, cy + 14 * s, cx + 28 * s, cy + 4 * s); g.stroke();
}
function logo(g, st, t) {
  // the title on the planet: each piece pressed on in turn, with its cut edge and shadow
  const Rp = pullR(st), cx = st.cx, cy = st.ecy + Rp * 0.06, u = Rp / 400;
  const parts = [['mark', T.logo - 0.15], ['name', T.logo], ['sub', T.logo + 0.35]];
  for (const [what, t0] of parts) {
    const k = sramp(t, t0, t0 + 0.35); if (k < 0.01) continue;
    const press = 1 + (1 - clamp(spring(t - t0, 12, 0.5))) * 0.12;
    g.save(); g.translate(cx, cy); g.scale(press, press); g.globalAlpha = k;
    for (const [dx, dy, col] of [[3 * u, 5 * u, 'rgba(30,16,8,.55)'], [0, 0, '#f6eee0']]) {
      g.fillStyle = col; g.strokeStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (what === 'mark') { g.lineWidth = 5 * u; g.lineJoin = 'round'; g.lineCap = 'round'; lotusMark(g, dx, -112 * u + dy, 2.1 * u); }
      if (what === 'name') { g.font = `600 ${76 * u}px Fraunces`; if (g.letterSpacing !== undefined) g.letterSpacing = `${7 * u}px`; g.fillText(BRAND.name, dx + 3.5 * u, 28 * u + dy); if (g.letterSpacing !== undefined) g.letterSpacing = '0px'; }
      if (what === 'sub') { g.font = `italic 400 ${44 * u}px Fraunces`; g.fillText(BRAND.sub, dx, 92 * u + dy); }
    }
    g.restore();
  }
  // the card with the rest
  const k = drop(t, T.logo + 0.6); if (k < -0.9) return;
  const spr = ctaSprite(st), sc = st.W / 600 * 0.9, y = lerp(st.H * 1.2, st.H * 0.715, clamp(k)) - (k > 1 ? (k - 1) * st.H * 0.04 : 0);
  g.save(); g.translate(st.W * 0.5, y); g.rotate(Math.sin(t * 0.9) * 0.6 * DEG); g.scale(sc, sc); put(g, spr, 0.3, 5, 9); g.restore();
}
hook({
  sky(g, st, t, S) { if (S.pull > 0.02) { aura(g, st, t); lotus(g, st, t, false); } },
  over(g, st, t, S) { if (S.pull > 0.02) { warmPoint(g, st, t); rainCloud(g, st, t); lotus(g, st, t, true); logo(g, st, t); } },
});

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
  const lk = eraLook(t), pull = sramp(t, T.pull, T.pull + 1.9);
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
  sh.piece([[-w / 2, -h / 2 + 3], [-w / 4, -h / 2 - 1], [w / 4, -h / 2 + 2], [w / 2, -h / 2], [w / 2 - 2, h / 2 - 2], [w / 5, h / 2 + 1], [-w / 3, h / 2 - 1], [-w / 2 + 2, h / 2]], '#f3ead8', { round: 3, rough: 1.2, seg: 60, lift: 3, blotch: 0.35, grain: 0.4, thick: 2.2, paint: (g) => {
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
const WX = [['rain', -5, ev('rainStop', 6.4) + 0.5], ['petals', 17.6, ev('pull', 20.4) + 1.2]]; // no petals over the title: they read as accents
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
  const steps = [];
  for (const e of E) {
    if (e.kind !== 'au_her') continue;
    let last = null;
    for (let t = Math.max(0, e.from ?? 0); t < Math.min(DURATION, e.to ?? DURATION); t += 1 / 240) {
      const w = e.act(t).walk; if (w === undefined) { last = null; continue; }
      const k = Math.floor(w / Math.PI); if (last !== null && k !== last) steps.push({ t: +t.toFixed(3), a: e.a + e.move(t), light: e.from ? 1 : 0 }); last = k;
    }
  }
  return { flaps, steps, cam: Array.from({ length: Math.ceil(DURATION * 20) }, (_, i) => +cam(i / 20).toFixed(3)) };
}

export const film = { horizon: (aspect) => lerp(0.735, 0.68, sramp(aspect, 0.6, 1.5)), pullFit: (st) => pullR(st), pullY: 0.385, titleT: 2, keepFull: () => false, duration: DURATION, cam, state, entities: E, byLayer, profile, ground, clouds, bake, shadowDx, body: [126, 98, 72], soundEvents, fx: { sky, ground: groundFx, over: overFx } };
