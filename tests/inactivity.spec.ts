import { test, expect, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Alex');
  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('registration resets after 30 idle seconds and clears player and keyboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Alex');
  await page.clock.runFor(29_000);
  await expect(page.locator('.approved-registration')).toBeVisible();
  await page.clock.runFor(1_000);
  await expect(page.locator('.approved-home')).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await expect(page.locator('.air-touch-keyboard')).toHaveCount(0);
});

test('instructions show only the fourth heading and reset after inactivity', async ({ page }, testInfo) => {
  await register(page);
  await expect(page.getByText('BE ACCURATE AND QUICK', { exact: true })).toBeVisible();
  await expect(page.getByText('Highest correct count wins.')).toHaveCount(0);
  await expect(page.getByText('Lowest total time breaks a tie.')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('instructions.png') });
  await page.clock.runFor(30_000);
  await expect(page.locator('.approved-home')).toBeVisible();
});

test('touch and keyboard input restart the inactivity deadline', async ({ page }) => {
  await register(page);
  await page.clock.runFor(20_000);
  await page.locator('.approved-instructions h2').tap();
  await page.clock.runFor(20_000);
  await expect(page.locator('.approved-instructions')).toBeVisible();
  await page.keyboard.press('Shift');
  await page.clock.runFor(29_000);
  await expect(page.locator('.approved-instructions')).toBeVisible();
  await page.clock.runFor(1_000);
  await expect(page.locator('.approved-home')).toBeVisible();
});

test('legacy settings upgrade and automatic question changes do not extend inactivity', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('ai-or-real.store.v1', JSON.stringify({
    results: [],
    settings: { idleTimeoutSeconds: 120, questionTimeLimitSeconds: 5 },
  })));
  await page.reload();
  await register(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose top image as the real photograph' })).toBeEnabled();
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(7_000);
    await expect(page.locator('.approved-game')).toBeVisible();
  }
  await expect(page.locator('.ag-round')).not.toHaveText('ROUND 01 / 10');
  await page.clock.runFor(2_000);
  await expect(page.locator('.approved-home')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ai-or-real.store.v1')!).results)).toEqual([]);
});
