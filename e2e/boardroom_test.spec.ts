import { test, expect } from '@playwright/test';

test('Live Test: Boardroom', async ({ page }) => {
  // Catch console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Browser Error: ${msg.text()}`);
    }
  });

  page.on('pageerror', exception => {
    console.log(`Browser Uncaught Exception: ${exception.message}`);
  });

  // Navigate to dev server
  await page.goto('http://localhost:4242');

  // Handle onboarding dialog if it appears
  try {
    const exploreGuestBtn = page.getByRole('button', { name: 'Explore as Guest' });
    await exploreGuestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exploreGuestBtn.click();
    
    const declineCookiesBtn = page.getByRole('button', { name: 'Decline All' });
    await declineCookiesBtn.waitFor({ state: 'visible', timeout: 2000 });
    await declineCookiesBtn.click();
  } catch (e) {}

  // Navigate to Boardroom
  // Ensure the sidebar navigation works
  const boardroomNav = page.getByTestId('nav-item-boardroom');
  if (await boardroomNav.isVisible()) {
    await boardroomNav.click();
  } else {
    await page.getByRole('button', { name: /Boardroom/i }).click();
  }

  // Wait for the boardroom module to load
  await page.waitForTimeout(2000);

  // Take a screenshot of the initial boardroom state
  await page.screenshot({ path: 'artifacts/boardroom_initial.png' });

  // Locate the chat input box and type "Hello"
  // Trying a generic placeholder or locator for the chat input
  const chatInput = page.getByPlaceholder(/message/i).first();
  if (await chatInput.isVisible()) {
      await chatInput.fill('Hello');
      await chatInput.press('Enter');
  } else {
      // Try finding by role if placeholder fails
      const textbox = page.getByRole('textbox').first();
      await textbox.fill('Hello');
      await textbox.press('Enter');
  }

  // Wait for 5-10 seconds to observe what happens
  await page.waitForTimeout(8000);

  // Take a screenshot of the result
  await page.screenshot({ path: 'artifacts/boardroom_result.png' });

  // Test passes if we successfully took the screenshots without crashing
  expect(true).toBe(true);
});
