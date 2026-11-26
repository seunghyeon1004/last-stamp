// Renders the code-drawn brand assets to PNG with Playwright's bundled Chromium.
// node docs/brand/src/render.mjs
import { chromium } from '../../../node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
const font = (f) =>
  'data:font/woff2;base64,' +
  readFileSync(join(here, '../../../node_modules/@fontsource/bricolage-grotesque/files', f)).toString('base64');

const css = `
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 800; src: url(${font('bricolage-grotesque-latin-800-normal.woff2')}); }
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 500; src: url(${font('bricolage-grotesque-latin-500-normal.woff2')}); }
:root { --desk:#2b2e35; --desk-2:#363a43; --ink:#f1ece2; --red:#e4572e; --red-e:#a8361a; --blue:#2d5da8; --blue-m:#6b95d8; --blue-e:#1b3f7a;
  --yel:#e0a526; --yel-m:#b07e10; --yel-e:#9a6c08; --grn:#1f9e89; --grn-m:#6ccfbe; --grn-e:#126b5c; --card:#faf8f3;
  --wood-hi:#d9b07a; --wood-lo:#b3854e; --wood-e:#6e4a26; }
* { margin:0; box-sizing:border-box; }
body { background: radial-gradient(120% 90% at 50% 0%, var(--desk-2), var(--desk) 70%); font-family:'Bricolage Grotesque', sans-serif; overflow:hidden; }
.mark { display:inline-block; color:var(--red); border:solid var(--red); text-transform:uppercase; font-weight:800; line-height:0.95; }
`;

// one cell-drawn rubber face in SVG
function face(cells, ink, mark, edge, u = 40) {
  const rows = Math.max(...cells.map((c) => c[0])) + 1;
  const cols = Math.max(...cells.map((c) => c[1])) + 1;
  const id = Math.random().toString(36).slice(2);
  const pat =
    ink === 'blue'
      ? `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="var(--blue)"/><rect width="3.5" height="10" fill="var(--blue-m)"/></pattern>`
      : ink === 'yel'
        ? `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><rect width="9" height="9" fill="var(--yel)"/><circle cx="4.5" cy="4.5" r="2" fill="var(--yel-m)"/></pattern>`
        : ink === 'grn'
          ? `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="var(--grn)"/><rect width="1.8" height="9" fill="var(--grn-m)"/><rect width="9" height="1.8" fill="var(--grn-m)"/></pattern>`
          : `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="var(--red)"/></pattern>`;
  const rects = cells
    .map(([r, c]) => `<rect x="${c * u + 2.5}" y="${r * u + 2.5}" width="${u - 5}" height="${u - 5}" rx="3" fill="url(#${id})" stroke="${edge}" stroke-width="2.5"/>`)
    .join('');
  return `<svg width="${cols * u}" height="${rows * u}" viewBox="0 0 ${cols * u} ${rows * u}"><defs>${pat}</defs>${rects}</svg>`;
}

function block(cells, ink, mark, edge, rubber, u, rot) {
  return `<div style="display:inline-flex;flex-direction:column;transform:rotate(${rot}deg);filter:drop-shadow(0 6px 4px rgba(0,0,0,.35)) drop-shadow(0 18px 18px rgba(0,0,0,.3))">
    <div style="padding:14px;border-radius:12px 12px 5px 5px;border:2.5px solid var(--wood-e);
      background:repeating-linear-gradient(97deg,transparent 0 8px,rgba(110,74,38,.24) 8px 10px,transparent 10px 18px),linear-gradient(160deg,var(--wood-hi),var(--wood-lo));
      box-shadow:inset 0 3px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.14)">${face(cells, ink, mark, edge, u)}</div>
    <div style="height:10px;margin:0 8px;border-radius:0 0 5px 5px;background:${rubber};border:1.5px solid var(--wood-e);border-top:0"></div></div>`;
}

const icon = `<html><head><style>${css}</style></head><body style="width:256px;height:256px;display:grid;place-items:center">
  <div class="mark" style="font-size:40px;letter-spacing:0.01em;border-width:6px;border-radius:12px;padding:8px 12px 10px;transform:rotate(-8deg);text-align:center">Last<br>Stamp</div>
</body></html>`;

// a 5x5 card with a finished picture, drawn flat
function card(size) {
  const u = size / 5;
  const cells = [
    ['blue', [[0, 2], [2, 3], [3, 4], [4, 4]]],
    ['yel', [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [3, 1], [3, 2]]],
    ['red', [[3, 0], [3, 3]]],
  ];
  const pats = `<pattern id="cb" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="var(--blue)"/><rect width="3.5" height="10" fill="var(--blue-m)"/></pattern>
    <pattern id="cy" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><rect width="9" height="9" fill="var(--yel)"/><circle cx="4.5" cy="4.5" r="2" fill="var(--yel-m)"/></pattern>`;
  const fill = { blue: 'url(#cb)', yel: 'url(#cy)', red: 'var(--red)' };
  const edge = { blue: 'var(--blue-e)', yel: 'var(--yel-e)', red: 'var(--red-e)' };
  let r = '';
  for (const [ink, list] of cells) for (const [y, x] of list) r += `<rect x="${x * u}" y="${y * u}" width="${u + 0.5}" height="${u + 0.5}" fill="${fill[ink]}"/>`;
  let lines = '';
  for (let k = 1; k < 5; k++) lines += `<line x1="0" y1="${k * u}" x2="${size}" y2="${k * u}"/><line x1="${k * u}" y1="0" x2="${k * u}" y2="${size}"/>`;
  return `<svg width="${size + 24}" height="${size + 24}" viewBox="-12 -12 ${size + 24} ${size + 24}" style="transform:rotate(-3deg);filter:drop-shadow(0 14px 18px rgba(0,0,0,.4))">
    <defs>${pats}</defs><rect x="-12" y="-12" width="${size + 24}" height="${size + 24}" fill="var(--card)"/>
    <g stroke="#d9d3c7" stroke-width="1.5">${lines}</g>${r}
    ${Object.keys(edge).map(() => '').join('')}</svg>`;
}

const banner = `<html><head><style>${css}</style></head><body style="width:1920px;height:384px;position:relative">
  <div style="position:absolute;left:150px;top:58px">${card(220)}</div>
  <div style="position:absolute;left:560px;top:112px;text-align:left">
    <div class="mark" style="font-size:92px;border-width:8px;border-radius:16px;padding:10px 24px 14px;transform:rotate(-3deg)">Last Stamp</div>
    <p style="margin-top:22px;color:var(--ink);font-weight:500;font-size:34px">A daily stamp puzzle. The last stamp wins.</p>
  </div>
  <div style="position:absolute;left:1330px;top:70px">${block([[0, 0], [0, 1], [0, 2], [0, 3]], 'red', '', 'var(--red-e)', 'var(--red-e)', 40, -6)}</div>
  <div style="position:absolute;left:1560px;top:40px">${block([[0, 0], [1, 0], [1, 1], [2, 1]], 'blue', '', 'var(--blue-e)', 'var(--blue-e)', 40, 7)}</div>
  <div style="position:absolute;left:1420px;top:200px">${block([[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], 'yel', '', 'var(--yel-e)', 'var(--yel-e)', 40, -2)}</div>
  <div style="position:absolute;left:1690px;top:236px">${block([[0, 0], [1, 1]], 'grn', '', 'var(--grn-e)', 'var(--grn-e)', 36, 10)}</div>
</body></html>`;

const b = await chromium.launch();
for (const [name, html, w, h] of [
  ['icon-256.png', icon, 256, 256],
  ['banner-1920x384.png', banner, 1920, 384],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(here, '..', name) });
  await p.close();
}
await b.close();
console.log('rendered');
