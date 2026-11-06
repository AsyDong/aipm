import { test, expect } from '@playwright/test';

test('composer validates, saves, imports and previews a locally composed tap level', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Game Composer for grown-ups' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Game Composer' }),
  ).toBeVisible();
  await page.getByLabel('Title').fill('My Forest Practice');
  await page.getByLabel('Theme').selectOption('FOREST');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Configuration and assets are valid.',
  );
  await page.getByRole('button', { name: 'Save level' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Level saved on this device.',
  );
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'My Forest Practice' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
});

test('rejects incompatible imported configuration without replacing the current draft', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Game Composer for grown-ups' })
    .click();
  await page.getByText('Standard GameDefinition JSON', { exact: true }).click();
  const draft = JSON.parse(await page.locator('.composer pre').innerText());
  draft.input.allowed = ['VOICE'];
  await page.getByLabel('Import JSON').fill(JSON.stringify(draft));
  await page.getByRole('button', { name: 'Import configuration' }).click();
  await expect(page.getByRole('status')).toContainText(
    'matching mechanic input',
  );
  expect(
    JSON.parse(await page.locator('.composer pre').innerText()).input.allowed,
  ).toEqual(['MOUSE', 'TOUCH']);
  expect(
    await page.evaluate(() =>
      localStorage.getItem('english-adventure:composition'),
    ),
  ).toBeNull();
  await expect(page.locator('canvas')).toHaveCount(0);
});
