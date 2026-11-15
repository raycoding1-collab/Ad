// Export the picture's sound events (paper flaps, footsteps, the camera) for tools/build_audio.py.
// usage: node tools/events.mjs  -> .cache/events.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('page error:', e.message));
await p.goto('http://localhost:8765/index.html?t=0');
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const ev = await p.evaluate(() => window.__soundEvents());
mkdirSync('.cache', { recursive: true }); writeFileSync('.cache/events.json', JSON.stringify(ev));
console.log('flaps', ev.flaps.length, 'steps', ev.steps.length);
await b.close();
