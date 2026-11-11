import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, name: string, unit: string) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { progress: [] } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: `Open ${unit}`, exact: true }).click();
  await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
  await page.getByRole('button', { name: /^Let/ }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?', {
    timeout: 20000,
  });
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
  const box = (await page.locator('canvas').boundingBox())!;
  const px = box.x + (x * box.width) / 1280,
    py = box.y + (y * box.height) / 720;
  if (page.context().browser()?.browserType().name() === 'webkit')
    await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
  await expect(page.getByRole('status')).toContainText('Yes! It is');
}

test('the world map shows U0-U9 and a unit opens its own numbered locations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 668, height: 375 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'World map' })).toBeVisible();
  await expect(page.locator('.world-art')).toHaveAttribute(
    'src',
    '/images/maps/world.webp',
  );
  await expect(page.locator('.chapter-nav')).toHaveCount(0);
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
});

test('short story collects solved items, keeps three stars on the map, and continues to the next node', async ({
  page,
}) => {
  await start(page, 'Harbour Friends', 'Welcome Harbour');
  const collected = page.getByLabel('Friends together', { exact: true });
  await expect(collected.locator('img')).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await chooseFirst(page, 3, 640, 645);
    await expect(collected.locator('img')).toHaveCount(i + 1);
    await page
      .getByRole('button', { name: i === 2 ? 'Finish' : 'Next', exact: false })
      .click();
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

test('counted choices load same-food alternatives; restart clears the collected boxes', async ({
  page,
}) => {
  const images: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/images/count/')) images.push(request.url());
  });
  await start(page, 'Counting Boxes', 'Market Street');
  for (const count of [2, 3, 4, 5, 6])
    expect(images.some((url) => url.endsWith(`/apples-${count}.webp`))).toBe(
      true,
    );
  for (let i = 0; i < 4; i++) {
    await chooseFirst(page, 3);
    await expect(
      page.getByLabel('Boxes checked', { exact: true }).locator('img'),
    ).toHaveCount(i + 1);
    await page
      .getByRole('button', { name: i === 3 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 3)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByLabel('Boxes checked', { exact: true }).locator('img'),
  ).toHaveCount(0);
});

test('the last mission ends with friends around the collected picnic food', async ({
  page,
}) => {
  await start(page, 'Picnic Time', 'Market Street');
  for (let i = 0; i < 6; i++) {
    await chooseFirst(page, 4);
    await page
      .getByRole('button', { name: i === 5 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 5)
      await expect(page.getByRole('status')).toHaveText('Which one is it?');
  }
  await expect(
    page.getByText('The picnic is ready. Thank you for helping everyone!'),
  ).toBeVisible();
  await expect(page.locator('.picnic-friends img')).toHaveCount(3);
  await expect(page.locator('.collected-items img')).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: 'Continue adventure' }),
  ).toHaveCount(0);
});
