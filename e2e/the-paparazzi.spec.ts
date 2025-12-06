import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://architexture-ai-studio.web.app';
const TEST_TIMESTAMP = Date.now();
// Minimal valid 1x1 pixel PNG (red)
const PNG_BUFFER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const FILE_NAME = `paparazzi-test-${TEST_TIMESTAMP}.png`;
const FILE_PATH = path.join(process.cwd(), 'e2e', 'temp_artifacts', FILE_NAME);

test.describe('The Paparazzi: Media Pipeline Verification', () => {
    // Media operations and Cold Starts are slow.
    test.setTimeout(120000);

    test.beforeAll(async () => {
        // Create the test image locally
        if (!fs.existsSync(path.dirname(FILE_PATH))) {
            fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
        }
        fs.writeFileSync(FILE_PATH, PNG_BUFFER);
    });

    test.afterAll(async () => {
        // Cleanup
        if (fs.existsSync(FILE_PATH)) {
            fs.unlinkSync(FILE_PATH);
        }
    });

    test('Shoot, Process, Print: Full Media Cycle', async ({ page }) => {
        console.log(`[Paparazzi] Starting Media Cycle Test...`);

        // 1. Login / Land
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Handle Auth Interstitial if present
        const getStartedBtn = page.getByRole('button', { name: /get started|launch|sign in/i });
        if (await getStartedBtn.isVisible()) {
            await getStartedBtn.click();
        }

        // 2. Navigate to Creative Studio
        // Wait for dashboard or nav to be ready
        await page.waitForTimeout(3000);
        await page.goto(`${BASE_URL}/creative`);
        await page.waitForLoadState('domcontentloaded');

        // 3. SHOOT (Upload Reference Image)
        // We need to find the upload input. Usually hidden.
        // In CreativeNavbar or ImageSubMenu
        // We might need to click "Brand" or "Upload" reference depending on UI state.
        // Assuming a standard file input is available in the DOM for uploads.
        console.log('[Paparazzi] Uploading Reference Image...');

        // Strategy: Force unhide or find the input. 
        // Better: Use the 'Attach Files' in Command Bar if the specific "Upload Reference" is hidden in a submenu.
        // OR: Use the Command Bar attachment which we know works.
        const fileInput = page.locator('input[type="file"]').first();
        // Note: There might be multiple. Need to be careful.
        // CommandBar has input[type="file"].
        await fileInput.setInputFiles(FILE_PATH);

        // 4. PROCESS (Vision Analysis)
        // Verify it was attached. Command Bar usually shows a preview tag.
        await expect(page.getByText(FILE_NAME)).toBeVisible();

        console.log('[Paparazzi] Triggering Vision Analysis...');
        const agentInput = page.getByPlaceholder(/describe your creative task/i);
        await agentInput.fill('Describe this image in extreme detail.');
        await page.keyboard.press('Enter');

        // Wait for Agent Response (Vision API)
        const response = page.getByTestId('agent-message').last();
        await expect(response).toBeVisible({ timeout: 45000 });
        const analysisText = await response.innerText();
        console.log(`[Paparazzi] Vision AI Analysis: "${analysisText.substring(0, 50)}..."`);

        expect(analysisText.length).toBeGreaterThan(10); // Ensure meaningful response

        // 5. PRINT (Generation)
        console.log('[Paparazzi] Requesting Generation...');
        await agentInput.fill('Generate an artistic variation of this.');
        await page.keyboard.press('Enter');

        // Wait for Generation Completion
        // Usually indicated by a new message saying "Generated..." or a new image in the gallery.
        // Better check: Look for the Grid/Gallery item.
        // Assuming the latest item in history/gallery is the one.
        // Let's carry on waiting for the Agent to confirm "I have generated..."
        await page.waitForTimeout(5000); // Wait for initial processing
        const generationResponse = page.getByTestId('agent-message').last();
        await expect(generationResponse).toBeVisible({ timeout: 60000 });

        // 6. GALLERY PROOF
        // Find the generated image in the gallery.
        // Selector: img[src*="storage.googleapis.com"] (or similar)
        // Or specific class in CreativeGallery
        console.log('[Paparazzi] Verifying Gallery Asset...');
        const galleryImage = page.locator('img[alt*="Generated"], img[class*="gallery-item"]').first();
        // Wait for it to appear (might be streaming in)
        // Just checking for ANY image in the gallery effectively proves generation worked if the gallery was empty/new project.
        // But let's check for a valid src.
        await expect(galleryImage).toBeVisible({ timeout: 30000 });

        const src = await galleryImage.getAttribute('src');
        expect(src).toBeTruthy();
        console.log(`[Paparazzi] Generated Asset URL: ${src?.substring(0, 50)}...`);

        // Verify HTTP 200 (Asset is publicly accessible)
        // This confirms Storage Rules let us read it.
        const checkResponse = await page.request.get(src!);
        expect(checkResponse.status()).toBe(200);
        console.log('[Paparazzi] Asset Verified Publicly Accessible (200 OK).');
    });

});
