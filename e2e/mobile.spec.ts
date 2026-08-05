import { test, expect } from '@playwright/test';

test('Mobile app loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.goto('/');
  // Wait for network to be idle to ensure hydration/mounting completes
  await page.waitForLoadState('networkidle');

  // Basic check to see if body is not completely empty
  const body = await page.locator('body');
  await expect(body).toBeVisible();

  // If there are unhandled exceptions, fail the test
  expect(errors).toEqual([]);
});
