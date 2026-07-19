import { test, expect } from './fixtures/auth';

test.describe('ISSUE-777 Verification: Image Mode Payload Capture', () => {
    test('verifies all Advanced Config controls route correctly to generateImageV3 payload', async ({ authedPage: page }) => {
        // Intercept the API request to capture payload
        let capturedPayload: any = null;
        
        await page.route('**/generateImageV3*', async route => {
            const request = route.request();
            if (request.method() === 'POST') {
                const postData = request.postDataJSON();
                capturedPayload = postData?.data || postData;
            }
            // Fulfill with a mock to avoid spending quota
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        resultUris: ['gs://mock/1.png', 'gs://mock/2.png', 'gs://mock/3.png']
                    }
                })
            });
        });

        // Mock billing/cost APIs to prevent UI crash (StudioControlsPanel expects properties)
        await page.route('**/getOperationCostStatus*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        dailyUsed: 0,
                        monthlyUsed: 0,
                        dailyRemaining: 1000,
                        monthlyRemaining: 1000,
                        tier: 'pro',
                        pendingHoldCost: 0,
                        pendingHoldCount: 0,
                        settledCost: 0,
                        voidedCost: 0
                    }
                })
            });
        });

        await page.route('**/getOperationCostHistory*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        operations: [],
                        nextCursor: null,
                        hasMore: false
                    }
                })
            });
        });

        // 1. Go to the app
        await page.goto('/', { waitUntil: 'networkidle' });
        
        // 2. Navigate to Creative -> Direct Generation -> Image mode
        await page.click('text=Creative');
        // Give time for lazy load and module render
        await page.waitForTimeout(2000);
        
        // Try to click Direct Generation or ensure we are on it
        const directGenTab = page.locator('text=Direct Generation');
        if (await directGenTab.isVisible()) {
            await directGenTab.click();
        }

        // Switch to Image mode if not already
        const imageModeBtn = page.getByTestId('direct-image-mode-btn');
        if (await imageModeBtn.isVisible()) {
            await imageModeBtn.click();
        }
        await page.waitForTimeout(1000);

        // 3. Open Advanced Config
        const advancedConfigBtn = page.locator('text=Advanced Config');
        if (await advancedConfigBtn.isVisible()) {
            await advancedConfigBtn.click();
        }
        await page.waitForTimeout(1000);

        // 4. Confirm video-only controls are absent
        const engineResolution = page.locator('text=Engine Resolution Preset');
        const safetyPolicy = page.locator('text=Safety Policy Grade');
        await expect(engineResolution).not.toBeVisible();
        await expect(safetyPolicy).not.toBeVisible();

        // 5. Select settings using the exact data-testids from the scratchpad
        // Or if they are visible text:
        // Size: 1K (assume select or button)
        // For now, let's look for specific test IDs mentioned:
        // Count: 3 (direct-batch-3)
        // Response: image_and_text (direct-response-image_and_text)
        // Thinking: minimal (direct-thinking-minimal)
        // Include thoughts: true (direct-include-thoughts-toggle)
        // Google Search: true (direct-google-search-toggle)
        // Image Search: true (direct-image-search-toggle)

        const setChecked = async (selector: string, targetChecked: boolean) => {
            const el = page.locator(selector);
            if (await el.isVisible()) {
                const isChecked = await el.isChecked().catch(() => false);
                if (isChecked !== targetChecked) {
                    await el.click({ force: true });
                }
            } else {
                console.log(`Warning: ${selector} not visible`);
            }
        };

        // Output size 1k (might be a select or radio)
        // We will just try to click text=1K or similar if we don't know the selector
        const size1k = page.locator('text=1K').first();
        if (await size1k.isVisible()) await size1k.click();

        await page.locator('[data-testid="direct-batch-3"]').click().catch(() => console.log('batch-3 not found'));
        await page.locator('[data-testid="direct-response-image_and_text"]').click().catch(() => console.log('response not found'));
        await page.locator('[data-testid="direct-thinking-minimal"]').click().catch(() => console.log('thinking not found'));
        
        await setChecked('[data-testid="direct-include-thoughts-toggle"]', true);
        await setChecked('[data-testid="direct-google-search-toggle"]', true);
        await setChecked('[data-testid="direct-image-search-toggle"]', true);

        // Enter a prompt
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        if (await promptInput.isVisible()) {
            await promptInput.fill('A cyberpunk city skyline at night');
        } else {
            await page.locator('textarea').first().fill('A cyberpunk city skyline at night');
        }

        // Turn off the local E2E mock so it makes the actual network request we can intercept
        await page.evaluate(() => {
            (window as any).FIREBASE_E2E_MOCK = false;
        });

        // Click Generate
        const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
        if (await generateBtn.isVisible()) {
            await generateBtn.click();
        } else {
            await page.locator('button:has-text("Generate")').first().click();
        }

        // Wait for network request to be captured
        await page.waitForTimeout(3000);

        expect(capturedPayload).not.toBeNull();
        console.log("Captured Payload:", JSON.stringify(capturedPayload, null, 2));

        // 6. Prove payload contains expected values
        if (capturedPayload) {
            expect(capturedPayload.count).toBe(3);
            expect(capturedPayload.imageSize).toBe('1k');
            expect(capturedPayload.thinkingLevel).toBe('minimal');
            expect(capturedPayload.includeThoughts).toBe(true);
            expect(capturedPayload.useGoogleSearch).toBe(true);
            expect(capturedPayload.useImageSearch).toBe(true);
            expect(capturedPayload.responseFormat).toBe('image_and_text');
        }
    });
});
