import { test, expect, type Page } from '@playwright/test';

/** Deterministic capture only; this does not certify hardware or recognition quality. */
async function mockMicrophone(page: Page) {
  await page.addInitScript(() => {
    const state = { denied: false, tracksStopped: 0, captures: 0 };
    Object.assign(window, { microphoneTest: state });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          state.captures++;
          if (state.denied) throw new DOMException('Denied', 'NotAllowedError');
          return {
            getTracks: () => [
              {
                stop: () => {
                  state.tracksStopped++;
                },
              },
            ],
          };
        },
      },
    });
    class Recorder {
      static isTypeSupported(type: string) {
        return type === 'audio/mp4';
      }
      mimeType = 'audio/mp4';
      state = 'inactive';
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        setTimeout(() => {
          this.ondataavailable?.({
            data: new Blob(['fake voice'], { type: 'audio/mp4' }),
          });
          this.onstop?.();
        }, 0);
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
  });
}
async function open(page: Page) {
  await mockMicrophone(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Talking Market' }).click();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Record and say the word!',
  );
}
async function record(page: Page) {
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Say the word! Tap Done when you finish.',
  );
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

test('voice retry, wrong word, five matches and restart use the shared rewards', async ({
  page,
}, info) => {
  let reply = { text: 'unrelated', confidence: 0.2 };
  // Keep the public curriculum order deterministic; do not read runtime answer state.
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.route('**/api/speech/recognize', (route) => {
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ json: reply });
  });
  await open(page);
  await record(page);
  await expect(page.getByRole('status')).toHaveText(
    'I did not hear that. Try again!',
  );
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  reply = { text: 'unrelated', confidence: 0.9 };
  await record(page);
  await expect(page.getByRole('status')).toHaveText(
    'Hmm, not that one. Listen again!',
  );
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Record and say the word!',
  );
  for (let i = 0; i < 5; i++) {
    reply = {
      text: ` “${['apple', 'banana', 'grapes', 'orange', 'watermelon'][i]!.toUpperCase()}!”\n`,
      confidence: 0.9,
    };
    await record(page);
    await expect(page.getByRole('status')).toContainText('Yes! It is');
    if (i === 0)
      await page.screenshot({
        path: info.outputPath('voice-match.png'),
        fullPage: true,
      });
    await page
      .getByRole('button', { name: i === 4 ? 'Finish' : 'Next', exact: false })
      .click();
    if (i < 4)
      await expect(page.getByRole('status')).toHaveText(
        'Tap Record and say the word!',
      );
  }
  await expect(page.getByRole('heading', { name: 'Great job!' })).toBeVisible();
  await page.getByText('Grown-up notes').click();
  await expect(page.getByText(/First choices: 4 \/ 5/)).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Record and say the word!',
  );
});

test('permission refusal and service failure retry; pause cancels capture and stale ASR', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    (
      window as unknown as { microphoneTest: { denied: boolean } }
    ).microphoneTest.denied = true;
  });
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('allow the microphone');
  await page.evaluate(() => {
    (
      window as unknown as { microphoneTest: { denied: boolean } }
    ).microphoneTest.denied = false;
  });
  await page.route('**/api/speech/recognize', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await record(page);
  await expect(page.getByRole('status')).toContainText(
    'Tap Record to try again',
  );
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Done', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { microphoneTest: { tracksStopped: number } })
          .microphoneTest.tracksStopped,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Tap Record and say the word!',
  );
  await page.unroute('**/api/speech/recognize');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/speech/recognize', async (route) => {
    await gate;
    await route
      .fulfill({ json: { text: 'apple', confidence: 0.9 } })
      .catch(() => {});
  });
  await record(page);
  await expect(page.getByRole('status')).toHaveText('Let me listen…');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Break time' })).toBeVisible();
  release();
  await expect(page.getByLabel('0 stars', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});
