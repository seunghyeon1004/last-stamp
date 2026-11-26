import { expect, test, type Page } from '@playwright/test';
import { puzzleFor, utcDateKey } from '../src/shared/daily';
import { SIZE } from '../src/shared/engine';
import { placeAt } from '../src/client/Sheet';

const SHOTS = '../docs/screens';

async function tapCell(page: Page, row: number, col: number) {
  const box = (await page.locator('svg.work-sheet').boundingBox())!;
  const unit = box.width / (SIZE * 100 + 24);
  const x = box.x + (12 + col * 100 + 50) * unit;
  const y = box.y + (12 + row * 100 + 50) * unit;
  await page.mouse.click(x, y);
}

test('fits one viewport and solves today at par', async ({ page }, info) => {
  const puzzle = puzzleFor(utcDateKey());
  await page.goto('/game.html');
  await expect(page.locator('.wordmark')).toHaveText(/overprint/i);

  // nothing scrolls: the page fits the viewport
  const overflow = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight - window.innerHeight,
    w: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.h).toBeLessThanOrEqual(0);
  expect(overflow.w).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/game-start-${info.project.name}.png` });

  const stampButtons = page.locator('.tray .stamp');
  for (const press of puzzle.solution) {
    const idx = puzzle.stamps.findIndex((s) => s.id === press.stamp);
    const stamp = puzzle.stamps[idx]!;
    const btn = stampButtons.nth(idx);
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    // find the tap cell that places this stamp at the solution position
    let tap: [number, number] | null = null;
    for (let r = 0; r < SIZE && !tap; r++)
      for (let c = 0; c < SIZE && !tap; c++) {
        const p = placeAt(stamp, r, c);
        if (p.row === press.row && p.col === press.col) tap = [r, c];
      }
    expect(tap).not.toBeNull();
    await tapCell(page, tap![0], tap![1]);
    if (press === puzzle.solution[Math.floor(puzzle.solution.length / 2)]) {
      await page.screenshot({ path: `${SHOTS}/game-ghost-${info.project.name}.png` });
    }
    await page.getByRole('button', { name: 'Press', exact: true }).click();
  }
  await expect(page.locator('.result')).toBeVisible();
  await expect(page.locator('.result-par')).toHaveText('on par');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/game-result-${info.project.name}.png` });
});

test('splash shows the date and par', async ({ page }, info) => {
  const puzzle = puzzleFor(utcDateKey());
  await page.setViewportSize({ width: info.project.name === 'phone' ? 412 : 700, height: 512 });
  await page.goto('/splash.html');
  await expect(page.locator('.splash-line')).toContainText(`Par ${puzzle.par}`);
  await page.screenshot({ path: `${SHOTS}/splash-${info.project.name}.png` });
});

test('re-tapping the selected stamp keeps it selected', async ({ page }) => {
  await page.goto('/game.html');
  const first = page.locator('.tray .stamp').first();
  await first.click();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
});

test('desktop modal size: sheet uses the height, nothing scrolls', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 724, height: 596 });
  await page.goto('/game.html');
  const box = (await page.locator('svg.work-sheet').boundingBox())!;
  expect(box.height).toBeGreaterThan(380);
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: '../docs/screens/game-start-desktop-modal.png' });
});
