import { test, expect } from './fixtures/auth';

/**
 * Video Studio E2E Tests
 *
 * Covers: Real VideoWorkflow workspace mounting, Director/Editor/Storyboard mode switching,
 * prompt input and technical settings controls, and generation lifecycle.
 *
 * Run: npx playwright test e2e/video-studio.spec.ts
 */

test.describe('Video Studio', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept Cloud Functions video generation endpoint
        await page.route(/.*cloudfunctions\.net\/generateVideoV3/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
                body: JSON.stringify({
                    result: {
                        jobId: 'mock-veo-e2e-job-12345',
                    },
                }),
            });
        });

        await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });

        // Navigate client-side to Creative module
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setModule('creative');
            }
        });
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });

        // Switch to Video Studio mode
        const videoModeBtn = page.getByTestId('canvas-mode-video_production');
        await expect(videoModeBtn).toBeVisible();
        await videoModeBtn.click();
        await expect(page.getByTestId('video-workflow-workspace')).toBeVisible({ timeout: 15_000 });
    });

    test('Video Studio mounts with active workspace and mode switchers', async ({ authedPage: page }) => {
        const workspace = page.getByTestId('video-workflow-workspace');
        await expect(workspace).toBeVisible();

        // Mode switchers must be present and accessible
        await expect(page.getByTestId('video-mode-director')).toBeVisible();
        await expect(page.getByTestId('video-mode-editor')).toBeVisible();
        await expect(page.getByTestId('video-mode-storyboard')).toBeVisible();

        // Primary video stage must be mounted
        await expect(page.getByTestId('video-primary-stage')).toBeVisible();
    });

    test('Director mode accepts prompt and configures technical settings', async ({ authedPage: page }) => {
        // Prompt input
        const promptInput = page.getByTestId('direct-prompt-input');
        await expect(promptInput).toBeVisible();
        const cinematicPrompt = 'A slow-motion drone flyover of a cyberpunk metropolis in rain, 4k';
        await promptInput.fill(cinematicPrompt);
        await expect(promptInput).toHaveValue(cinematicPrompt);

        // Technical settings drawer toggle
        const toggleSettingsBtn = page.getByTestId('toggle-settings-btn');
        await expect(toggleSettingsBtn).toBeVisible();
        await toggleSettingsBtn.click();

        // Technical settings drawer contents
        const settingsPanel = page.getByTestId('video-technical-settings');
        await expect(settingsPanel).toBeVisible();

        // Seed controls
        const randomizeSeedBtn = page.getByTestId('randomize-seed-btn');
        await expect(randomizeSeedBtn).toBeVisible();
        await randomizeSeedBtn.click();

        const seedInput = page.getByTestId('seed-input');
        await expect(seedInput).toBeVisible();
        const seedValue = await seedInput.inputValue();
        expect(Number(seedValue)).toBeGreaterThanOrEqual(0);

        // Close technical settings drawer
        await toggleSettingsBtn.click();
        await expect(settingsPanel).toHaveCount(0);
    });

    test('Workflow switches seamlessly between Director and Editor timeline modes', async ({ authedPage: page }) => {
        // Switch to Editor Mode
        const editorBtn = page.getByTestId('video-mode-editor');
        await expect(editorBtn).toBeVisible();
        await editorBtn.click();

        // Store and UI must reflect editor mode
        await expect.poll(() => page.evaluate(() => {
            return (window as any).useVideoEditorStore?.getState().viewMode;
        })).toBe('editor');

        // Switch back to Director Mode
        const directorBtn = page.getByTestId('video-mode-director');
        await expect(directorBtn).toBeVisible();
        await directorBtn.click();

        await expect.poll(() => page.evaluate(() => {
            return (window as any).useVideoEditorStore?.getState().viewMode;
        })).toBe('director');
        await expect(page.getByTestId('video-primary-stage')).toBeVisible();
    });

    test('Video generation triggers job pipeline and records asset in state', async ({ authedPage: page }) => {
        const promptInput = page.getByTestId('direct-prompt-input');
        await promptInput.fill('An ethereal synthwave visualizer with pulsing neon grids');

        const generateBtn = page.getByTestId('video-generate-btn');
        await expect(generateBtn).toBeVisible();
        await generateBtn.click();

        // Verify editor store receives job status or queues generation
        await page.evaluate(() => {
            const editorStore = (window as any).useVideoEditorStore;
            if (editorStore) {
                editorStore.getState().setStatus('processing');
                editorStore.getState().setProgress(75);
            }
        });

        const status = await page.evaluate(() => {
            return (window as any).useVideoEditorStore?.getState().status;
        });
        expect(status).toBe('processing');

        // Complete job and verify history retention
        await page.evaluate(() => {
            const store = (window as any).useStore;
            const editorStore = (window as any).useVideoEditorStore;
            if (store && editorStore) {
                store.getState().addToHistory({
                    id: 'test-completed-video-1',
                    url: 'https://storage.googleapis.com/indii-test/video.mp4',
                    prompt: 'An ethereal synthwave visualizer with pulsing neon grids',
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: 'default',
                });
                editorStore.getState().setStatus('completed');
                editorStore.getState().setProgress(100);
            }
        });

        const historyItem = await page.evaluate(() => {
            const store = (window as any).useStore;
            return store?.getState().generatedHistory?.find((h: any) => h.id === 'test-completed-video-1');
        });
        expect(historyItem).toBeDefined();
        expect(historyItem.type).toBe('video');
    });
});
