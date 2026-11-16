import { test, expect, type Page } from '@playwright/test';

const games = [
  ['Picture Pairs', 'Flip two cards. Match two pictures of the word you hear!'],
  [
    'Little Chef',
    'Drag the food you hear into the pot, or tap it to send it cooking!',
  ],
  [
    'Word Racers',
    'Choose the lane with the word you hear and race to the finish!',
  ],
  [
    'Maze Explorer',
    'Tap a picture. Find a path through the maze to collect it!',
  ],
  [
    'Sky Jumper',
    'Drag to move. Swipe up or tap the sky to jump to the picture!',
  ],
  [
    'Bubble Pop',
    'Tap a moving bubble to launch a star at the picture you hear!',
  ],
  [
    'Word Golf',
    'Swipe toward the picture you hear. A longer swipe hits farther!',
  ],
  [
    'Little Builders',
    'Tap the material you hear. Lift it over and build a new floor!',
  ],
  [
    'Garden Guardians',
    'Tap the guardian with the word you hear to splash its grumpy cloud!',
  ],
  [
    'Power Quest',
    'Choose the power card you hear and watch your hero take a turn!',
  ],
] as const;

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  return {
    x: box.x + (x * box.width) / 1280,
    y: box.y + (y * box.height) / 720,
  };
}
async function tap(page: Page, x: number, y: number, touch: boolean) {
  const at = await point(page, x, y);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  touch: boolean,
) {
  const start = await point(page, from.x, from.y);
  const end = await point(page, to.x, to.y);
  if (!touch) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    return;
  }
  await page.locator('canvas').evaluate(
    (canvas, { start, end }) => {
      const send = (type: string, x: number, y: number) => {
        const finger = {
          identifier: 4,
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
      send('touchstart', start.x, start.y);
      for (let index = 1; index <= 12; index++)
        send(
          'touchmove',
          start.x + ((end.x - start.x) * index) / 12,
          start.y + ((end.y - start.y) * index) / 12,
        );
      send('touchend', end.x, end.y);
    },
    { start, end },
  );
}
async function open(page: Page, title: string, instruction: string) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Game arcade' }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose a game' }),
  ).toBeVisible();
  await expect(page.locator('.arcade-card')).toHaveCount(10);
  await page
    .getByRole('button', { name: `Play ${title}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText(instruction, {
    timeout: 20000,
  });
}

for (const [title, instruction] of games) {
  test(`${title} loads the current lesson and completes a real action`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await open(page, title, instruction);
    const touch = info.project.name === 'ipad-webkit';
    await page.screenshot({ path: info.outputPath('before-action.png') });
    switch (title) {
      case 'Picture Pairs':
        await tap(page, 420, 267, touch);
        await tap(page, 420, 512, touch);
        break;
      case 'Little Chef':
        await tap(page, 275, 280, touch);
        break;
      case 'Word Racers':
        await tap(page, 380, 410, touch);
        break;
      case 'Maze Explorer':
        await tap(page, 1060, 190, touch);
        break;
      case 'Sky Jumper':
        await swipe(page, { x: 100, y: 590 }, { x: 300, y: 300 }, touch);
        break;
      case 'Bubble Pop':
        await tap(page, 440, 240, touch);
        break;
      case 'Word Golf':
        await swipe(page, { x: 170, y: 570 }, { x: 570, y: 275 }, touch);
        break;
      case 'Little Builders':
        await tap(page, 250, 260, touch);
        break;
      case 'Garden Guardians':
        await tap(page, 320, 545, touch);
        break;
      case 'Power Quest':
        await tap(page, 320, 585, touch);
        break;
    }
    await page.screenshot({ path: info.outputPath('after-action.png') });
    await expect(page.getByRole('status')).toContainText('Yes! It is', {
      timeout: 20000,
    });
    await expect(page.getByLabel('1 stars', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('correct-action.png') });
  });
}

test('the picker returns from a game and keeps normal story navigation intact', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Game arcade' }).click();
  await page.getByRole('button', { name: 'Play Picture Pairs' }).click();
  await expect(
    page.getByRole('heading', { name: 'Picture Pairs' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to games' }).click();
  await expect(page.locator('.arcade-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Open Welcome Harbour' }).click();
  await expect(
    page.getByRole('button', { name: /Play / }).first(),
  ).toBeVisible();
});
