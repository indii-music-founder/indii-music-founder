
import { test, expect } from '@playwright/test';

test.describe('Full AI Integration E2E', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Setup: Land on Dashboard and Log in / Create Org if needed
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Handle specific "Get Started" or "Select Org" flows if they appear
        if (await page.getByText('Create New Organization').isVisible()) {
            await page.getByPlaceholder('Organization Name').fill('E2E Test Corp');
            await page.getByRole('button', { name: 'Create', exact: true }).click();
        } else if (await page.getByText('Select Organization').isVisible()) {
            // Select the first available org if list exists
            await page.locator('.org-card').first().click();
        }
    });

    test('Creative Director: Generate Image Flow', async ({ page }) => {
        // Navigate to Art Department
        await page.getByRole('button', { name: 'Art Department' }).click();

        // Open Agent
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        } else {
            // Fallback: try finding by icon or assume it's open
        }

        const agentInput = page.getByPlaceholder('Command the agent...');
        await expect(agentInput).toBeVisible();

        // Send Command
        await agentInput.fill('Generate a cinematic poster for a sci-fi movie.');
        await page.locator('button:has(svg.lucide-send)').click();

        // Verification: Look for "Generating..." or the result
        // Since this is a real AI call, it might take time.
        // We look for the user message first to confirm send
        await expect(page.getByText('Generate a cinematic poster')).toBeVisible();

        // We assume the successful response will eventually appear.
        // In a real E2E, verifying the visual image is hard, but we can check for text response indicating success
        // "I've generated a poster..." or similar.
        // Or check if an image element appeared in the chat stream.
        await expect(page.locator('img[alt="Generated Image"]')).toBeVisible({ timeout: 60000 });
    });

    test('Road Manager: Route Planning Flow', async ({ page }) => {
        // Navigate to Road Department (Touring)
        await page.getByRole('button', { name: 'Touring' }).click();

        // Open Agent
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        }

        const agentInput = page.getByPlaceholder('Command the agent...');
        await agentInput.fill('Plan a tour route from Detroit to Chicago with a stop in Kalamazoo.');
        await page.locator('button:has(svg.lucide-send)').click();

        await expect(page.getByText('Plan a tour route')).toBeVisible();

        // Verify simulated response contains structured data elements
        // e.g. "Distance:", "Duration:", or the specific cities
        await expect(page.getByText('Detroit')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Chicago')).toBeVisible({ timeout: 30000 });
        // RoadAgent return usually includes "Route plan" text
        await expect(page.getByText('Route Order')).toBeVisible({ timeout: 30000 });
    });

    test('Marketing Manager: Campaign Brief Flow', async ({ page }) => {
        // Navigate to Marketing
        await page.getByRole('button', { name: 'Marketing' }).click();

        // Open Agent
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        }

        const agentInput = page.getByPlaceholder('Command the agent...');
        await agentInput.fill('Create a campaign brief for a new summer single "Sunburn".');
        await page.locator('button:has(svg.lucide-send)').click();

        await expect(page.getByText('Create a campaign brief')).toBeVisible();

        // Verify structured brief
        await expect(page.getByText('Target Audience')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('KPIs')).toBeVisible({ timeout: 30000 });
    });

});
