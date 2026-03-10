import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/CCS · Competencias/i);
});

test('test page loads', async ({ page }) => {
    await page.goto('/test');

    // Verify that the start test button is present
    const startButton = page.locator('#btn-comenzar-test');
    await expect(startButton).toBeVisible();
});
