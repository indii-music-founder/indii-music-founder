import { test, expect } from '@playwright/test';

test.describe('Temporal Session Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Create, Switch, and Verify Session State', async ({ page }) => {
        // 1. Open Chat Overlay
        const chatToggle = page.getByTitle('Open Chat');
        await chatToggle.click();

        // 2. Create a new session
        const newChatBtn = page.getByTitle('New');
        await newChatBtn.click();

        // 3. Send a message in Session A
        const input = page.getByPlaceholder(/type a message/i);
        await input.fill('Message in Session A');
        await input.press('Enter');
        await expect(page.getByText('Message in Session A')).toBeVisible();

        // 4. Create another session (Session B)
        await newChatBtn.click();
        await expect(page.getByText('Temporal Stream')).toHaveCount(2); // History list should have 2
        await expect(page.getByText('Message in Session A')).not.toBeVisible();

        // 5. Switch back to Session A
        const sessionA = page.getByText('Temporal Stream').last(); // Simplistic selector for now
        await sessionA.click();
        await expect(page.getByText('Message in Session A')).toBeVisible();
    });

    test('Summon Agent into Session', async ({ page }) => {
        const chatToggle = page.getByTitle('Open Chat');
        await chatToggle.click();

        // 1. Open Invite/Council Directory
        const inviteBtn = page.getByTitle('Invite');
        await inviteBtn.click();

        // 2. Summon Creative Director
        const creativeCard = page.getByText('Creative Director');
        await creativeCard.click();

        // 3. Verify Active badge
        await expect(page.getByText('ACTIVE')).toBeVisible();
        await expect(page.getByText('Agents Active')).toContainText('2'); // Indii + Creative
    });
});
