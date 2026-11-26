import { test, type Page } from '@playwright/test';
import { puzzleFor, utcDateKey } from '../src/shared/daily';
import { SIZE } from '../src/shared/engine';
import { placeAt } from '../src/client/Sheet';

// Visual record for design reviews: SHOTS=before|after npx playwright test shots
const DIR = `docs/screens/${process.env.SHOTS ?? 'current'}`;

async function tapCell(page: Page, row: number, col: number) {
  const box = (await page.locator('svg.work-sheet').boundingBox())!;
  const unit = box.width / (SIZE * 100 + 28);
  await page.mouse.click(box.x + (14 + col * 100 + 50) * unit, box.y + (14 + row * 100 + 50) * unit);
}

test('visual record', async ({ page }, info) => {
  test.skip(!process.env.SHOTS);
  const name = info.project.name;
  const puzzle = puzzleFor(utcDateKey());
  await page.setViewportSize(name === 'phone' ? { width: 390, height: 512 } : { width: 730, height: 512 });
  await page.goto('/splash.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/${name}-1-splash.png` });

  await page.setViewportSize(name === 'phone' ? { width: 390, height: 760 } : { width: 724, height: 596 });
  await page.goto('/game.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/${name}-2-game-start.png` });

  const stamps = page.locator('.tray .stamp');
  for (let k = 0; k < puzzle.solution.length; k++) {
    const press = puzzle.solution[k]!;
    const idx = puzzle.stamps.findIndex((s) => s.id === press.stamp);
    const btn = stamps.nth(idx);
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    let tap: [number, number] = [0, 0];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const p = placeAt(puzzle.stamps[idx]!, r, c);
        if (p.row === press.row && p.col === press.col) tap = [r, c];
      }
    await tapCell(page, tap[0], tap[1]);
    if (k === puzzle.solution.length - 2) {
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${DIR}/${name}-3-game-mid.png` });
    }
    await page.getByRole('button', { name: 'Press', exact: true }).click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/${name}-4-result.png` });
});
