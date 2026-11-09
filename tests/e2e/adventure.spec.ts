import { test, expect, type Page } from '@playwright/test';

const WORLD = { width: 1280, height: 720 };
// The hint turns the plate under the right fruit gold (#ffd21f).
async function openLevel(page: Page, name = 'Fruit Market') {
  await page.goto('/');
  await page.getByRole('button', { name: `Play ${name}` }).click();
}
async function start(page: Page, name?: string) {
  await openLevel(page, name);
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?', {
    timeout: 15000,
  });
}
async function tapWorld(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const px = box.x + (x * box.width) / WORLD.width;
  const py = box.y + (y * box.height) / WORLD.height;
  if (page.context().browser()?.browserType().name() === 'webkit')
    await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}
/** Finds the gold plate by its pixels, so the test never reads hidden answer data. */
const goldPlate = (page: Page) =>
  page.locator('canvas').evaluate((element, width) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const scale = canvas.width / width;
    // The hint plate is a flat #ffd21f ellipse (~200 units wide). Bananas and other
    // yellow fruit are shaded, so require a long unbroken run of the exact colour.
    const isPlate = (x: number, y: number) => {
      const c = context.getImageData(
        Math.round(x * scale),
        Math.round(y * scale),
        1,
        1,
      ).data;
      return (
        Math.abs(c[0]! - 255) < 12 &&
        Math.abs(c[1]! - 210) < 14 &&
        Math.abs(c[2]! - 31) < 24
      );
    };
    for (let y = 640; y >= 480; y -= 4)
      for (let x = 0; x < width - 120; x += 8) {
        let run = 0;
        while (run < 120 && isPlate(x + run, y)) run += 8;
        if (run >= 120) return { x: x + run / 2, y };
      }
    return null;
  }, WORLD.width);
/** Asks for a hint and returns where the gold plate is, read in the same poll that found it. */
async function hintPlate(page: Page) {
  await page.getByRole('button', { name: 'Hint', exact: false }).click();
  const found: { value: { x: number; y: number } | null } = { value: null };
  await expect
    .poll(async () => (found.value = await goldPlate(page)))
    .not.toBeNull();
  return found.value!;
}
async function hintedChoice(page: Page) {
  const plate = await hintPlate(page);
  await tapWorld(page, plate.x, plate.y - 100);
  await expect(page.getByRole('status')).toContainText('Yes! It is');
}

test('five real audio rounds, hints, rewards, completion and restart', async ({
  page,
}) => {
  const errors: string[] = [];
  const learning: {
    completed: boolean;
    records: { completed: boolean; hints: number }[];
  }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { progress: [] } });
    const data = route.request().postDataJSON();
    learning.push(data);
    return route.fulfill({ json: { sessionId: data.session.sessionId } });
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  for (let i = 0; i < 5; i++) {
    await hintedChoice(page);
    await page
      .getByRole('button', { name: i === 4 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 4)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await expect(page.getByRole('heading', { name: 'Great job!' })).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await expect.poll(() => learning.length).toBe(1);
  expect(learning[0]!.completed).toBe(true);
  expect(learning[0]!.records).toHaveLength(5);
  expect(
    learning[0]!.records.every(
      (record) => record.completed && record.hints === 1,
    ),
  ).toBe(true);
  await page.getByText('Grown-up notes').click();
  await expect(page.getByText(/Hints: 5/)).toBeVisible();
  await expect(page.getByText(/First choices: 0 \/ 5/)).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the map remembers stars; pause, replay, leave and re-enter, and a second level', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Back to the map' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play Fruit Market' }).click();
    await expect(
      page.getByRole('button', { name: 'Let’s play' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  }
  // Different level on the same scene and mechanic, only the data changes.
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(
    page.getByRole('button', { name: 'Lighthouse, coming soon' }),
  ).toBeDisabled();
  await start(page, 'Woodland');
  await hintedChoice(page);
});

test('finished levels keep their stars on the map after a reload', async ({
  page,
}) => {
  await start(page);
  for (let i = 0; i < 5; i++) {
    await hintedChoice(page);
    await page
      .getByRole('button', { name: i === 4 ? 'Finish' : 'Next', exact: false })
      .click();
  }
  await expect(page.getByRole('heading', { name: 'Great job!' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the map' }).first().click();
  await page.reload();
  const market = page.locator('.pin', {
    has: page.getByRole('button', { name: 'Play Fruit Market' }),
  });
  await expect(market.getByLabel('3 of 3 stars')).toBeVisible();
});

test('missing asset cannot start a game', async ({ page }) => {
  await page.route('**/audio/apple.mp3', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await openLevel(page);
  await expect(
    page.getByRole('heading', { name: 'Let’s try that again.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Let’s play' })).toHaveCount(0);
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
  await openLevel(page);
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Listen to hear the word.',
  );
  await tapWorld(page, 770, 480);
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await page.unroute('**/audio/*.mp3');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
});

test('a wrong choice can retry without losing stars and the layout fits', async ({
  page,
}, testInfo) => {
  await start(page);
  const right = await hintPlate(page);
  // Fruit are spaced 240 apart; tap the neighbour that is not gold.
  await tapWorld(
    page,
    right.x > 770 ? right.x - 240 : right.x + 240,
    right.y - 100,
  );
  await expect(page.getByRole('status')).toHaveText(
    'Hmm, not that one. Listen again!',
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

test('starts and plays where crypto.randomUUID is unavailable (plain-HTTP LAN)', async ({
  page,
}) => {
  // Regression: LAN http:// pages are not secure contexts, so Safari/Chrome omit it.
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await hintedChoice(page);
  expect(errors).toEqual([]);
});

test('an upright phone gets a "turn sideways" notice and the game pauses', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(
    page.getByText('Turn your phone sideways to play!'),
  ).toBeVisible();
  await page.setViewportSize({ width: 780, height: 390 });
  await expect(page.getByText('Turn your phone sideways to play!')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Play Fruit Market' }).click();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?', {
    timeout: 15000,
  });
  await page.setViewportSize({ width: 390, height: 780 }); // turned upright mid-game
  // Wait for the portrait event to be delivered before rotating back (WebKit coalesces resizes).
  await expect(
    page.getByText('Turn your phone sideways to play!'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  await page.setViewportSize({ width: 780, height: 390 }); // and back
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  // Everything fits in the sideways window once the canvas has re-fitted: nothing scrolls.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      { timeout: 10000 },
    )
    .toBe(true);
  await context.close();
});

test('the monkey speaks: guide audio is requested for hello and right answers', async ({
  page,
}) => {
  const heard: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/audio/guide/')) heard.push(path);
  });
  await start(page);
  await hintedChoice(page);
  await expect
    .poll(() => heard)
    .toEqual(
      expect.arrayContaining([
        '/audio/guide/hello.mp3',
        '/audio/guide/right.mp3',
      ]),
    );
});
