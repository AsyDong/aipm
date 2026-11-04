import { test, expect, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Let’s explore' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.', {
    timeout: 15000,
  });
}
async function hintedChoice(page: Page) {
  await page.getByRole('button', { name: 'Hint', exact: false }).click();
  const canvas = page.locator('canvas');
  // Inspect the visible golden hint border, not hidden task/answer data.
  const readHint = () =>
    canvas.evaluate((element) => {
      const context = (element as HTMLCanvasElement).getContext('2d')!;
      for (const x of [116, 370, 624]) {
        const color = context.getImageData(x, 280, 1, 1).data;
        if (
          color[0]! > 180 &&
          color[1]! > 120 &&
          color[1]! < 180 &&
          color[2]! < 90
        )
          return x + 110;
      }
      return -1;
    });
  await expect.poll(readHint).toBeGreaterThan(0);
  const x = await readHint();
  const box = (await canvas.boundingBox())!;
  const clickX = box.x + (x * box.width) / 960;
  const clickY = box.y + (280 * box.height) / 540;
  if (page.context().browser()?.browserType().name() === 'webkit') {
    await page.touchscreen.tap(clickX, clickY);
  } else {
    await page.mouse.click(clickX, clickY);
  }
  await expect(page.getByRole('status')).toHaveText('You found it!');
}

test('five real audio rounds, hints, rewards, completion and restart', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  for (let i = 0; i < 5; i++) {
    await hintedChoice(page);
    await page
      .getByRole('button', { name: i === 4 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 4)
      await expect(page.getByRole('status')).toHaveText('Find what you hear.');
  }
  await expect(
    page.getByRole('heading', { name: 'Great listening.' }),
  ).toBeVisible();
  await expect(page.getByLabel('6 stars earned')).toBeVisible();
  await page.getByText('Session notes').click();
  await expect(page.getByText(/Hints: 5/)).toBeVisible();
  await expect(page.getByText(/First choices: 0 \/ 5/)).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.');
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pause/resume, replays, content replacement and repeated disposal', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A little breather.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Close adventure' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Open adventure', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: 'Let’s explore' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Try the sampler' }).click();
  await expect(page.getByText('WOODLAND SAMPLER')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.');
  await hintedChoice(page);
});

test('missing asset cannot start a game', async ({ page }) => {
  await page.route('**/audio/apple.mp3', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Let’s try that again.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Let’s explore' })).toHaveCount(
    0,
  );
});

test('unplayable audio keeps selection locked and can recover by replay', async ({
  page,
}) => {
  await page.route('**/audio/*.mp3', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: 'invalid audio',
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Listen to hear the word.',
  );
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await page.unroute('**/audio/*.mp3');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Find what you hear.');
});

test('wrong choice can retry without losing stars and layout fits the viewport', async ({
  page,
}, testInfo) => {
  await start(page);
  await page.getByRole('button', { name: 'Hint', exact: false }).click();
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext('2d')!;
        return [116, 370, 624].some((x) => {
          const c = context.getImageData(x, 280, 1, 1).data;
          return c[0]! > 180 && c[1]! > 120 && c[1]! < 180 && c[2]! < 90;
        });
      }),
    )
    .toBe(true);
  const wrongX = await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('2d')!;
    return (
      [116, 370, 624].find((x) => {
        const c = context.getImageData(x, 280, 1, 1).data;
        return !(c[0]! > 180 && c[1]! > 120 && c[1]! < 180 && c[2]! < 90);
      })! + 110
    );
  });
  await page.mouse.click(
    box.x + (wrongX * box.width) / 960,
    box.y + (280 * box.height) / 540,
  );
  await expect(page.getByRole('status')).toHaveText(
    'Listen again. Have another go.',
  );
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await hintedChoice(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('gameplay.png'),
    fullPage: true,
  });
});
