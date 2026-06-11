import { test, expect } from './fixtures/auth';

/**
 * Right Panel & Swarm Tabs E2E Tests
 * Covers: Collapsed/Expanded states, Context Controls, Project Assets, Artifacts, and Omni Agent chat.
 *
 * Run: npx playwright test e2e/right-panel.spec.ts
 */

test.describe('Right Panel & Swarm Tabs', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept/mock Electron API calls before page loads
        await page.addInitScript(() => {
            (window as any).electronAPI = {
                agent: {
                    listArtifacts: async () => ({
                        success: true,
                        data: [{ filename: 'mock-e2e-artifact.md' }]
                    }),
                    readArtifact: async (filename: string) => ({
                        success: true,
                        data: `# Mock E2E Artifact\nThis is content for ${filename}.`
                    }),
                }
            };
        });

        // Navigate to dashboard HQ
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });
    });

    test('should toggle right panel between collapsed and expanded states', async ({ authedPage: page }) => {
        const panel = page.locator('[aria-label="Context panel"]');
        await expect(panel).toBeVisible();

        // 1. Initial State: should be collapsed (width ~48px)
        const boxCollapsed = await panel.boundingBox();
        expect(boxCollapsed?.width).toBeLessThanOrEqual(55);

        // 2. Expand Panel
        const expandBtn = page.locator('[aria-label="Expand Panel"]').first();
        await expandBtn.click();
        await page.waitForTimeout(1000);

        // 3. Expanded State: should be wider (width ~320px)
        const boxExpanded = await panel.boundingBox();
        expect(boxExpanded?.width).toBeGreaterThanOrEqual(300);

        // 4. Verify default "No Tool Selected" or "Messages" fallback content
        await expect(page.locator('text=No Tool Selected').first().or(page.locator('text=Messages').first())).toBeVisible();

        // 5. Collapse Panel using Close button inside
        const closeBtn = page.locator('[aria-label="Close Panel"]').first();
        await closeBtn.click();
        await page.waitForTimeout(1000);

        const boxCollapsedAgain = await panel.boundingBox();
        expect(boxCollapsedAgain?.width).toBeLessThanOrEqual(55);
    });

    test('should interact with Project Assets tab and load seeded assets', async ({ authedPage: page }) => {
        // Open panel to Assets tab
        const assetsTab = page.locator('[aria-label="Project Assets"]').first();
        await assetsTab.click();
        await page.waitForTimeout(500);

        // Verify it is expanded and shows "No assets yet" fallback initially
        await expect(page.locator('text=No assets yet').first()).toBeVisible();

        // Seed a mock asset into the Zustand store
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({
                generatedHistory: [{
                    id: 'mock-e2e-asset-1',
                    type: 'image',
                    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                    thumbnailUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                    prompt: 'Mock E2E generated image',
                    timestamp: Date.now(),
                    projectId: 'mock-project-id',
                    origin: 'generation'
                }]
            });
        });

        // Verify the asset is rendered in the list/grid
        await expect(page.locator('text=Mock E2E generated image').first()).toBeVisible();

        // Clicking the asset should redirect us to the creative studio
        await page.locator('text=Mock E2E generated image').first().click();
        await page.waitForTimeout(1500);

        // Verify navigation to Creative Studio occurred
        await expect(page.url()).toContain('/creative');
    });

    test('should list and read artifacts in the Artifacts tab', async ({ authedPage: page }) => {
        // Open panel to Artifacts tab
        const artifactsTab = page.locator('[aria-label="Artifacts"]').first();
        await artifactsTab.click();
        await page.waitForTimeout(500);

        // Verify the mocked artifact file is listed
        const artifactItem = page.locator('text=mock-e2e-artifact.md').first();
        await expect(artifactItem).toBeVisible();

        // Click the artifact to read its content
        await artifactItem.click();
        await page.waitForTimeout(500);

        // Verify the artifact markdown content is rendered
        await expect(page.locator('text=Mock E2E Artifact').first()).toBeVisible();

        // Click "Back to list"
        const backBtn = page.locator('text=Back to list').first();
        await backBtn.click();
        await page.waitForTimeout(500);

        // Should return to the list
        await expect(artifactItem).toBeVisible();
    });

    test('should open Omni Agent tab and interact with the chat interface', async ({ authedPage: page }) => {
        // Open panel to Omni Agent tab
        const agentTab = page.locator('[aria-label="Omni Agent"]').first();
        await agentTab.click();
        await page.waitForTimeout(500);

        // Verify header elements
        await expect(page.locator('text=Messages').first()).toBeVisible();

        // Check input field
        const promptArea = page.locator('textarea, [placeholder*="Ask me anything"]').first();
        await expect(promptArea).toBeVisible();

        // Type and send a test message
        await promptArea.fill('Hello indii, this is an automated E2E test message.');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Verify message was added to chat
        await expect(page.locator('text=Hello indii, this is an').first()).toBeVisible();
    });

    test('should dynamically render Context Controls panel for Creative Director', async ({ authedPage: page }) => {
        // Navigate directly to Creative Director
        await page.goto('/creative', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first();
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Should render the StudioControlsPanel (contains style presets or specific labels)
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(
            rightPanel.locator('text=Studio Controls').first().or(
                rightPanel.locator('text=Generate Soundtrack').first()
            )
        ).toBeVisible({ timeout: 10_000 });
    });

    test('should interact with filters and search in Project Assets tab', async ({ authedPage: page }) => {
        // Open panel to Assets tab
        const assetsTab = page.locator('[aria-label="Project Assets"]').first();
        await assetsTab.click();
        await page.waitForTimeout(500);

        // Seed mock assets of different types
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({
                generatedHistory: [
                    {
                        id: 'mock-img-1',
                        type: 'image',
                        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                        prompt: 'Cyberpunk landscape image',
                        timestamp: Date.now() - 1000,
                        projectId: 'mock-project-id',
                        origin: 'generation'
                    },
                    {
                        id: 'mock-vid-1',
                        type: 'video',
                        url: 'https://mock-video.com/v1.mp4',
                        prompt: 'Synthwave music video',
                        timestamp: Date.now(),
                        projectId: 'mock-project-id',
                        origin: 'generation'
                    }
                ]
            });
        });

        // Verify both assets are initially visible
        await expect(page.locator('text=Cyberpunk landscape image').first()).toBeVisible();
        await expect(page.locator('text=Synthwave music video').first()).toBeVisible();

        // Click on IMAGES filter
        const imagesFilter = page.locator('button:has-text("Images")').first();
        await imagesFilter.click();
        await page.waitForTimeout(500);

        // Image should be visible, video should NOT be visible
        await expect(page.locator('text=Cyberpunk landscape image').first()).toBeVisible();
        await expect(page.locator('text=Synthwave music video').first()).not.toBeVisible();

        // Click on VIDEOS filter
        const videosFilter = page.locator('button:has-text("Videos")').first();
        await videosFilter.click();
        await page.waitForTimeout(500);

        // Video should be visible, image should NOT be visible
        await expect(page.locator('text=Synthwave music video').first()).toBeVisible();
        await expect(page.locator('text=Cyberpunk landscape image').first()).not.toBeVisible();

        // Test search input
        const allFilter = page.locator('button:has-text("All")').first();
        await allFilter.click();
        await page.waitForTimeout(500);

        const searchInput = page.locator('[placeholder="Search assets..."]').first();
        await searchInput.fill('Cyberpunk');
        await page.waitForTimeout(500);

        // Only search matching item should show
        await expect(page.locator('text=Cyberpunk landscape image').first()).toBeVisible();
        await expect(page.locator('text=Synthwave music video').first()).not.toBeVisible();
    });

    test('should dynamically render Context Controls panel for Workflow Builder and execute workflow', async ({ authedPage: page }) => {
        // Navigate directly to Workflow
        await page.goto('/workflow', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first();
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Workflow panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Workflow Builder').first()).toBeVisible();

        // Click "Run Workflow" button
        const runBtn = rightPanel.locator('button:has-text("Run Workflow")').first();
        await expect(runBtn).toBeVisible();
        await runBtn.click();

        // Verify toast message "Workflow execution started"
        await expect(page.locator('text=Workflow execution started').first()).toBeVisible();
    });

    test('should dynamically render Context Controls panel for Knowledge Base and open ingest dialog', async ({ authedPage: page }) => {
        // Navigate directly to Knowledge
        await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first();
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Knowledge panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Knowledge Base').first()).toBeVisible();

        // Click "Ingest Document" button
        const ingestBtn = rightPanel.locator('button:has-text("Ingest Document")').first();
        await expect(ingestBtn).toBeVisible();
        await ingestBtn.click();

        // Verify toast message "Opening upload dialog"
        await expect(page.locator('text=Opening upload dialog').first()).toBeVisible();
    });

    test('should dynamically render Context Controls panel for Marketing and deploy protocol', async ({ authedPage: page }) => {
        // Navigate directly to Marketing
        await page.goto('/marketing', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Setup userProfile in store so deployment doesn't fail due to auth check
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({
                userProfile: { id: 'test-user-uid-e2e', email: 'test@example.com' }
            });
        });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first();
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Marketing panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Marketing & Growth').first()).toBeVisible();

        // Change select options
        const select = rightPanel.locator('select').first();
        await select.selectOption('INDII_GROWTH_PROTOCOL');

        // Click "Deploy Protocol" button
        const deployBtn = rightPanel.locator('button:has-text("Deploy Protocol")').first();
        await expect(deployBtn).toBeVisible();
        await deployBtn.click();

        // Verify toast message "indii Growth Protocol deployed."
        await expect(page.locator('text=indii Growth Protocol deployed.').first()).toBeVisible();
    });
});
