import { test, expect, type Page } from '@playwright/test';
import { unlockBefore } from './unlock';

const catchPrompt = 'Catch the fruit you hear!';

async function start(
  page: Page,
  name: string,
  unit: string,
  ask = name === 'Fruit Market' ? catchPrompt : 'Which one is it?',
) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { progress: [] } }),
  );
  await unlockBefore(page, name);
  await page.goto('/');
  await page.getByRole('button', { name: `Open ${unit}`, exact: true }).click();
  await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
  await page.getByRole('button', { name: /^Let/ }).click();
  await expect(page.getByRole('status')).toHaveText(ask, { timeout: 20000 });
  await expect(page.locator('.task-collection')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /^(Next|Finish)/ }),
  ).toHaveCount(0);
}

async function tapWorld(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const px = box.x + (x * box.width) / 1280,
    py = box.y + (y * box.height) / 720;
  if (page.context().browser()?.browserType().name() === 'webkit')
    await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
}

async function chooseFirst(
  page: Page,
  count: number,
  centerX = 770,
  baseY = 565,
) {
  const size = count <= 3 ? 210 : 180;
  const x = centerX - ((count - 1) / 2) * (size + 30);
  const y = baseY - size / 2;
  await tapWorld(page, x, y);
  await expect(page.getByRole('status')).toContainText('Yes! It is');
}

// Fixed shuffle puts the target in the first falling lane. Moving there is the
// answer: the test never bypasses collision detection or submits through internals.
async function catchFirst(page: Page, x = 267) {
  await tapWorld(page, x, 600);
  await expect(page.getByRole('status')).toContainText('Yes! It is', {
    timeout: 20000,
  });
}

test('the world map shows U0-U9 and a unit opens its own numbered locations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 668, height: 375 });
  await unlockBefore(page, 'Fruit Market');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'World map' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
    )
    .toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator('.world-art')).toHaveAttribute(
    'src',
    '/images/maps/world.webp',
  );
  await expect(page.locator('.chapter-nav')).toHaveCount(0);
  await expect(page.locator('.map-person')).toHaveCount(0);
  await expect(page.locator('.unit-pin')).toHaveCount(10);
  await expect(page.locator('.unit-pin .pin-bubble')).toHaveText([
    'U0',
    'U1',
    'U2',
    'U3',
    'U4',
    'U5',
    'U6',
    'U7',
    'U8',
    'U9',
  ]);
  expect(
    await page.locator('.pin > button').evaluateAll((buttons) =>
      buttons.every((button) => {
        const box = button.getBoundingClientRect();
        return (
          box.width >= 44 &&
          box.height >= 44 &&
          button.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          )
        );
      }),
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.pin-bubble')
      .evaluateAll((markers) =>
        markers.every((marker) => marker.getBoundingClientRect().width <= 30),
      ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Open Market Street', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Market Street', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.unit-map .pin')).toHaveCount(8);
  await expect(page.locator('.unit-map .pin-bubble')).toHaveText([
    'B1',
    'B2',
    'B3',
    'B4',
    'B5',
    'B6',
    'S',
    'W',
  ]);
  await expect(page.locator('.unit-map .world-art')).toHaveAttribute(
    'src',
    '/images/maps/unit-3.webp',
  );
  await expect(page.locator('.map-person')).toHaveCount(0);
  await page.getByRole('button', { name: 'World map', exact: true }).click();
  await page.getByRole('button', { name: 'Open Welcome Harbour' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome Harbour', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.unit-map .world-art')).toHaveAttribute(
    'src',
    '/images/maps/hello.webp',
  );
  await page.getByRole('button', { name: 'World map', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'World map' })).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
    )
    .toBeLessThanOrEqual(1);
});

test('completion unlocks the next stop and the monkey walks before READY', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { progress: [] } }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Market Street locked', exact: true }),
  ).toBeDisabled();
  await unlockBefore(page, 'Fruit Market');
  await page.reload();
  await page.getByRole('button', { name: 'Open Market Street' }).click();
  await expect(
    page.getByRole('button', { name: 'Fruit Stall locked', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Grocery Shop locked', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Play Fruit Market' }).click();
  await expect(page.getByRole('button', { name: 'Let’s play' })).toHaveCount(0);
  await expect(page.locator('.unit-map')).toHaveClass(/entering-location/);
  await expect(page.getByTestId('map-monkey')).toBeVisible();
  const leftLeg = page.locator('.map-monkey.walking .monkey-leg-left');
  const rightLeg = page.locator('.map-monkey.walking .monkey-leg-right');
  await expect(leftLeg).toBeVisible();
  await expect(rightLeg).toBeVisible();
  await expect(leftLeg).toHaveCSS('animation-name', 'monkey-leg-a');
  await expect(rightLeg).toHaveCSS('animation-name', 'monkey-leg-b');
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText(catchPrompt);
  for (let i = 0; i < 5; i++) {
    await catchFirst(page);
    if (i < 4) await expect(page.getByRole('status')).toHaveText(catchPrompt);
  }
  await expect(page.getByRole('heading', { name: 'Great job!' })).toBeVisible();
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(catchPrompt);
  await page.getByRole('button', { name: 'Back to the map' }).first().click();
  await expect(
    page.getByRole('button', { name: 'Play Fruit Stall', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Grocery Shop locked', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Play Fruit Stall' }).click();
  await expect(page.getByRole('button', { name: 'Let’s play' })).toHaveCount(0);
  await expect(page.locator('.unit-map')).toHaveClass(/entering-location/);
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeVisible();
});

test('fruit catch moves continuously, accepts keyboard and touch, and retries a wrong catch', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 668, height: 375 });
  await start(page, 'Fruit Market', 'Market Street');
  const canvas = page.locator('canvas');
  const frame = () =>
    canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  const before = await frame();
  await page.waitForTimeout(400);
  expect(before === (await frame())).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath('fruit-catch-moving.png'),
    fullPage: true,
  });

  // The second lane contains the distractor. It must bounce out, not end the round.
  await tapWorld(page, 478, 600);
  await expect(page.getByRole('status')).toHaveText(
    'It bounced out. Try again!',
    { timeout: 20000 },
  );
  const hint = page.getByRole('button', { name: 'Hint', exact: false });
  await expect(hint).toBeEnabled();
  await hint.click();
  await page.screenshot({
    path: testInfo.outputPath('fruit-catch-hint.png'),
    fullPage: true,
  });
  await catchFirst(page, 360);
  await expect(page.getByRole('status')).toHaveText(catchPrompt);

  // Hold a real key to steer into another target lane in the faster round.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('status')).toContainText('Yes! It is', {
    timeout: 20000,
  });

  // The on-screen controls use the same hold-to-steer path on touch and mouse.
  await expect(page.getByRole('status')).toHaveText(catchPrompt);
  const left = page.getByRole('button', { name: 'Move left', exact: true });
  const box = (await left.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Yes! It is', {
    timeout: 20000,
  });
});

test('fruit catch replays, freezes on pause and resumes falling', async ({
  page,
}) => {
  await start(page, 'Fruit Market', 'Market Street');
  const canvas = page.locator('canvas');
  const frame = () =>
    canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(catchPrompt);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  const frozen = await frame();
  await page.waitForTimeout(350);
  expect(frozen === (await frame())).toBe(true);
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(catchPrompt);
  const resumed = await frame();
  await page.waitForTimeout(350);
  expect(resumed === (await frame())).toBe(false);
});

test('a correct catch advances automatically and pause postpones the transition', async ({
  page,
}) => {
  await start(page, 'Fruit Market', 'Market Street');
  await catchFirst(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByLabel('Round 1 of 5')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(catchPrompt, {
    timeout: 20000,
  });
  await expect(page.getByLabel('Round 2 of 5')).toBeVisible();
});

test('small landscape READY panels scroll instead of clipping their actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await unlockBefore(page, 'Fruit Stall');
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Open Market Street', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Play Fruit Stall', exact: true })
    .click();
  const overlay = page.locator('.overlay');
  const play = page.getByRole('button', { name: 'Let’s play', exact: true });
  await expect(overlay).toBeVisible();
  await expect(play).toBeVisible();
  await expect(overlay).toHaveCSS('overflow-y', 'auto');
  expect(
    await overlay.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.meet-strip')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await play.scrollIntoViewIfNeeded();
  expect(
    await play.evaluate((button) => {
      const action = button.getBoundingClientRect();
      const panel = button.closest('.overlay')!.getBoundingClientRect();
      return action.top >= panel.top && action.bottom <= panel.bottom;
    }),
  ).toBe(true);
  await play.click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?', {
    timeout: 20000,
  });
});

test('All Aboard hides its answer hint and gives vehicles opaque white cards', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await unlockBefore(page, 'All Aboard');
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Open Welcome Harbour', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Play All Aboard', exact: true })
    .click();
  await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?', {
    timeout: 20000,
  });
  await expect(page.locator('.task-collection')).toHaveCount(0);
  // The fourth sequential round is the red bus, kept first by the fixed shuffle.
  for (let i = 0; i < 3; i++) {
    await chooseFirst(page, 3, 640, 645);
    await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  // Above the bus itself, the transparent source reveals the new white backing.
  const pixel = await page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const scale = canvas.width / 1280;
    return Array.from(
      canvas
        .getContext('2d')!
        .getImageData(Math.round(400 * scale), Math.round(460 * scale), 1, 1)
        .data,
    );
  });
  expect(pixel).toEqual([255, 255, 255, 255]);
  await chooseFirst(page, 3, 640, 645);
});

test('Grocery Shop has opaque food art and no active shopping record', async ({
  page,
}, testInfo) => {
  await start(page, 'Grocery Shop', 'Market Street');
  await expect(page.locator('.task-collection')).toHaveCount(0);
  const opaque = await page.evaluate(async () => {
    const results: boolean[] = [];
    for (const name of ['rice', 'egg']) {
      const image = new Image();
      image.src = `/images/food/${name}.webp`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      results.push(
        context
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.every((value, index) => index % 4 !== 3 || value === 255),
      );
    }
    return results;
  });
  expect(opaque).toEqual([true, true]);
  await page.screenshot({
    path: testInfo.outputPath('grocery-opaque-food.png'),
    fullPage: true,
  });
  for (let i = 0; i < 5; i++) {
    await chooseFirst(page, 3);
    if (i < 4)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await expect(page.getByLabel('Shopping basket complete')).toBeVisible();
  await expect(page.locator('.collected-items img')).toHaveCount(5);
});

test('short story collects solved items, keeps three stars on the map, and continues to the next node', async ({
  page,
}) => {
  await start(page, 'Harbour Friends', 'Welcome Harbour');
  for (let i = 0; i < 3; i++) {
    await chooseFirst(page, 3, 640, 645);
    if (i < 2)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await expect(page.getByLabel('Friends together complete')).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await page.getByRole('button', { name: 'Continue adventure' }).click();
  await expect(
    page.getByRole('heading', { name: 'Find the Bus' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Open Welcome Harbour', exact: true })
    .click();
  await expect(
    page
      .locator('.pin')
      .filter({
        has: page.getByRole('button', {
          name: 'Play Harbour Friends',
          exact: true,
        }),
      })
      .getByLabel('3 of 3 stars'),
  ).toBeVisible();
});

test('counting and packing complete six rounds and can restart', async ({
  page,
}) => {
  const images: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/images/count/')) images.push(request.url());
  });
  const ask = 'How many?';
  await start(page, 'Counting Boxes', 'Market Street', ask);
  for (const file of [
    'numeral-2',
    'numeral-3',
    'numeral-4',
    'numeral-5',
    'numeral-6',
    'apples-3',
    'oranges-2',
    'burgers-4',
    'eggs-5',
  ])
    expect(images.some((url) => url.endsWith(`/${file}.webp`))).toBe(true);
  // Count the picture and tap a numeral in the first two rounds.
  for (let i = 0; i < 2; i++) {
    await chooseFirst(page, 4);
    await expect(page.getByRole('status')).toHaveText(ask);
  }
  // Pack 3, 2, 4 and 5 single foods, then tap the box to answer.
  for (const [index, quantity] of [3, 2, 4, 5].entries()) {
    for (let item = 0; item < quantity; item++)
      await tapWorld(page, 70 + item * 140, 545);
    await tapWorld(page, 1000, 540);
    await expect(page.getByRole('status')).toContainText('Yes! It is');
    if (index < 3) await expect(page.getByRole('status')).toHaveText(ask);
  }
  await expect(
    page.getByLabel('Boxes checked complete').locator('img'),
  ).toHaveCount(6);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('status')).toHaveText(ask);
  await expect(page.locator('.task-collection')).toHaveCount(0);
});

test('the last mission ends with friends around the collected picnic food', async ({
  page,
}) => {
  await start(page, 'Picnic Time', 'Market Street');
  for (let i = 0; i < 6; i++) {
    await chooseFirst(page, 4);
    if (i < 5)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await expect(
    page.getByText('The picnic is ready. Thank you for helping everyone!'),
  ).toBeVisible();
  await expect(page.locator('.picnic-friends img')).toHaveCount(3);
  await expect(page.locator('.collected-items img')).toHaveCount(6);
  expect(
    await page
      .locator('.overlay.results')
      .evaluate((overlay) => overlay.scrollHeight <= overlay.clientHeight),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Continue adventure' }),
  ).toHaveCount(0);
});
