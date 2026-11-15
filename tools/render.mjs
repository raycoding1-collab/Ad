// Render the reel to video: every frame at 1080x1920, piped into ffmpeg with the soundtrack.
// usage: node tools/render.mjs [out.mp4] [fps] [from] [to]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
const [out = 'out/auramantra_reel.mp4', fps = '30', from = '0', to] = process.argv.slice(2);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('page error:', e.message));
await p.goto('http://localhost:8765/index.html?t=0');
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const dur = to ? +to : await p.evaluate(() => window.__duration), n = Math.round((dur - +from) * +fps);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', fps, '-i', '-', '-ss', from, '-i', '.cache/film.wav',
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-r', fps,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.__renderAt(t), +from + i / +fps);
  const png = await p.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
console.log('wrote', out, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
