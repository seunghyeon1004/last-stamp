import { test } from '@playwright/test';
import { puzzleFor, utcDateKey } from '../src/shared/daily';
import { SIZE } from '../src/shared/engine';
import { placeAt } from '../src/client/Sheet';

test('press animation frame', async ({ page }, info) => {
  test.skip(!process.env.SHOTS || info.project.name !== 'phone');
  const puzzle = puzzleFor(utcDateKey());
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/game.html');
  const press = puzzle.solution[0]!;
  const idx = puzzle.stamps.findIndex((s) => s.id === press.stamp);
  await page.locator('.tray .stamp').nth(idx).click();
  const box = (await page.locator('svg.work-sheet').boundingBox())!;
  const unit = box.width / (SIZE * 100 + 28);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const p = placeAt(puzzle.stamps[idx]!, r, c);
      if (p.row === press.row && p.col === press.col) {
        await page.mouse.click(box.x + (14 + c * 100 + 50) * unit, box.y + (14 + r * 100 + 50) * unit);
        await page.getByRole('button', { name: 'Press', exact: true }).click();
        await page.waitForTimeout(190);
        await page.screenshot({ path: `docs/screens/${process.env.SHOTS}/phone-press-frame.png` });
        return;
      }
    }
});
