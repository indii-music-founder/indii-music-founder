
import { test, expect } from '@playwright/test';

// Increase global timeout for AI operations
test.setTimeout(180000);

test.describe('Indii-Bot Verification', () => {
  // Use localStorage to bypass Auth
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4242',
          localStorage: [
            { name: 'TEST_MODE', value: 'true' }
          ]
        }
      ]
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const commandInput = page.getByTestId('command-bar-input-container').locator('textarea');
    await expect(commandInput).toBeVisible({ timeout: 20000 });
  });

  test('Daily Process: Draft 50/50 Split Sheet', async ({ page }) => {
    // 2. PROMPT: Enter a complex industry task
    const commandInput = page.getByTestId('command-bar-input-container').locator('textarea');
    const prompt = 'Draft a 50/50 split sheet for a producer collaboration';
    await commandInput.fill(prompt);

    // Submit the prompt
    const runButton = page.getByTestId('command-bar-input-container').getByRole('button', { name: 'Run' });
    await runButton.click();

    // 3. OBSERVE: Watch for the Agent Chat Overlay to open
    await expect(page.getByTestId('agent-message').first()).toBeVisible({ timeout: 30000 });

    // 4. VALIDATE: Verify the final asset
    // The AI generates a "MUSIC COLLABORATION & SPLIT AGREEMENT" or similar.
    // We check for key terms that indicate a legal document.
    const lastMessage = page.getByTestId('agent-message').last();

    // Use generic terms that must appear in a split sheet
    await expect(lastMessage).toContainText('AGREEMENT', { timeout: 90000 });
    await expect(lastMessage).toContainText('Producer', { timeout: 90000 });
    // It might be "50%" or "50/50"
    await expect(lastMessage).toContainText(/50%|50\/50/, { timeout: 90000 });
  });

  test('Multimodal Feedback: Image Generation', async ({ page }) => {
    const commandInput = page.getByTestId('command-bar-input-container').locator('textarea');
    const runButton = page.getByTestId('command-bar-input-container').getByRole('button', { name: 'Run' });

    // 2. Generate Image
    await commandInput.fill('Generate an album cover for a lo-fi hip hop release');
    await runButton.click();

    // Wait for response
    await expect(page.getByTestId('agent-message').first()).toBeVisible({ timeout: 30000 });
    const lastMessage = page.getByTestId('agent-message').last();

    // Check for an image OR a text confirmation if the image generation service is mocked/unavailable
    // We try to find an image first
    try {
        await expect(lastMessage.getByRole('img')).toBeVisible({ timeout: 60000 });
    } catch (e) {
        // Fallback: Check if the text describes the image or tool execution
        await expect(lastMessage).toContainText(/image|cover|generated/i);
    }

    // 3. Feedback: "Make it darker"
    await commandInput.fill('Make it darker');
    await runButton.click();

    // Validate change
    // We expect a new response
    await expect(async () => {
      const messages = page.getByTestId('agent-message');
      const count = await messages.count();
      // We expect at least 2 agent messages (one for initial, one for revision)
      // Note: The prompt input also creates user messages.
      expect(count).toBeGreaterThanOrEqual(2);

      const latest = messages.last();
      // Check if it acknowledges the feedback
      await expect(latest).toContainText(/darker|adjusted|revised/i);
    }).toPass({ timeout: 90000 });
  });

});
