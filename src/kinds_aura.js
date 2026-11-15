// The reel's own cut-outs (AURAMANTRA massage point, Budapest X.). Every kind is prefixed au_ so it
// never replaces a template kind of the same name.
import { put, ellipse, strip, KRAFT } from './paper.js';
import { KINDS } from './cutouts.js';
import { drawPerson, LOOKS } from './people.js';
import { rng, fbm, noise, DEG, shade, mix, rgb, clamp, smooth, sramp, spring, lerp, hash } from './util.js';

export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const dab = (g, r, n, box, cols, len = 6, w = 2) => { g.lineCap = 'round'; for (let i = 0; i < n; i++) { const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]), a = (r() - 0.5) * 1.2; g.strokeStyle = cols[(r() * cols.length) | 0]; g.lineWidth = w * (0.6 + r() * 0.8); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len * (0.5 + r()), y + Math.sin(a) * len * 0.4); g.stroke(); } };
const lite = { thick: 1.1, lift: 1.4, rough: 0.5, seg: 40 };

// The colours the world comes back in, wave by wave: warm amber, rose, lavender (and sage for the leaves).
export const BLOOM = ['#e8a85a', '#e0906c', '#d97f8c', '#c47fa4', '#a688bc', '#8f98c8', '#93b4a2', '#b9c98a'];

// ------------------------------------------------------------ the red knot ---
// One red thread, wound into a tangle. k = 1 is the knot; as k falls to 0 it comes loose and is drawn
// out into one long, smooth, gently waving line. The same drawing serves the small knot on her shoulder
// and the close-up. (x, y) centre, r tangle radius, L the length it lies out to.
export function tangle(g, x, y, r, L, k, t, seed = 1, w = 1.6, alpha = 1) {
  const N = 260, ph = [hash(seed) * 6.3, hash(seed + 1) * 6.3, hash(seed + 2) * 6.3, hash(seed + 3) * 6.3];
  const ease = smooth(1 - k), pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, sp = s * Math.PI * 2;
    const tx = Math.sin(sp * 3.1 + ph[0]) * 0.62 + Math.sin(sp * 7.3 + ph[1]) * 0.38, ty = Math.cos(sp * 2.7 + ph[2]) * 0.6 + Math.cos(sp * 6.1 + ph[3]) * 0.4;
    // loosening: the loops open out before they let go
    const loose = r * (1 + ease * 1.6) * (1 - ease) ** 1.4;
    const lx = (s - 0.5) * L * ease, ly = Math.sin(s * Math.PI * 3 + t * 1.6) * r * 0.55 * ease * Math.sin(s * Math.PI);
    pts.push([x + tx * loose + lx, y + ty * loose * 0.86 + ly]);
  }
  const line = (col, lw, dy) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + dy) : g.moveTo(px, py + dy))); g.stroke(); };
  g.save(); g.globalAlpha *= alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  line('rgba(40,10,8,.35)', w * 1.5, w * 0.7);
  line('#b1302a', w, 0);
  line('rgba(255,170,150,.45)', w * 0.35, -w * 0.25);
  g.restore();
  return pts;
}

// ---------------------------------------------------------------- people ---
Object.assign(LOOKS, {
  auHer: { skin: 4, top: 'coat', topCol: '#9a5844', legs: 'trousers', legCol: '#3b3a44', hair: 'bob', hairCol: '#3a2418', pose: 'walk', shoe: '#2a2422' },
  auHerStand: { skin: 4, top: 'coat', topCol: '#9a5844', legs: 'trousers', legCol: '#3b3a44', hair: 'bob', hairCol: '#3a2418', pose: 'stand', shoe: '#2a2422' },
  auBrollyA: { skin: 5, top: 'coat', topCol: '#4c505a', legs: 'trousers', legCol: '#2e2e34', hair: 'short', hairCol: '#2a2420', pose: 'walk' },
  auBrollyB: { skin: 6, top: 'coat', topCol: '#5e4c46', legs: 'trousers', legCol: '#34303a', hair: 'long', hairCol: '#5a3a26', pose: 'walk' },
  auBrollyC: { skin: 2, top: 'coat', topCol: '#3e4a48', legs: 'trousers', legCol: '#2a2a2e', hair: 'short', hairCol: '#1a1412', pose: 'walk' },
  auPract: { skin: 6, top: 'tunic', topCol: '#d8cfbd', legs: 'trousers', legCol: '#6e6658', hair: 'long', hairCol: '#d4ae66', pose: 'stand', shoe: '#4a3a2e' }, // a woman in her forties, light skin, long blonde hair
});

// the arm transforms of drawPerson, so things can be held in a hand or drawn on it
export function handFrame(g, P, o, side = 'front') {
  const sm = P.L.small || 1; if (sm !== 1) g.scale(sm, sm);
  const bob = o.walk !== undefined ? Math.abs(Math.cos(o.walk)) * 2.2 : 0;
  g.translate(0, -P.hip + bob); g.rotate(o.lean * DEG);
  const [sx, sy] = side === 'front' ? [2, -34.5] : [-3, -35], [a1, a2] = side === 'front' ? o.front : o.back;
  g.translate(sx, sy); g.rotate(a1 * DEG); g.translate(0, 19); g.rotate(a2 * DEG); g.translate(0, 21);
  return (o.lean + a1 + a2);
}

// --------------------------------------------------------- the city in rain ---
// Budapest apartment blocks (bérházak): cornices, tall windows, little balconies, a few lights still on.
KINDS.au_block = {
  bake(mk, v = 0) {
    const S = [
      { w: 92, f: 4, c: '#8e8a7e', top: 'cornice' }, { w: 74, f: 5, c: '#7f857f', top: 'mansard' }, { w: 104, f: 3, c: '#9a8f80', top: 'cornice' },
      { w: 84, f: 4, c: '#86817c', top: 'gable' }, { w: 118, f: 5, c: '#7c7f86', top: 'panel' }, { w: 66, f: 4, c: '#958b7c', top: 'mansard' },
    ][v % 6];
    const r = rng(900 + v * 13), fh = 46, H = 30 + S.f * fh, win = [], bal = [];
    const cols = Math.max(2, Math.floor((S.w * 2 - 20) / 26));
    for (let f = 0; f < S.f; f++) for (let c = 0; c < cols; c++) {
      const x = -S.w + 14 + c * ((S.w * 2 - 28) / cols) + 2, y = -30 - f * fh - 34;
      win.push([x, y, S.top === 'panel' ? 18 : 13, S.top === 'panel' ? 16 : 25]);
      if (S.top !== 'panel' && f > 0 && (c + f + v) % 3 === 0) bal.push([x - 3, y + 25]);
    }
    const sh = mk('au-block' + v, [-S.w - 10, -H - 60, S.w + 10, 6]);
    sh.piece(rect(-S.w, 6, S.w, -H), S.c, { round: 1.5, paint: (g) => {
      // plaster: soft stains from years of rain, a darker plinth
      g.fillStyle = rgb(shade(S.c, -0.18), 0.35); for (let i = 0; i < 9; i++) { const x = -S.w + r() * S.w * 2; g.fillRect(x, -H, 2 + r() * 5, H * (0.3 + r() * 0.7)); }
      g.fillStyle = rgb(shade(S.c, -0.25), 0.6); g.fillRect(-S.w, -26, S.w * 2, 30);
      if (S.top !== 'panel') { g.fillStyle = rgb(shade(S.c, 0.12), 0.55); for (let f = 1; f <= S.f; f++) g.fillRect(-S.w, -30 - f * fh + 4, S.w * 2, 3); }
      else { g.strokeStyle = rgb(shade(S.c, -0.2), 0.5); g.lineWidth = 1; for (let f = 0; f <= S.f; f++) { g.beginPath(); g.moveTo(-S.w, -30 - f * fh); g.lineTo(S.w, -30 - f * fh); g.stroke(); } }
      for (const [x, y, w, h] of win) { g.fillStyle = 'rgba(34,36,42,.86)'; g.fillRect(x, y, w, h); g.fillStyle = rgb(shade(S.c, 0.2), 0.7); g.fillRect(x - 1.5, y + h, w + 3, 2.4); if (S.top !== 'panel') { g.fillStyle = 'rgba(110,110,112,.45)'; g.fillRect(x + w / 2 - 0.5, y, 1, h); g.fillRect(x, y + h * 0.4, w, 1); } }
      // the gateway
      g.fillStyle = 'rgba(30,26,24,.9)'; g.beginPath(); g.moveTo(-10, 6); g.lineTo(-10, -20); g.quadraticCurveTo(0, -30, 10, -20); g.lineTo(10, 6); g.fill();
    } });
    for (const [x, y] of bal) sh.piece(rect(x - 2, y + 2, x + 19, y - 9), shade(S.c, -0.3), { round: 1, lift: 1.4, thick: 0.8, paint: (g) => { g.fillStyle = 'rgba(20,18,18,.5)'; for (let k = 0; k < 6; k++) g.fillRect(x + k * 3.6, y - 8, 1, 9); } });
    if (S.top === 'cornice') sh.piece(rect(-S.w - 6, -H + 2, S.w + 6, -H - 8), shade(S.c, 0.08), { round: 1, lift: 1.6 });
    if (S.top === 'mansard') sh.piece([[-S.w - 4, -H], [-S.w + 10, -H - 34], [S.w - 10, -H - 34], [S.w + 4, -H]], '#4e5258', { round: 2, lift: 1.6, paint: (g) => { g.fillStyle = 'rgba(30,30,34,.7)'; for (let x = -S.w + 20; x < S.w - 20; x += 30) g.fillRect(x, -H - 26, 10, 14); } });
    if (S.top === 'gable') sh.piece([[-S.w - 4, -H], [0, -H - 44], [S.w + 4, -H]], '#6a5048', { round: 2, lift: 1.6 });
    if (S.top === 'panel') sh.piece(rect(-S.w - 2, -H, S.w + 2, -H - 6), shade(S.c, -0.12), { round: 1, lift: 1.2 }).piece(rect(S.w - 30, -H - 6, S.w - 18, -H - 26), shade(S.c, -0.05), { round: 1, lift: 1.2 });
    // chimneys and an aerial
    sh.piece(rect(-S.w * 0.5, -H - (S.top === 'mansard' ? 30 : 4), -S.w * 0.5 + 9, -H - 40), '#6a5a52', { round: 1, lift: 1.2 });
    sh.piece(strip(S.w * 0.4, -H - 2, S.w * 0.4, -H - 52, 1.4, 1), '#3a3a3e', { round: 0.4, lift: 1 }).piece(rect(S.w * 0.4 - 12, -H - 44, S.w * 0.4 + 12, -H - 45.5), '#3a3a3e', { round: 0.3, lift: 1 });
    return { spr: sh.finish({ shadowBlur: 6 }), win };
  },
  draw(g, P, t, e, env) { put(g, P.spr, env.sh, 4, 5); },
  glow(g, P, t, e, env, p) {
    if (p < 0.6 || !e.lit) return; g.globalCompositeOperation = 'lighter';
    P.win.forEach(([x, y, w, h], i) => {
      const on = hash(i * 31 + Math.round(e.a * 7)); if (on > e.lit) return;
      const warm = hash(i * 7 + 3) > 0.35, f = 0.82 + 0.18 * fbm(t * 0.7 + i, 4);
      g.fillStyle = warm ? `rgba(255,196,120,${0.62 * f})` : `rgba(190,215,255,${0.5 * f})`; g.fillRect(x + 0.5, y + 0.5, w - 1, h - 1);
    });
    g.globalCompositeOperation = 'source-over';
  },
};

// Kőbánya's Szent László church: the tall spire with its patterned Zsolnay-tile roof, far off in the rain.
KINDS.au_church = {
  bake(mk) {
    const sh = mk('au-church', [-70, -330, 70, 6]);
    sh.piece(rect(-64, 6, 40, -110), '#8a8478', { round: 1.5, paint: (g) => { g.fillStyle = 'rgba(40,36,34,.7)'; for (let x = -54; x < 34; x += 18) { g.beginPath(); g.moveTo(x, -50); g.lineTo(x, -80); g.quadraticCurveTo(x + 5, -90, x + 10, -80); g.lineTo(x + 10, -50); g.fill(); } } });
    sh.piece([[-68, -110], [-12, -170], [44, -110]], '#6a5a4a', { round: 2, lift: 1.4, paint: (g) => { const c = ['#a8763a', '#5f7a5a', '#b88a4a', '#4a5a6a']; for (let y = -165; y < -110; y += 8) for (let x = -64; x < 44; x += 10) { g.fillStyle = c[((x + y) / 2 | 0) & 3]; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 5, y); g.lineTo(x + 10, y + 4); g.lineTo(x + 5, y + 8); g.fill(); } } });
    sh.piece(rect(40, 6, 66, -190), '#8e887c', { round: 1.5, paint: (g) => { g.fillStyle = 'rgba(40,36,34,.7)'; g.fillRect(48, -170, 10, 26); g.fillRect(48, -120, 10, 20); } });
    sh.piece([[36, -190], [53, -318], [70, -190]], '#7a6a52', { round: 1.5, lift: 1.4, paint: (g) => { const c = ['#a8763a', '#5f7a5a', '#c09040', '#4a5a6a']; for (let y = -310; y < -190; y += 9) for (let x = 36; x < 70; x += 8) { g.fillStyle = c[((x + y) / 3 | 0) & 3]; g.beginPath(); g.moveTo(x, y + 4.5); g.lineTo(x + 4, y); g.lineTo(x + 8, y + 4.5); g.lineTo(x + 4, y + 9); g.fill(); } } });
    sh.piece(strip(53, -316, 53, -332, 1.6, 1), '#4a4440', { round: 0.4, lift: 1 }).piece(rect(49, -326, 57, -324.6), '#4a4440', { round: 0.3, lift: 1 });
    return { spr: sh.finish({ shadowBlur: 5 }) };
  },
  draw(g, P, t, e, env) { put(g, P.spr, env.sh, 4, 5); },
};

// A Budapest tram, yellow, two cars, its pantograph on the wire.
KINDS.au_tram = {
  bake(mk) {
    const P = {}, win = [];
    for (let x = -88; x < 80; x += 22) win.push([x, -70, 15, 24]);
    P.car = mk('au-tram', [-104, -116, 104, 8])
      .piece([[-100, -12], [-100, -84], [-90, -96], [90, -96], [100, -84], [100, -12]], '#e8b81f', { round: 7, paint: (g) => {
        for (const [x, y, w, h] of win) { g.fillStyle = 'rgba(40,42,48,.88)'; g.fillRect(x, y, w, h); }
        g.fillStyle = '#f2ead6'; g.fillRect(-100, -96, 200, 9); g.fillStyle = 'rgba(70,58,30,.6)'; g.fillRect(-100, -40, 200, 3); g.fillStyle = '#3a3634'; g.fillRect(-100, -22, 200, 10);
        g.fillStyle = 'rgba(40,42,48,.9)'; g.fillRect(-14, -74, 14, 60); g.fillStyle = '#f2ead6'; g.font = '700 11px sans-serif'; g.fillText('3', 84, -78);
      } })
      .piece(rect(-50, -96, 50, -104), '#7a7a80', { round: 1, lift: 1 })
      .finish({ shadowBlur: 4 });
    P.panto = mk('au-panto', [-20, -40, 20, 4], { pad: 4 }).piece([[-2, 0], [-14, -18], [0, -34], [2, -34], [-11, -18], [2, 0]], '#2e2e32', { round: 0.6, lift: 0.6, thick: 0.6 }).piece(rect(-16, -33, 16, -36), '#2e2e32', { round: 0.4, lift: 0.6 }).finish({ shadowBlur: 2 });
    P.wheel = mk('au-tram-w', [-10, -10, 10, 10], { pad: 4 }).piece(ellipse(0, 0, 8, 8, 12), '#2a2628', { round: 2 }).finish({ shadowBlur: 2 });
    P.windows = win;
    return P;
  },
  draw(g, P, t, e, env) {
    for (const off of [0, 214]) { g.save(); g.translate(off, -6 + Math.sin(t * 9 + off) * 0.4); put(g, P.car, env.sh, 3, 4); if (!off) { g.save(); g.translate(0, -104); put(g, P.panto, 0); g.restore(); } for (const x of [-66, 66]) { g.save(); g.translate(x, -6); put(g, P.wheel, 0); g.restore(); } g.restore(); }
  },
  glow(g, P, t, e, env, p) {
    if (p < 0.6) return; g.globalCompositeOperation = 'lighter';
    for (const off of [0, 214]) for (const [x, y, w, h] of P.windows) { g.fillStyle = 'rgba(255,226,170,.5)'; g.fillRect(off + x + 1, y - 6 + 1, w - 2, h - 2); }
    // the headlamp in the rain
    const gr = g.createRadialGradient(-98, -30, 0, -98, -30, 34); gr.addColorStop(0, 'rgba(255,236,200,.8)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = gr; g.fillRect(-132, -64, 68, 68);
    g.globalCompositeOperation = 'source-over';
  },
};
// The overhead line: a pole, and the wire hanging to the next pole along the curve of the world.
KINDS.au_tpole = {
  bake(mk) { return { spr: mk('au-tpole', [-8, -150, 30, 6]).piece(strip(0, 4, 0, -146, 4.4, 3.2), '#3c3c40', { round: 0.8 }).piece(rect(0, -132, 26, -135), '#3c3c40', { round: 0.4, lift: 0.8 }).finish({ shadowBlur: 3 }) }; },
  draw(g, P, t, e, env) {
    put(g, P.spr, env.sh);
    // the wire to the next pole (span in degrees on this layer, at the radius of the wire)
    const span = e.span || 0, R = 1022 + 0, h = 128, d = span * 0.78 * DEG;
    if (!span) return;
    const x1 = Math.sin(d) * (R + h), y1 = -(Math.cos(d) * (R + h) - R);
    g.strokeStyle = 'rgba(40,40,44,.7)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(22, -h);
    g.quadraticCurveTo(x1 / 2 + 11, (y1 - h) / 2 - h * 0.5 + 9, x1 + 22, y1 - h); g.stroke();
  },
};

// Someone hurrying under an umbrella.
KINDS.au_brolly = {
  bake(mk, v) {
    const P = KINDS.person.bake(mk, v);
    const col = { auBrollyA: '#2f3440', auBrollyB: '#7a3a3a', auBrollyC: '#3a4a40' }[v] || '#2f3440';
    P.brolly = mk('au-brolly-' + v, [-52, -26, 52, 4], { pad: 5 }).piece([[-50, 0], [-44, -12], [-26, -22], [0, -26], [26, -22], [44, -12], [50, 0], [37, -3], [25, 1], [12, -3], [0, 1], [-12, -3], [-25, 1], [-37, -3]], col, { round: 2, rim: 0.3, paint: (g) => { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8; for (const x of [-25, 0, 25]) { g.beginPath(); g.moveTo(0, -26); g.lineTo(x, 0); g.stroke(); } } }).finish({ shadowBlur: 3 });
    P.shaft = mk('au-shaft', [-2, -50, 2, 4], { pad: 3 }).piece(strip(0, 2, 0, -48, 1.4, 1.2), '#2a2420', { round: 0.4, lift: 0.4 }).finish({ shadowBlur: 1 });
    return P;
  },
  draw(g, P, t, e, env) {
    const o = { lean: 6 + Math.sin(t * 0.9 + e.a) * 0.6, head: 8, back: [0, -10], front: [-40, -110] };
    const ph = t * (e.pace ?? 5) + e.a; Object.assign(o, { walk: ph, back: [Math.sin(ph) * 20, -14] });
    // the hand at the shoulder, the shaft straight up, the canopy tipped back over the head
    o.held = (g2) => { g2.save(); g2.translate(0, 20); g2.rotate(-(o.lean + o.front[0] + o.front[1] + 10) * DEG + Math.sin(ph * 2) * 0.03); g2.scale(1, 1.55); put(g2, P.shaft, 0); g2.scale(1, 1 / 1.55); g2.translate(0, -74); put(g2, P.brolly, env.sh * 0.6, 2, 3); g2.restore(); };
    drawPerson(g, P, t, e, env, o);
  },
};

// ------------------------------------------------------- her and the week ---
// She carries the whole week on her back: a tower of boxes, folders, a laptop, a calendar, the shopping,
// and on top an alarm clock. It sways with every step. Under it, on her shoulder, a red knot.
KINDS.au_her = {
  bake(mk, v = 'auHer') { return KINDS.person.bake(mk, v); },
  draw(g, P, t, e, env) {
    const o = e.act(t);
    drawPerson(g, P, t, e, env, o);
    // the knot, high on her shoulder
    if (o.knot > 0.01) {
      const sm = P.L.small || 1, bob = o.walk !== undefined ? Math.abs(Math.cos(o.walk)) * 2.2 : 0;
      g.save(); g.scale(sm, sm); g.translate(0, -P.hip + bob); g.rotate(o.lean * DEG);
      tangle(g, -4, -36, 6.2, 0, 1, t, 7, 1.3, o.knot);
      g.restore();
    }
  },
};

// the week, item by item, bottom to top: [width, height, colour, label]
const WEEK = [
  ['box', 56, 40, '#b48a5a', 'IRATOK'], ['laptop', 50, 7, '#9ea2a8'], ['folder', 52, 10, '#3d6a9a'], ['folder', 48, 9, '#b2463c'], ['papers', 46, 16, '#efe7d6'],
  ['folder', 54, 10, '#d2a63a'], ['cal', 44, 34, '#f1ece0', 'PÉNTEK'], ['bag', 40, 34, '#c8b48a'], ['folder', 46, 9, '#4f7a58'], ['clock', 26, 26, '#c9463a'],
];
KINDS.au_stack = {
  bake(mk) {
    const r = rng(4411), P = { items: [] };
    for (const [kind, w, h, col, label] of WEEK) {
      const sh = mk('au-wk-' + kind + w, [-w / 2 - 14, -h - 26, w / 2 + 14, 4], { pad: 5 });
      if (kind === 'box') sh.piece(rect(-w / 2, 0, w / 2, -h), col, { round: 1.5, paint: (g) => { g.fillStyle = 'rgba(80,50,26,.35)'; g.fillRect(-w / 2, -h, w, 5); g.fillStyle = '#efe6cf'; g.fillRect(-14, -h + 12, 28, 12); g.fillStyle = '#3a2a1e'; g.font = '600 6.4px Fraunces'; g.textAlign = 'center'; g.fillText(label, 0, -h + 20.4); g.fillStyle = 'rgba(40,24,12,.6)'; g.fillRect(-5, -h + 30, 10, 3); } });
      else if (kind === 'laptop') sh.piece(rect(-w / 2, 0, w / 2, -h), col, { round: 2, paint: (g) => { g.fillStyle = 'rgba(40,40,44,.6)'; g.fillRect(-w / 2, -2.4, w, 1.2); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(0, -h / 2 - 0.6, 1.6, 0, 7); g.fill(); } });
      else if (kind === 'folder') sh.piece(rect(-w / 2, 0, w / 2, -h), col, { round: 1.2, paint: (g) => { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-w / 2, -h, w, 2); g.fillStyle = '#efe6cf'; g.fillRect(-w / 2 + 3, -h + 2.5, 10, h - 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(w / 2 - 6, -h, 3, h); } });
      else if (kind === 'papers') { sh.piece(rect(-w / 2, 0, w / 2, -h), col, { round: 0.8, paint: (g) => { g.strokeStyle = 'rgba(120,100,80,.5)'; g.lineWidth = 0.5; for (let y = -1.5; y > -h; y -= 2) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y + (r() - 0.5)); g.stroke(); } } }); sh.piece(rect(w / 2 - 12, -h + 2, w / 2 + 6, -h + 9), '#f4e07a', { round: 0.6, lift: 0.8, thick: 0.4 }).piece(rect(-w / 2 - 5, -h + 6, -w / 2 + 8, -h + 12), '#f2a8a0', { round: 0.6, lift: 0.8, thick: 0.4 }); }
      else if (kind === 'cal') sh.piece(rect(-w / 2, 0, w / 2, -h), col, { round: 1.2, paint: (g) => { g.fillStyle = '#b1302a'; g.fillRect(-w / 2, -h, w, 11); g.fillStyle = '#fff4e4'; g.font = '700 5.4px Fraunces'; g.textAlign = 'center'; g.fillText(label, 0, -h + 9.2); g.strokeStyle = 'rgba(60,50,40,.5)'; g.lineWidth = 0.4; for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) g.strokeRect(-w / 2 + 3 + j * 6.3, -h + 13.5 + i * 4.8, 6.3, 4.8); g.strokeStyle = 'rgba(177,48,42,.85)'; g.lineWidth = 0.8; for (let j = 0; j < 5; j++) { const x = -w / 2 + 3 + j * 6.3, y = -h + 13.5 + 4.8; g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + 5.3, y + 4); g.moveTo(x + 5.3, y + 1); g.lineTo(x + 1, y + 4); g.stroke(); } } });
      else if (kind === 'bag') sh.piece(strip(6, -h + 2, 14, -h - 22, 6, 4), '#d8b46a', { round: 2, lift: 0, paint: (g) => { g.strokeStyle = 'rgba(120,80,30,.6)'; g.lineWidth = 0.7; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(5 + k * 2.4, -h - 4 - k * 5); g.lineTo(11 + k * 2.2, -h - 6 - k * 5); g.stroke(); } } }).piece(strip(-6, -h + 2, -12, -h - 16, 4, 6), '#7aa05a', { round: 2, lift: 0.8 }).piece(rect(-w / 2, 0, w / 2, -h), col, { round: 2, lift: 1.2, paint: (g) => { g.strokeStyle = 'rgba(90,70,40,.5)'; g.lineWidth = 0.6; for (let y = -4; y > -h; y -= 5) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y); g.stroke(); } } });
      else if (kind === 'clock') sh.piece(ellipse(-9, -h + 2, 5.5, 5, 10), '#a8342a', { round: 2 }).piece(ellipse(9, -h + 2, 5.5, 5, 10), '#a8342a', { round: 2 }).piece([[-9, 0], [-12, 3], [-8, 3], [-6, 0], [6, 0], [8, 3], [12, 3], [9, 0]], '#3a3030', { round: 0.6, lift: 0.4 }).piece(ellipse(0, -h / 2, w / 2, h / 2, 16), col, { round: 4, lift: 1.4, paint: (g) => { g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(0, -h / 2, w / 2 - 3.4, 0, 7); g.fill(); g.strokeStyle = '#2a2020'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(0, -h / 2 - 7.5); g.moveTo(0, -h / 2); g.lineTo(5, -h / 2 + 2); g.stroke(); g.fillStyle = 'rgba(40,30,30,.6)'; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillRect(Math.cos(a) * 8.6 - 0.5, -h / 2 + Math.sin(a) * 8.6 - 0.5, 1, 1); } } });
      P.items.push({ spr: sh.finish({ shadowBlur: 3 }), h, kind });
    }
    P.sheet = mk('au-sheet', [-12, -15, 12, 15], { pad: 4 }).piece(rect(-10, 13, 10, -13), '#f2ead8', { round: 0.6, rough: 0.3, paint: (g) => { g.strokeStyle = 'rgba(120,100,80,.5)'; g.lineWidth = 0.5; for (let y = -9; y < 10; y += 2.4) { g.beginPath(); g.moveTo(-7, y); g.lineTo(7, y); g.stroke(); } } }).finish({ shadowBlur: 2 });
    return P;
  },
  draw(g, P, t, e, env) {
    const sw = e.sway ? e.sway(t) : 1, ring = e.ring ? e.ring(t) : 0;
    g.save();
    P.items.forEach((it, i) => {
      if (e.gone && i >= e.gone(t)) return;
      // each level leans a little more than the one below: the tower bends like a reed
      const lean = (Math.sin(t * 2.3 + i * 0.45) * 1.5 + fbm(t * 0.9 + i * 0.7, 31) * 1.4) * sw * (0.4 + i * 0.12) + (hash(i * 5) - 0.5) * 3;
      g.rotate(lean * DEG);
      g.save(); g.translate((hash(i * 9) - 0.5) * 6, 0);
      if (it.kind === 'clock' && ring > 0) { g.translate(Math.sin(t * 46) * 1.4 * ring, -Math.abs(Math.sin(t * 23)) * 2 * ring); g.rotate(Math.sin(t * 40) * 0.08 * ring); }
      put(g, it.spr, i === 0 ? env.sh : env.sh * 0.7, 2, 3);
      g.restore();
      g.translate(0, -it.h + 1);
    });
    g.restore();
  },
};

// -------------------------------------------------- the building, the warm window ---
// An ordinary Budapest house in the rain, and on its ground floor one warm window: the massage point.
// Candles on the sill, a plant, a curtain drawn half back, the lotus on the glass; the door beside it.
export const HOUSE = { w: 132, gf: 176, fh: 104, floors: 2, win: [-114, -150, -34, -40], door: [30, 66, -150] };
KINDS.au_house = {
  bake(mk) {
    const { w, gf, fh, floors } = HOUSE, H = gf + floors * fh, r = rng(3131), c = '#9c9486';
    const sh = mk('au-house', [-w - 14, -H - 70, w + 14, 22]);
    const [wx0, wy0, wx1, wy1] = HOUSE.win, [dx0, dx1, dy0] = HOUSE.door;
    sh.piece(rect(-w, 20, w, -H), c, { round: 1.5, paint: (g) => {
      g.fillStyle = rgb(shade(c, -0.18), 0.35); for (let i = 0; i < 10; i++) g.fillRect(-w + r() * w * 2, -H, 2 + r() * 5, H * (0.3 + r() * 0.7));
      // rusticated ground floor
      g.fillStyle = rgb(shade(c, -0.1), 0.55); g.fillRect(-w, -gf, w * 2, gf + 20);
      g.strokeStyle = rgb(shade(c, -0.3), 0.4); g.lineWidth = 0.9; for (let y = -12; y > -gf; y -= 16) { g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = rgb(shade(c, 0.14), 0.6); for (let f = 0; f <= floors; f++) g.fillRect(-w, -gf - f * fh - 3, w * 2, 5);
      // the dark windows upstairs
      for (let f = 0; f < floors; f++) for (const x of [-100, -52, 14, 62]) { const y = -gf - f * fh - 78; g.fillStyle = 'rgba(34,36,42,.88)'; g.fillRect(x, y, 26, 50); g.fillStyle = 'rgba(110,110,112,.5)'; g.fillRect(x + 12.5, y, 1, 50); g.fillRect(x, y + 20, 26, 1); g.fillStyle = rgb(shade(c, 0.2), 0.8); g.fillRect(x - 3, y + 50, 32, 3); g.fillRect(x - 3, y - 6, 32, 4); }
      // the window's recess and the doorway, dark until lit
      g.fillStyle = '#2a201c'; g.fillRect(wx0 - 4, wy0 - 4, wx1 - wx0 + 8, wy1 - wy0 + 8);
      g.fillStyle = '#2a201c'; g.beginPath(); g.moveTo(dx0, 20); g.lineTo(dx0, dy0 + 14); g.quadraticCurveTo((dx0 + dx1) / 2, dy0 - 10, dx1, dy0 + 14); g.lineTo(dx1, 20); g.fill();
    } });
    // the room seen through the window: warm walls, a curtain, candles, a plant, the lotus on the glass
    sh.piece(rect(wx0, wy1, wx1, wy0), '#c98e5c', { round: 0.6, lift: 0, thick: 0, rim: 0, paint: (g) => {
      const gr = g.createRadialGradient((wx0 + wx1) / 2, wy1 - 30, 4, (wx0 + wx1) / 2, wy1 - 30, 90); gr.addColorStop(0, '#f6c88a'); gr.addColorStop(1, '#a8643e'); g.fillStyle = gr; g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      g.fillStyle = 'rgba(90,50,30,.5)'; g.fillRect(wx0 + 50, wy0 + 30, 30, 2); g.fillRect(wx0 + 50, wy0 + 52, 30, 2); // a shelf inside
      g.fillStyle = 'rgba(250,240,220,.75)'; g.fillRect(wx0 + 54, wy0 + 21, 9, 9); g.fillRect(wx0 + 66, wy0 + 23, 10, 7);
    } });
    sh.piece([[wx0, wy0], [wx0 + 30, wy0], [wx0 + 22, wy1 - 30], [wx0 + 28, wy1], [wx0, wy1]], '#e8dcc4', { round: 1, lift: 1, thick: 0.6, paint: (g) => { g.strokeStyle = 'rgba(150,120,90,.35)'; g.lineWidth = 0.8; for (let x = wx0 + 5; x < wx0 + 28; x += 5) { g.beginPath(); g.moveTo(x, wy0); g.lineTo(x - 2, wy1); g.stroke(); } } });
    sh.piece(ellipse(wx1 - 18, wy1 - 18, 12, 9, 10), '#6a4a34', { round: 2, lift: 1 }).piece([[wx1 - 30, wy1 - 22], [wx1 - 34, wy1 - 50], [wx1 - 22, wy1 - 34], [wx1 - 18, wy1 - 62], [wx1 - 12, wy1 - 34], [wx1 - 2, wy1 - 46], [wx1 - 6, wy1 - 22]], '#5f7a4a', { round: 3, lift: 1.2 });
    // the window frame, the sill, the glazing bars
    sh.piece([...rect(wx0 - 5, wy1 + 5, wx1 + 5, wy0 - 5)].reverse().concat([[wx0 - 5, wy0 - 5]]), '#3c3430', { round: 1, lift: 1.6 });
    for (const x of [wx0 - 5, wx1 - 1, (wx0 + wx1) / 2 - 2]) sh.piece(rect(x, wy1 + 2, x + 6, wy0 - 3), '#3c3430', { round: 0.8, lift: 1.8 });
    sh.piece(rect(wx0 - 5, wy0 - 4, wx1 + 5, wy0 + 2), '#3c3430', { round: 0.8, lift: 1.8 });
    sh.piece(rect(wx0 - 9, wy1 + 2, wx1 + 9, wy1 + 9), shade(c, 0.12), { round: 1, lift: 2 });
    // candles on the sill (their flames are drawn as light)
    for (const [x, hh] of [[wx0 + 40, 15], [wx0 + 50, 10], [wx0 + 58, 13]]) sh.piece(rect(x - 3, wy1 + 1, x + 3, wy1 - hh), '#f2e8d4', { round: 1, lift: 1.2, thick: 0.6 });
    // the lotus, white on the glass
    const lotus = (cx, cy, s) => { const pts = []; for (const [a, l] of [[-70, 0.7], [-40, 0.95], [0, 1.15], [40, 0.95], [70, 0.7]]) { const ar = a * DEG; pts.push([cx + Math.sin(ar) * 2, cy]); pts.push([cx + Math.sin(ar) * 14 * l * s, cy - Math.cos(ar) * 16 * l * s]); } return pts; };
    sh.piece(lotus((wx0 + wx1) / 2 + 22, wy0 + 36, 0.75), 'rgba(250,246,236,1)', { round: 2.4, lift: 0.4, thick: 0.2, rim: 0, rough: 0.3 });
    // the sign by the door, the lamp over it, a step
    sh.piece(rect(dx1 + 8, -120, dx1 + 44, -92), '#f2ece0', { round: 1, lift: 1.6, paint: (g) => { g.fillStyle = '#2a2622'; g.font = '600 5.2px Fraunces'; g.textAlign = 'center'; g.fillText('AURAMANTRA', dx1 + 26, -101); g.font = 'italic 400 3.6px Fraunces'; g.fillText('massage point', dx1 + 26, -96); g.strokeStyle = '#2a2622'; g.lineWidth = 0.5; g.beginPath(); for (const a of [-50, -25, 0, 25, 50]) { const ar = a * DEG; g.moveTo(dx1 + 26, -106); g.quadraticCurveTo(dx1 + 26 + Math.sin(ar) * 5, -110, dx1 + 26 + Math.sin(ar) * 4, -114 + Math.abs(a) * 0.04); } g.stroke(); } });
    sh.piece(strip((dx0 + dx1) / 2, dy0 - 8, (dx0 + dx1) / 2, dy0 - 18, 1.2, 1.2), '#2a2420', { round: 0.3, lift: 1 }).piece([[(dx0 + dx1) / 2 - 7, dy0 - 18], [(dx0 + dx1) / 2 + 7, dy0 - 18], [(dx0 + dx1) / 2 + 4, dy0 - 26], [(dx0 + dx1) / 2 - 4, dy0 - 26]], '#2a2420', { round: 1, lift: 1.2 });
    sh.piece(rect(dx0 - 8, 20, dx1 + 8, 12), shade(c, 0.1), { round: 1, lift: 1.4 });
    // cornice and roof
    sh.piece(rect(-w - 8, -H + 2, w + 8, -H - 10), shade(c, 0.1), { round: 1, lift: 1.8 });
    sh.piece([[-w - 2, -H - 10], [-w + 22, -H - 52], [w - 22, -H - 52], [w + 2, -H - 10]], '#57524e', { round: 2, lift: 1.6, paint: (g) => { g.fillStyle = 'rgba(30,30,34,.7)'; for (const x of [-60, 0, 60]) g.fillRect(x - 6, -H - 42, 12, 16); } });
    return { spr: sh.finish({ shadowBlur: 6 }) };
  },
  draw(g, P, t, e, env) { put(g, P.spr, env.sh, 4, 5); },
  glow(g, P, t, e, env, p) {
    if (p < 0.5) return;
    const [wx0, wy0, wx1, wy1] = HOUSE.win, [dx0, dx1, dy0] = HOUSE.door, k = e.warm ? e.warm(t) : 1;
    g.globalCompositeOperation = 'lighter';
    // the window: candlelight that breathes
    const f = 0.88 + 0.12 * fbm(t * 5.1, 12), gw = g.createRadialGradient((wx0 + wx1) / 2, wy1 - 24, 2, (wx0 + wx1) / 2, wy1 - 24, 110);
    gw.addColorStop(0, `rgba(255,190,110,${0.55 * k * f})`); gw.addColorStop(1, `rgba(255,150,80,${0.12 * k})`);
    g.fillStyle = gw; g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    for (const [x, hh] of [[wx0 + 40, 15], [wx0 + 50, 10], [wx0 + 58, 13]]) {
      const fl = 0.8 + 0.2 * fbm(t * 9 + x, 3), y = wy1 - hh - 4;
      const cg = g.createRadialGradient(x, y, 0, x, y, 16); cg.addColorStop(0, `rgba(255,236,170,${0.95 * k * fl})`); cg.addColorStop(0.25, `rgba(255,180,90,${0.5 * k * fl})`); cg.addColorStop(1, 'rgba(255,150,70,0)');
      g.fillStyle = cg; g.fillRect(x - 16, y - 16, 32, 32);
      g.fillStyle = `rgba(255,240,190,${k})`; g.beginPath(); g.ellipse(x + fbm(t * 6 + x, 2) * 0.6, y + 1, 1.3, 3, 0, 0, 7); g.fill();
    }
    // the doorway, once the door is open
    const d = e.door ? e.door(t) : 0;
    if (d > 0.01) {
      const gd = g.createLinearGradient(0, dy0, 0, 20); gd.addColorStop(0, `rgba(255,190,120,${0.5 * d})`); gd.addColorStop(1, `rgba(255,214,150,${0.85 * d})`);
      g.fillStyle = gd; g.beginPath(); g.moveTo(dx0, 20); g.lineTo(dx0, dy0 + 14); g.quadraticCurveTo((dx0 + dx1) / 2, dy0 - 10, dx1, dy0 + 14); g.lineTo(dx1, 20); g.fill();
    }
    // the lamp over the door
    const lx = (dx0 + dx1) / 2, ly = dy0 - 22, lg = g.createRadialGradient(lx, ly, 0, lx, ly, 30); lg.addColorStop(0, `rgba(255,220,160,${0.9 * k})`); lg.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = lg; g.fillRect(lx - 30, ly - 30, 60, 60);
    g.globalCompositeOperation = 'source-over';
  },
};
// The door, hinged at its left edge, in front of whoever goes in.
KINDS.au_door = {
  bake(mk) {
    const [dx0, dx1, dy0] = HOUSE.door, w = dx1 - dx0;
    return { spr: mk('au-door', [-2, dy0 - 12, w + 2, 22], { pad: 5 }).piece([[0, 20], [0, dy0 + 14], [w / 2, dy0 - 9], [w, dy0 + 14], [w, 20]], '#5a3a2a', { round: 2, paint: (g) => { g.strokeStyle = 'rgba(30,18,10,.5)'; g.lineWidth = 1; g.strokeRect(5, dy0 + 22, w - 10, 50); g.strokeRect(5, dy0 + 82, w - 10, 50); g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(w - 7, -60, 2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,220,160,.35)'; g.beginPath(); g.arc(w / 2, dy0 + 6, 7, 0, 7); g.fill(); } }).finish({ shadowBlur: 3 }), w };
  },
  draw(g, P, t, e, env) {
    const k = e.open ? e.open(t) : 0;
    g.translate(HOUSE.door[0], 0); g.scale(Math.cos(k * 76 * DEG), 1);
    if (k > 0.02) { g.globalAlpha *= 1; }
    put(g, P.spr, env.sh * (1 - k * 0.5), 2, 3);
    if (k > 0.02) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(20,10,6,${0.45 * k})`; g.fillRect(-4, HOUSE.door[2] - 14, P.w + 8, 200); g.globalCompositeOperation = 'source-over'; }
  },
};

// Low wet hedges along the kerb, out of focus in the foreground.
KINDS.au_hedge = {
  bake(mk, v = 0) {
    const r = rng(5100 + v), cols = [['#3c4a40', '#4a5a4c'], ['#36443c', '#465646'], ['#404c42', '#52604e']][v % 3], w = 34 + v * 6;
    const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI - (i / 10) * Math.PI; pts.push([Math.cos(a) * w * (0.95 + r() * 0.1), -Math.sin(a) * (22 + r() * 9) - 4]); }
    pts.push([w * 0.9, 4], [-w * 0.9, 4]);
    const sh = mk('au-hedge' + v, [-w - 8, -44, w + 8, 6]);
    sh.piece(pts, cols[0], { round: 6, rough: 2, seg: 10, paint: (g) => dab(g, r, 40, [-w, -34, w, 2], [rgb(shade(cols[1], 0.1), 0.6), 'rgba(20,28,22,.4)'], 6, 2.4) });
    return { spr: sh.finish({ shadowBlur: 4 }) };
  },
  draw(g, P, t, e, env) { g.rotate(fbm(t * 0.4 + e.a, 5) * 1.2 * DEG); put(g, P.spr, env.sh); },
};

// ---------------------------------------------------------------- the room ---
// Their room, cut open like a dollhouse: warm walls, a wood floor, a linen curtain at a rainy window,
// a wooden shelf of rolled towels and jars, a rice-paper lamp, a lotus print, her rust coat on its hook,
// a side table with the tray of candles, creams and the oil. The storey above stays grey.
export const ROOM = { w: 150, h: 226, door: [112, 142] };
KINDS.au_room = {
  bake(mk) {
    const { w, h } = ROOM, r = rng(8080), wall = '#dcc7a8', P = {};
    const sh = mk('au-room', [-w - 10, -h - 120, w + 10, 24]);
    // the grey storey above, and the cut edge of the building
    sh.piece(rect(-w, -h - 6, w, -h - 112), '#8e887e', { round: 1.2, paint: (g) => { g.fillStyle = 'rgba(34,36,42,.85)'; for (const x of [-110, -40, 30, 100]) g.fillRect(x - 12, -h - 92, 24, 56); g.fillStyle = 'rgba(200,196,186,.4)'; g.fillRect(-w, -h - 10, w * 2, 3); } });
    sh.piece(rect(-w - 6, -h - 104, w + 6, -h - 118), '#5a5450', { round: 1, lift: 1.4 });
    // the back wall: warm limewash, a darker skirting
    sh.piece(rect(-w + 8, 0, w - 8, -h), wall, { round: 0.8, lift: 0, thick: 0, rim: 0.2, paint: (g) => {
      const gr = g.createRadialGradient(-10, -h * 0.55, 10, -10, -h * 0.55, w * 1.2); gr.addColorStop(0, 'rgba(255,236,200,.35)'); gr.addColorStop(1, 'rgba(90,60,40,.25)'); g.fillStyle = gr; g.fillRect(-w, -h, w * 2, h);
      g.fillStyle = 'rgba(120,90,60,.12)'; for (let i = 0; i < 26; i++) g.fillRect(-w + r() * w * 2, -h, 1.2, h);
      g.fillStyle = '#8a6448'; g.fillRect(-w, -10, w * 2, 10);
    } });
    // the window, rainy blue outside, and its curtain
    sh.piece(rect(-128, -96, -66, -186), '#3e4a62', { round: 1, lift: 0.6, thick: 0, paint: (g) => { g.fillStyle = 'rgba(200,215,240,.35)'; for (let i = 0; i < 14; i++) { const x = -126 + r() * 58, y = -184 + r() * 86; g.fillRect(x, y, 0.8, 4 + r() * 6); } g.fillStyle = 'rgba(40,40,46,.6)'; g.fillRect(-128, -150, 62, 2); } });
    sh.piece([...rect(-131, -93, -63, -189)].reverse().concat([[-131, -189]]), '#f0e6d2', { round: 0.6, lift: 1.2 });
    sh.piece(rect(-99, -93, -95, -189), '#f0e6d2', { round: 0.5, lift: 1.3 });
    sh.piece([[-140, -196], [-112, -196], [-104, -150], [-110, -120], [-104, -10], [-140, -8]], '#e6d8bc', { round: 2, lift: 1.8, paint: (g) => { g.strokeStyle = 'rgba(140,110,80,.3)'; g.lineWidth = 1; for (let x = -136; x < -106; x += 6) { g.beginPath(); g.moveTo(x, -196); g.quadraticCurveTo(x + 3, -120, x + 1, -8); g.stroke(); } } });
    sh.piece(rect(-112, -128, -100, -122), '#c49a6a', { round: 1, lift: 2 });
    sh.piece(rect(-146, -199, -58, -203), '#6a4a34', { round: 0.6, lift: 1.4 });
    // the lotus print above the table
    sh.piece(rect(-34, -196, 14, -150), '#7a5a40', { round: 1, lift: 1.4 }).piece(rect(-30, -192, 10, -154), '#f4ede0', { round: 0.6, lift: 0.8, paint: (g) => {
      g.strokeStyle = '#3a302a'; g.lineWidth = 0.9; g.lineJoin = 'round'; const cx = -10, cy = -164;
      for (const [a, l] of [[-62, 0.62], [-34, 0.85], [0, 1], [34, 0.85], [62, 0.62]]) { const ar = a * DEG, tx = cx + Math.sin(ar) * 16 * l, ty = cy - Math.cos(ar) * 18 * l; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.sin(ar - 0.5) * 12 * l, cy - Math.cos(ar - 0.5) * 12 * l, tx, ty); g.quadraticCurveTo(cx + Math.sin(ar + 0.5) * 12 * l, cy - Math.cos(ar + 0.5) * 12 * l, cx, cy); g.stroke(); }
      g.beginPath(); g.moveTo(cx - 14, cy + 2); g.quadraticCurveTo(cx, cy + 7, cx + 14, cy + 2); g.stroke();
    } });
    // the shelf of towels and jars
    sh.piece(rect(70, -2, 136, -176), '#8a5e3e', { round: 1, lift: 1.6, paint: (g) => { g.fillStyle = 'rgba(40,24,14,.55)'; for (const y of [-60, -112, -164]) g.fillRect(74, y - 44, 58, 44); } });
    for (const y of [-60, -112]) for (let k = 0; k < 3; k++) sh.piece(ellipse(84 + k * 18, y - 9, 8.5, 8.5, 12), '#f4efe4', { round: 3, lift: 1.4, paint: (g) => { g.strokeStyle = 'rgba(150,140,120,.6)'; g.lineWidth = 0.7; g.beginPath(); g.arc(84 + k * 18, y - 9, 4.5, 0, 6); g.stroke(); } });
    for (const [x, c] of [[80, '#efe6d6'], [96, '#d9c2a6'], [112, '#efe6d6']]) sh.piece(rect(x - 6, -164, x + 6, -180), c, { round: 2, lift: 1.4 });
    sh.piece(rect(118, -164, 128, -192), '#9a6a3a', { round: 2, lift: 1.4 }).piece([[114, -192], [108, -214], [120, -200], [123, -222], [127, -200], [138, -212], [132, -192]], '#6a8a5a', { round: 3, lift: 1.6 });
    sh.piece(rect(70, -176, 136, -184), '#7a523a', { round: 0.8, lift: 1.8 });
    // the coat on its hook by the window
    sh.piece(rect(-60, -178, -54, -174), '#3a2a20', { round: 0.6, lift: 1 }).piece([[-63, -174], [-50, -174], [-44, -120], [-47, -96], [-66, -96], [-69, -120]], '#9a5844', { round: 3, lift: 2, paint: (g) => { g.fillStyle = 'rgba(40,20,14,.4)'; for (let y = -160; y < -100; y += 12) { g.beginPath(); g.arc(-52, y, 1, 0, 7); g.fill(); } } });
    // the side table, the tray, candles in jars, creams, the oil, lavender
    sh.piece(rect(56, -56, 110, -62), '#8a5e3e', { round: 1, lift: 2 }).piece(rect(60, 0, 64, -56), '#7a5236', { round: 0.5, lift: 2 }).piece(rect(102, 0, 106, -56), '#7a5236', { round: 0.5, lift: 2 });
    sh.piece(ellipse(83, -64, 26, 4, 16), '#a8784c', { round: 2, lift: 2.2 });
    for (const x of [68, 77]) sh.piece(rect(x - 4, -64, x + 4, -74), '#c08a50', { round: 1.5, lift: 2.4, paint: (g) => { g.fillStyle = 'rgba(255,240,200,.5)'; g.fillRect(x - 3, -72, 6, 2); } });
    sh.piece(rect(84, -64, 92, -70), '#f2ede2', { round: 2, lift: 2.4 }).piece(rect(84, -70, 92, -72.5), '#d8cfc0', { round: 1, lift: 2.5 });
    sh.piece([[96, -64], [104, -64], [104, -82], [102, -86], [102, -92], [98, -92], [98, -86], [96, -82]], '#b06a24', { round: 1.5, lift: 2.4, paint: (g) => { g.fillStyle = 'rgba(255,220,150,.45)'; g.fillRect(97.5, -82, 2, 14); g.fillStyle = '#f2ead6'; g.fillRect(96.5, -78, 7, 6); } });
    sh.piece(strip(108, -64, 116, -86, 1, 0.8), '#6a7a4a', { round: 0.4, lift: 2.4 }).piece(ellipse(116, -86, 2.4, 6, 8, 0.3), '#8a74b8', { round: 1, lift: 2.5 });
    // black stones warming on the tray's edge
    for (const [x, rr] of [[60, 3.4], [66, 2.6]]) sh.piece(ellipse(x, -66.5, rr, rr * 0.6, 10), '#2a2626', { round: 1.5, lift: 2.4 });
    // the wood floor, and the cut edges of walls, floor and ceiling
    sh.piece(rect(-w, 0, w, 14), '#7a5236', { round: 1, lift: 2, paint: (g) => { g.strokeStyle = 'rgba(40,24,12,.4)'; g.lineWidth = 0.8; for (let x = -w; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, 14); g.stroke(); } } });
    sh.piece(rect(-w - 4, 14, w + 4, 24), '#6a5a4c', { round: 1, lift: 1.6 });
    sh.piece(rect(-w, -h, -w + 9, 14), '#9a9286', { round: 1, lift: 2.4, paint: (g) => { g.fillStyle = KRAFT; g.fillRect(-w + 2, -h, 2, h + 14); } });
    sh.piece(rect(w - 9, -h, w, -ROOM.door[1] - 6), '#9a9286', { round: 1, lift: 2.4, paint: (g) => { g.fillStyle = KRAFT; g.fillRect(w - 5, -h, 2, h); } });
    sh.piece(rect(w - 9, -ROOM.door[1] - 6, w, -ROOM.door[1]), '#7a5236', { round: 0.6, lift: 2.4 });
    sh.piece(rect(-w - 4, -h + 4, w + 4, -h - 8), '#9a9286', { round: 1, lift: 2.6, paint: (g) => { g.fillStyle = KRAFT; g.fillRect(-w, -h - 4, w * 2, 2); } });
    // the rice-paper lamp on its cord
    sh.piece(rect(-10.6, -h, -9.4, -h + 34), '#3a2a20', { round: 0, lift: 1, thick: 0, rim: 0 });
    P.spr = sh.finish({ shadowBlur: 6 });
    P.lamp = mk('au-lamp', [-20, -20, 20, 20], { pad: 5 }).piece(ellipse(0, 0, 16, 15, 18), '#f6ecd8', { round: 4, paint: (g) => { g.strokeStyle = 'rgba(160,130,90,.35)'; g.lineWidth = 0.6; for (let y = -12; y < 14; y += 3.4) { g.beginPath(); g.ellipse(0, y, 16 * Math.sqrt(1 - (y / 15) ** 2), 1.2, 0, 0, 7); g.stroke(); } } }).finish({ shadowBlur: 3 });
    return P;
  },
  draw(g, P, t, e, env) {
    put(g, P.spr, env.sh, 4, 5);
    g.save(); g.translate(-10, -ROOM.h + 50); g.rotate(Math.sin(t * 0.7) * 1.2 * DEG); put(g, P.lamp, env.sh * 0.5, 2, 3); g.restore();
  },
  glow(g, P, t, e, env, p) {
    if (p < 0.5) return; const k = e.warm ? e.warm(t) : 1;
    g.globalCompositeOperation = 'lighter';
    const lx = -10, ly = -ROOM.h + 50, f = 0.92 + 0.08 * fbm(t * 2, 7);
    const gl = g.createRadialGradient(lx, ly, 2, lx, ly, 150); gl.addColorStop(0, `rgba(255,214,150,${0.55 * k * f})`); gl.addColorStop(0.2, `rgba(255,190,120,${0.22 * k})`); gl.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = gl; g.fillRect(lx - 150, ly - 150, 300, 300);
    g.fillStyle = `rgba(255,236,190,${0.6 * k})`; g.beginPath(); g.ellipse(lx, ly, 13, 12, 0, 0, 7); g.fill();
    for (const [x, y] of [[68, -76], [77, -76]]) { const fl = 0.75 + 0.25 * fbm(t * 8 + x, 5); const cg = g.createRadialGradient(x, y, 0, x, y, 26); cg.addColorStop(0, `rgba(255,236,170,${0.95 * k * fl})`); cg.addColorStop(0.2, `rgba(255,170,80,${0.4 * k * fl})`); cg.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = cg; g.fillRect(x - 26, y - 26, 52, 52); g.fillStyle = `rgba(255,244,200,${k})`; g.beginPath(); g.ellipse(x + fbm(t * 6 + x, 2) * 0.5, y + 0.5, 1, 2.6, 0, 0, 7); g.fill(); }
    const ob = g.createRadialGradient(100, -78, 0, 100, -78, 12); ob.addColorStop(0, `rgba(255,190,90,${0.5 * k})`); ob.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = ob; g.fillRect(88, -90, 24, 24);
    // daylight through the doorway on the right, once the colour has come back
    const d = e.day ? e.day(t) : 0;
    if (d > 0.01) { const dg = g.createLinearGradient(ROOM.w, 0, ROOM.w - 80, 0); dg.addColorStop(0, `rgba(255,236,190,${0.6 * d})`); dg.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = dg; g.fillRect(ROOM.w - 80, -ROOM.door[1], 80, ROOM.door[1]); }
    g.globalCompositeOperation = 'source-over';
  },
};

// The table with her on it, face down under a towel, and the practitioner at its head.
// One kind, so the hands land exactly on her back. e.pract(t) -> { lean, head, hands: [[x, y], [x, y]] }
KINDS.au_couch = {
  bake(mk) {
    const P = { pr: KINDS.person.bake(mk, 'auPract') }, skin = '#c69a74', skinD = '#b0845f';
    // a massage table at the height of her hips, as a real one is
    P.table = mk('au-table', [-100, -60, 90, 6])
      .piece(rect(-62, 2, -56, -39), '#7a5236', { round: 0.6 }).piece(rect(56, 2, 62, -39), '#7a5236', { round: 0.6 }).piece(rect(-62, -14, 62, -18), '#6a4a30', { round: 0.4, lift: 1 })
      .piece(rect(-76, -39, 76, -48), '#d8ccb4', { round: 3, lift: 1.6, paint: (g) => { g.fillStyle = 'rgba(120,100,80,.25)'; g.fillRect(-76, -41, 152, 2); } })
      .piece([[-78, -48], [78, -48], [80, -37], [74, -31], [-74, -31], [-80, -37]], '#ebe1cc', { round: 3, lift: 1.4, paint: (g) => { g.strokeStyle = 'rgba(150,130,100,.3)'; g.lineWidth = 0.7; for (let x = -70; x < 76; x += 16) { g.beginPath(); g.moveTo(x, -35); g.lineTo(x + 4, -32); g.stroke(); } } })
      .piece([[-94, -43], [-80, -43], [-80, -51], [-94, -51]], '#d8ccb4', { round: 3, lift: 1.4 }).piece(rect(-90, -43, -84, -27), '#7a5236', { round: 0.5, lift: 1.2 })
      .finish({ shadowBlur: 5 });
    P.bolster = mk('au-bolster', [-14, -10, 14, 10], { pad: 4 }).piece(ellipse(0, 0, 13, 8, 14), '#b9cad6', { round: 3, paint: (g) => { g.strokeStyle = 'rgba(80,100,120,.3)'; g.lineWidth = 0.7; for (const x of [-8, 0, 8]) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 8); g.stroke(); } } }).finish({ shadowBlur: 2 });
    // her: legs under the towel to the bolster, the bare back, an arm along her side, her head in the face cradle
    P.legs = mk('au-cl-legs', [-6, -20, 82, 4], { pad: 4 }).piece([[0, 0], [70, 0], [80, -6], [78, -12], [66, -12], [40, -14], [0, -16]], skinD, { ...lite, round: 4 }).finish({ shadowBlur: 3 });
    P.back = mk('au-cl-back', [-64, -26, 12, 4], { pad: 4 }).piece([[-52, 0], [6, 0], [8, -12], [0, -19], [-14, -17], [-30, -21], [-44, -22], [-52, -18], [-58, -14], [-62, -10], [-62, -4], [-56, -1]], skin, { ...lite, round: 6, paint: (g) => { g.strokeStyle = 'rgba(140,90,60,.25)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-50, -19); g.quadraticCurveTo(-24, -24, 4, -16); g.stroke(); } }).finish({ shadowBlur: 3 });
    P.arm = mk('au-cl-arm', [-50, -8, 2, 6], { pad: 4 }).piece([[-46, 0], [-2, 0], [0, -5], [-46, -6]], skinD, { ...lite, round: 3 }).finish({ shadowBlur: 2 });
    P.towel = mk('au-cl-towel', [-6, -26, 70, 4], { pad: 4 }).piece([[-4, 2], [66, 2], [68, -10], [56, -16], [30, -20], [4, -24], [-4, -20]], '#f6f1e6', { round: 4, lift: 1.4, paint: (g) => { g.strokeStyle = 'rgba(150,140,120,.35)'; g.lineWidth = 0.8; for (let x = 6; x < 64; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, -16); g.stroke(); } } }).finish({ shadowBlur: 3 });
    P.head = mk('au-cl-head', [-24, -22, 4, 6], { pad: 4 }).piece(ellipse(-10, -9, 11, 10, 14), skin, { ...lite, round: 4 }).piece([[-22, -6], [-20, -16], [-12, -21], [-2, -18], [2, -10], [-2, -2], [-12, 0], [-21, 2]], '#3a2418', { ...lite, round: 3, rim: 0.2 }).finish({ shadowBlur: 3 });
    return P;
  },
  draw(g, P, t, e, env) {
    const sh = env.sh, cl = e.client ? e.client(t) : 1;
    g.save(); g.translate(10, 0);
    put(g, P.table, sh, 3, 4);
    if (cl > 0.01) {
      g.save(); g.translate(0, -48); g.scale(1, cl);
      g.save(); g.translate(56, -6); put(g, P.bolster, sh * 0.5, 1, 2); g.restore();
      const br = Math.sin(t * 1.6) * 0.4; // breathing, slow
      g.save(); g.translate(-8, -1 + br * 0.2); put(g, P.legs, sh * 0.5, 1, 2); g.restore();
      g.save(); g.translate(-50, -4); put(g, P.head, sh * 0.5, 1, 2); g.restore();   // head first, tucked into the shoulders
      g.save(); g.translate(0, br * 0.3); g.scale(1, 1 + br * 0.03); put(g, P.back, sh * 0.5, 1, 2); g.restore();
      g.save(); g.translate(-4, -2); put(g, P.towel, sh * 0.5, 1, 2); g.restore();
      g.save(); g.translate(-4, -1); put(g, P.arm, sh * 0.4, 1, 2); g.restore();
      // the knot on her upper back
      const kk = e.knot ? e.knot(t) : 1;
      if (kk.show > 0.01) tangle(g, -36, -21 + br * 0.3, 5.4, 46, kk.k, t, 7, 1.2, kk.show);
      g.restore();
    }
    g.restore();
    // the practitioner stands on the near side of the table, by her hips, leaning over her back
    const o = e.pract(t), px = o.px ?? -56, face = o.face ?? 1;
    g.save(); g.translate(px, 0); if (face < 0) g.scale(-1, 1);
    const hip = P.pr.hip, L = o.lean * DEG, toT = (x, y) => { const dx = (x - px) * face, dy = y + hip; return [dx * Math.cos(L) + dy * Math.sin(L), -dx * Math.sin(L) + dy * Math.cos(L)]; };
    const [f0, f1] = toT(...o.hands[0]), [b0, b1] = toT(...o.hands[1]);
    const bend = o.bend ?? 1; o.front = reachDeg(f0 - 2, f1 + 34.5, bend); o.back = reachDeg(b0 + 3, b1 + 35, bend);
    drawPerson(g, P.pr, t, e, env, o);
    g.restore();
  },
};
// two-link arm IK (upper 19, forearm 21 to the hand), in degrees
function reachDeg(dx, dy, bend = 1, L1 = 19, L2 = 21) {
  const D = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, Math.hypot(dx, dy)));
  const phi = Math.atan2(-dx, dy), al = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)), be = Math.acos((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2));
  return [(phi + bend * al) / DEG, -bend * (Math.PI - be) / DEG];
}

// --------------------------------------------------------------- flowers ---
// v = colour * 4 + shape: 0 tulip, 1 cosmos, 2 lavender spike, 3 round ranunculus
KINDS.au_flower = {
  bake(mk, v = 0) {
    const shape = v % 4, col = BLOOM[(v >> 2) % BLOOM.length], r = rng(7700 + v), hgt = [44, 52, 48, 38][shape];
    const sh = mk('au-fl' + v, [-22, -hgt - 22, 22, 4], { pad: 5 });
    sh.piece(strip(0, 2, 1 + (r() - 0.5) * 4, -hgt, 2.2, 1.6), '#5d7a46', { round: 0.6, thick: 0.6 });
    sh.piece([[0, -10], [-12, -20], [-14, -26], [-4, -18]], '#6a8a4e', { round: 2, lift: 0.8, thick: 0.5 }).piece([[1, -16], [12, -28], [14, -24], [4, -14]], '#6a8a4e', { round: 2, lift: 0.8, thick: 0.5 });
    if (shape === 0) sh.piece([[0, -hgt + 2], [-8, -hgt - 4], [-8, -hgt - 14], [-4, -hgt - 10], [0, -hgt - 18], [4, -hgt - 10], [8, -hgt - 14], [8, -hgt - 4]], col, { round: 2.5, lift: 1.2 });
    else if (shape === 1) { const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? 4 : 12; pts.push([Math.cos(a) * rr, -hgt - 4 + Math.sin(a) * rr]); } sh.piece(pts, col, { round: 2.6, lift: 1.2 }).piece(ellipse(0, -hgt - 4, 3.4, 3.4, 8), '#e8b84a', { round: 1, lift: 0.8 }); }
    else if (shape === 2) for (let i = 0; i < 7; i++) sh.piece(ellipse((i % 2 ? 1.6 : -1.6), -hgt + 10 - i * 5, 3.6 - i * 0.25, 3, 8), shade(col, -0.05 + i * 0.03), { round: 1.4, lift: 0.8, thick: 0.6 });
    else sh.piece(ellipse(0, -hgt - 6, 10, 9, 14), col, { round: 4, lift: 1.2, paint: (g) => { g.strokeStyle = rgb(shade(col, -0.25), 0.5); g.lineWidth = 0.7; for (const rr of [3, 6, 8.5]) { g.beginPath(); g.arc(0, -hgt - 6, rr, 0.3, 5.6); g.stroke(); } } });
    return { spr: sh.finish({ shadowBlur: 2.5 }), ph: r() * 9 };
  },
  draw(g, P, t, e, env) { g.rotate((fbm(t * 0.6 + e.a * 1.7 + P.ph, 9) * 6 + Math.sin(t * 1.4 + e.a) * 1.5) * DEG); put(g, P.spr, env.sh * 0.7, 2, 3); },
};
