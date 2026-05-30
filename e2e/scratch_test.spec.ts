import { test, expect } from '@playwright/test';

test('Live Test: Creative Director', async ({ page }) => {
  await page.goto('http://localhost:4242');
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Browser Error: ${msg.text()}`);
    }
  });

  // Wait for either the guest button OR the creative button
  try {
      await page.waitForSelector('button:has-text("Explore as Guest")', { timeout: 5000 });
      await page.getByRole('button', { name: /Explore as Guest/i }).click();
  } catch (e) {
      // ignore
  }

  // Handle cookie dialog if present
  try {
      const rejectBtn = page.getByRole('button', { name: 'Reject non-essential cookies' });
      if (await rejectBtn.isVisible()) await rejectBtn.click();
  } catch(e) {}
  
  // Wait for the sidebar and click Creative Director
  await page.getByTestId('nav-item-creative').click();

  // Handle onboarding dialog if present
  try {
      const closeBtn = page.getByRole('button', { name: 'Close' });
      if (await closeBtn.isVisible()) await closeBtn.click();
  } catch (e) {}
  
  // Find the image generation prompt
  const promptInput = page.getByPlaceholder('Describe your image...');
  await promptInput.fill('Futuristic neon city');
  
  // Press Enter to trigger generation (or find the specific button in the prompt bar)
  await promptInput.press('Enter');
  
  // Verify Toast
  await expect(page.locator('text=generated directly')).toBeVisible({ timeout: 30000 });
});
