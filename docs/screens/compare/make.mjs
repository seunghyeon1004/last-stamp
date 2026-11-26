import { chromium } from '../../../node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const base = join(import.meta.dirname, '..');
const b = await chromium.launch();
for (const dev of ['phone', 'desktop'])
  for (const step of ['1-splash', '2-game-start', '3-game-mid', '4-result']) {
    const p = await b.newPage({ viewport: { width: dev === 'phone' ? 860 : 1500, height: 900 } });
    const img = (w) => 'data:image/png;base64,' + readFileSync(join(base, w, `${dev}-${step}.png`)).toString('base64');
    await p.setContent(`<body style="margin:0;background:#ddd;font:600 18px sans-serif;display:flex;gap:16px;padding:16px;align-items:flex-start">
      <figure style="margin:0"><figcaption>Before</figcaption><img src="${img('before')}" style="width:${dev === 'phone' ? 400 : 720}px;border:1px solid #999"></figure>
      <figure style="margin:0"><figcaption>After</figcaption><img src="${img('after')}" style="width:${dev === 'phone' ? 400 : 720}px;border:1px solid #999"></figure></body>`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: join(import.meta.dirname, `${dev}-${step}.png`), fullPage: true });
    await p.close();
  }
await b.close();
