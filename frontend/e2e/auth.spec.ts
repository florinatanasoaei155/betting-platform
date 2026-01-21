import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should display registration page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /register|sign up/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /register|sign up/i }).click();
    await expect(page).toHaveURL(/register/);
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should register a new user successfully', async ({ page }) => {
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    const username = `testuser${timestamp}`;

    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /register|sign up/i }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
