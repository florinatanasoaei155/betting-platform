import { test, expect } from '@playwright/test';

test.describe('Parlay Betting', () => {
  async function addSelectionsFromDifferentEvents(page: any, count: number = 2) {
    await page.goto('/events');
    await page.waitForSelector('[class*="card"]', { timeout: 10000 });

    const eventCards = page.locator('[class*="card"]');
    const eventCount = await eventCards.count();

    for (let i = 0; i < Math.min(count, eventCount); i++) {
      await page.goto('/events');
      await page.waitForSelector('[class*="card"]', { timeout: 10000 });
      await eventCards.nth(i).click();

      await page.waitForSelector('button:has-text(".")', { timeout: 5000 });
      const oddsButton = page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first();
      await oddsButton.click();
    }
  }

  test('should show parlay mode toggle with 2+ selections', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);

    await expect(page.getByText('Singles')).toBeVisible();
    await expect(page.getByText('Parlay')).toBeVisible();
  });

  test('should switch to parlay mode', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);

    await page.getByText('Parlay').click();

    await expect(page.getByText('Combined Odds:')).toBeVisible();
    await expect(page.getByText('Parlay Stake')).toBeVisible();
    await expect(page.getByText('Place Parlay')).toBeVisible();
  });

  test('should calculate combined odds correctly', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);
    await page.getByText('Parlay').click();

    const combinedOddsText = await page.getByText('Combined Odds:').locator('..').textContent();
    expect(combinedOddsText).toMatch(/Combined Odds:\s*\d+\.\d+/);
  });

  test('should update parlay stake', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);
    await page.getByText('Parlay').click();

    const stakeInput = page.locator('input[type="number"]');
    await stakeInput.fill('50');

    await expect(stakeInput).toHaveValue('50');
  });

  test('should calculate potential payout in parlay mode', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);
    await page.getByText('Parlay').click();

    await expect(page.getByText('Potential Payout:')).toBeVisible();
    const payoutSection = page.getByText('Potential Payout:').locator('..');
    const payoutText = await payoutSection.textContent();
    expect(payoutText).toMatch(/\$\d+\.\d+/);
  });

  test('should not show stake inputs per selection in parlay mode', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);

    const singlesInputs = await page.locator('input[type="number"]').count();
    expect(singlesInputs).toBe(2);

    await page.getByText('Parlay').click();

    const parlayInputs = await page.locator('input[type="number"]').count();
    expect(parlayInputs).toBe(1);
  });

  test('should switch back to singles mode', async ({ page }) => {
    await addSelectionsFromDifferentEvents(page, 2);

    await page.getByText('Parlay').click();
    await expect(page.getByText('Combined Odds:')).toBeVisible();

    await page.getByText('Singles').click();
    await expect(page.getByText('Total Stake:')).toBeVisible();
  });

  test('should show My Bets page with Parlays tab', async ({ page }) => {
    const timestamp = Date.now();
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(`test${timestamp}@example.com`);
    await page.getByLabel(/username/i).fill(`testuser${timestamp}`);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /register|sign up/i }).click();

    await page.waitForURL('/', { timeout: 10000 });

    await page.goto('/my-bets');
    await expect(page.getByText('Single Bets')).toBeVisible();
    await expect(page.getByText('Parlays')).toBeVisible();
  });

  test('should switch between Single Bets and Parlays tabs', async ({ page }) => {
    const timestamp = Date.now();
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(`test${timestamp}@example.com`);
    await page.getByLabel(/username/i).fill(`testuser${timestamp}`);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /register|sign up/i }).click();

    await page.waitForURL('/', { timeout: 10000 });
    await page.goto('/my-bets');

    await page.getByText('Parlays').click();
    await expect(page.getByText("You haven't placed any parlays yet")).toBeVisible();

    await page.getByText('Single Bets').click();
    await expect(page.getByText("You haven't placed any single bets yet")).toBeVisible();
  });
});
