import { test, expect } from '@playwright/test';

test.describe('Bulk Image Optimizer App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check that the main title is present
    await expect(
      page.getByRole('heading', { name: 'Bulk Image Optimizer' })
    ).toBeVisible();

    // Check that the welcome message is present
    await expect(
      page.getByText('Welcome to Bulk Image Optimizer')
    ).toBeVisible();

    // Check that action buttons are present
    await expect(
      page.getByRole('button', { name: 'Get Started' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Learn More' })
    ).toBeVisible();
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');

    // Check semantic HTML structure
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // Check footer content
    await expect(page.getByText('� 2024 Bulk Image Optimizer')).toBeVisible();
  });
});
