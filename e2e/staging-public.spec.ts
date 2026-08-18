import { expect, test } from '@playwright/test';

const deployedPreviewUrl = process.env.PLAYWRIGHT_BASE_URL;
const isDeployedPreview = Boolean(
    deployedPreviewUrl
    && !deployedPreviewUrl.startsWith('http://localhost')
    && !deployedPreviewUrl.startsWith('http://127.0.0.1'),
);

test.describe('real staging public paths', () => {
    test.skip(!isDeployedPreview, 'This suite requires a freshly deployed preview URL.');

    test('phone viewport preserves legal, collaborator, and authentication routes', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        const publicPaths: Array<{ path: string; visibleText: RegExp }> = [
            { path: '/privacy', visibleText: /Privacy Policy/i },
            { path: '/terms', visibleText: /Terms of Service/i },
            { path: '/tax-form-upload', visibleText: /Invalid Link/i },
            { path: '/login', visibleText: /Sign In/i },
        ];

        for (const route of publicPaths) {
            const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
            expect(response?.status(), `${route.path} should be reachable`).toBe(200);
            await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}\\/?$`));
            // ISSUE-1368: /tax-form-upload renders "Invalid Link" only after the
            // lazy TaxFormUpload module loads behind the app boot sequence
            // (auth listener + App Check). On a cold staging preview channel the
            // headless CI browser intermittently exceeds 15s (proven flake: same
            // renderer passed CI #277 and failed #278 at exactly the 15s mark,
            // URL correct, text absent). 30s absorbs boot variance without
            // weakening the route/URL/text assertions themselves.
            await expect(page.getByText(route.visibleText).first()).toBeVisible({ timeout: 30_000 });
            await expect(page.getByText('Studio Disconnected')).toHaveCount(0);
        }
    });

    test('signed-out root exposes real authentication without creating a session', async ({ page }) => {
        const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);

        await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('input[type="password"]').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /^Sign In$/i }).first()).toBeVisible();
        await expect(page.getByTestId('app-container')).toHaveCount(0);
    });
});
