import { test, expect } from '@playwright/test';

test('unfinished learning survives reload and retries the identical session after reconnection', async ({
  page,
}) => {
  let available = false;
  const received: unknown[] = [];
  await page.route('**/api/v1/**', async (route) => {
    if (!available) return route.abort('failed');
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { progress: [] } });
    const data = route.request().postDataJSON();
    received.push(data);
    return route.fulfill({ json: { sessionId: data.session.sessionId } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Market Street' }).click();
  await page.getByRole('button', { name: 'Play Fruit Market' }).click();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
  await page.getByRole('button', { name: 'Back to the map' }).click();
  const pending = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('english-adventure:learning:'))
        .map((key) => JSON.parse(localStorage.getItem(key)!)),
    );
  await expect.poll(async () => (await pending()).length).toBe(1);
  const before = (await pending())[0];
  expect(before.completed).toBe(false);
  expect(before.records[0]).toMatchObject({
    listens: 2,
    attempts: 0,
    needsReview: true,
  });
  expect(JSON.stringify(before)).not.toMatch(/"(audio|text|points|stars)":/);
  await page.reload();
  expect(await pending()).toEqual([before]);
  await page.getByText('Learning notes for grown-ups').click();
  await expect(
    page.getByText('Learning notes saved on this device. Sync pending.', {
      exact: true,
    }),
  ).toBeVisible();
  available = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => (await pending()).length).toBe(0);
  expect(received).toEqual([before]);
  await expect(
    page.getByText('Learning notes synced.', { exact: true }),
  ).toBeVisible();
});
