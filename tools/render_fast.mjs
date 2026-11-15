// Faster rendering: several browsers in parallel, each drawing its own stretch of the reel, every frame
// kept on disk (.cache/frames) so a later edit only re-renders the seconds it touched; then one quick encode.
//   node tools/render_fast.mjs                 render every frame, then encode out/auramantra_reel.mp4
//   node tools/render_fast.mjs 8.5 17.5        re-render only 8.5–17.5 s, then encode the whole reel again
//   WORKERS=4 FPS=30 OUT=out/x.mp4 node tools/render_fast.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
const FPS = +(process.env.FPS || 30), WORKERS = +(process.env.WORKERS || 4), OUT = process.env.OUT || 'out/auramantra_reel.mp4', DIR = '.cache/frames';
mkdirSync(DIR, { recursive: true });
const name = (i) => `${DIR}/f_${String(i).padStart(5, '0')}.jpg`;
const probe = await chromium.launch(), pp = await probe.newPage();
await pp.goto('http://localhost:8765/index.html?t=0'); await pp.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const dur = await pp.evaluate(() => window.__duration); await probe.close();
const N = Math.round(dur * FPS), [a, b] = process.argv.slice(2).map(Number);
let todo = [];
for (let i = 0; i < N; i++) { const t = i / FPS; if (a === undefined ? true : t >= a - 1e-6 && t <= b + 1e-6) todo.push(i); else if (!existsSync(name(i))) todo.push(i); }
const t0 = Date.now(), per = Math.ceil(todo.length / WORKERS);
console.log(`${todo.length} of ${N} frames to render, ${WORKERS} workers`);
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const mine = todo.slice(w * per, (w + 1) * per); if (!mine.length) return; // a contiguous stretch each, so sprites cut ahead are reused
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log(`worker ${w} page error:`, e.message));
  await p.goto(`http://localhost:8765/index.html?t=${mine[0] / FPS}`); await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  for (const [k, i] of mine.entries()) {
    await p.evaluate((t) => window.__renderAt(t), i / FPS);
    await p.screenshot({ path: name(i), type: 'jpeg', quality: 96 });
    if (k % 60 === 0) console.log(`worker ${w}: ${k}/${mine.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await br.close();
}));
console.log(`frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s; encoding`);
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${DIR}/f_%05d.jpg`, '-i', '.cache/film.wav',
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', OUT], { stdio: 'inherit' });
console.log(r.status === 0 ? `wrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)}s` : 'encode failed');
