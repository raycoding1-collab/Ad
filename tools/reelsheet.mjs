// Contact sheet of the reel at its real size (540x960 CSS at 2x = 1080x1920), with Instagram's
// covered areas marked if SAFE=1. usage: node tools/reelsheet.mjs NAME "t1,t2,..." [cols] [scale]
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
const [name, times, cols = '4', thumb = '360'] = process.argv.slice(2);
const ts = times.split(',').map(Number), dir = `shots/_${name}`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('page error:', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('console:', m.text()); });
await p.goto(`http://localhost:8765/index.html?t=${ts[0]}`);
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
if (process.env.SAFE) await p.addStyleTag({ content: 'body::after{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(#f0f3 0 0) top/100% 12% no-repeat,linear-gradient(#f0f3 0 0) bottom/100% 22% no-repeat,linear-gradient(#f0f3 0 0) right 0 top 45%/14% 40% no-repeat}' });
for (let i = 0; i < ts.length; i++) {
  await p.evaluate((t) => window.__renderAt(t), ts[i]);
  await p.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}.png` });
}
await b.close();
const c = +cols, rows = Math.ceil(ts.length / c), n = rows * c, args = ['-y', '-loglevel', 'error'];
ts.forEach((_, i) => args.push('-i', `${dir}/${String(i).padStart(3, '0')}.png`));
for (let i = ts.length; i < n; i++) args.push('-f', 'lavfi', '-i', 'color=black:s=1080x1920');
const f = Array.from({ length: n }, (_, i) => `[${i}:v]scale=${thumb}:-1${i < ts.length ? `,drawtext=text='${ts[i]}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5` : ''}[v${i}]`).join(';');
const lay = Array.from({ length: n }, (_, i) => { const x = i % c, y = Math.floor(i / c); return `${x ? Array(x).fill('w0').join('+') : 0}_${y ? Array(y).fill('h0').join('+') : 0}`; }).join('|');
args.push('-filter_complex', `${f};${Array.from({ length: n }, (_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${lay}`, `shots/sheet_${name}.jpg`);
execFileSync('ffmpeg', args);
console.log(`shots/sheet_${name}.jpg`);
