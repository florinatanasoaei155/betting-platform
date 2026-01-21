import { test, expect } from '@playwright/test';

test.describe('Betting', () => {
  test('should display events list', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByRole('heading', { name: /events/i })).toBeVisible();
  });

  test('should filter events by sport', async ({ page }) => {
    await page.goto('/events');

    const sportFilter = page.locator('select').first();
    await sportFilter.selectOption('football');

    await page.waitForTimeout(500);
    const eventCards = page.locator('[class*="card"]');
    await expect(eventCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to event detail page', async ({ page }) => {
    await page.goto('/events');

    await page.waitForSelector('[class*="card"]', { timeout: 10000 });
    const firstEvent = page.locator('[class*="card"]').first();
    await firstEvent.click();

    await expect(page).toHaveURL(/events\/[a-f0-9-]+/);
  });

  test('should display markets on event detail page', async ({ page }) => {
    await page.goto('/events');

    await page.waitForSelector('[class*="card"]', { timeout: 10000 });
    await page.locator('[class*="card"]').first().click();

    await expect(page.getByText(/match winner|over\/under|handicap/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should add selection to bet slip', async ({ page }) => {
    await page.goto('/events');

    await page.waitForSelector('[class*="card"]', { timeout: 10000 });
    await page.locator('[class*="card"]').first().click();

    await page.waitForSelector('button:has-text(".")', { timeout: 5000 });
    const oddsButton = page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first();
    await oddsButton.click();

    await expect(page.getByText('Bet Slip')).toBeVisible();
    await expect(page.getByText('Place Bet')).toBeVisible();
  });

  test('should update stake input', async ({ page }) => {
    await page.goto('/events');

    await page.waitForSelector('[class*="card"]', { timeout: 10000 });
    await page.locator('[class*="card"]').first().click();

    await page.waitForSelector('button:has-text(".")', { timeout: 5000 });
    await page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first().click();

    const stakeInput = page.locator('input[type="number"]').first();
    await stakeInput.fill('25');

    await expect(stakeInput).toHaveValue('25');
  });

  test('should clear bet slip', async ({ page }) => {
    await page.goto('/events');

    await page.waitForSelector('[class*="card"]', { timeout: 10000 });
    await page.locator('[class*="card"]').first().click();

    await page.waitForSelector('button:has-text(".")', { timeout: 5000 });
    await page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first().click();

    await page.getByText('Clear All').click();

    await expect(page.getByText('Your bet slip is empty')).toBeVisible();
  });
});
