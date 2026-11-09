import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Fruit Kitchen' }).click();
  await page.getByRole('button', { name: /^Let/ }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Swipe across the fruit you heard!',
  );
}

async function swipe(page: Page, x: number, touch: boolean, y = 460) {
  const box = (await page.locator('canvas').boundingBox())!;
  const from = {
    x: box.x + (x * box.width) / 1280,
    y: box.y + ((y - 150) * box.height) / 720,
  };
  const to = { x: from.x, y: box.y + ((y + 135) * box.height) / 720 };
  if (touch) {
    // Playwright WebKit has no native touch-drag API or constructible Touch; send touch-shaped DOM events through Phaser.
    await page.locator('canvas').evaluate(
      (canvas, { from, to }) => {
        const send = (type: string, x: number, y: number) => {
          const finger = {
            identifier: 7,
            target: canvas,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
          };
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, {
            touches: { value: type === 'touchend' ? [] : [finger] },
            targetTouches: { value: type === 'touchend' ? [] : [finger] },
            changedTouches: { value: [finger] },
          });
          canvas.dispatchEvent(event);
        };
        send('touchstart', from.x, from.y);
        for (let i = 1; i <= 8; i++)
          send('touchmove', from.x, from.y + ((to.y - from.y) * i) / 8);
        send('touchend', to.x, to.y);
      },
      { from, to },
    );
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
}

test('five swiped rounds, sound, completion and restart reuse Fruit World', async ({
  page,
}, info) => {
  const errors: string[] = [];
  const sounds: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/audio/effects/slice.mp3'))
      sounds.push(request.url());
  });
  await open(page);
  const touch = info.project.name === 'ipad-webkit';
  // With this deterministic shuffle the target is the first candidate, at x=530.
  for (let i = 0; i < 5; i++) {
    await swipe(page, 530, touch);
    await expect(page.getByRole('status')).toContainText('Yes! It is');
    await expect(
      page.getByLabel(`${i + 1} stars`, { exact: true }),
    ).toBeVisible();
    if (i === 0) {
      // Capture midway through the 600ms split, rather than before Phaser's next frame.
      await page.waitForTimeout(180);
      await page.screenshot({ path: info.outputPath('slice-animation.png') });
    }
    await swipe(page, 530, touch); // no second reward
    await expect(
      page.getByLabel(`${i + 1} stars`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: i === 4 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 4)
      await expect(page.getByRole('status')).toHaveText(
        'Swipe across the fruit you heard!',
      );
  }
  await expect(page.getByRole('heading', { name: 'Great job!' })).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  expect(sounds.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Swipe across the fruit you heard!',
  );
  await swipe(page, 530, touch);
  await expect(page.getByLabel('1 stars', { exact: true })).toBeVisible();
});

test('tap does not slice; wrong fruit stays cut, pause/replay work, and the correct fruit can still be sliced', async ({
  page,
}, info) => {
  await open(page);
  const touch = info.project.name === 'ipad-webkit';
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    box.x + (530 * box.width) / 1280,
    box.y + (460 * box.height) / 720,
  );
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await swipe(page, 770, touch);
  await expect(page.getByRole('status')).toHaveText(
    'Try another fruit. Swipe to slice!',
  );
  await swipe(page, 770, touch);
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Swipe across the fruit you heard!',
  );
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Swipe across the fruit you heard!',
  );
  await swipe(page, 530, touch);
  await expect(page.getByRole('status')).toContainText('Yes! It is');
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});
