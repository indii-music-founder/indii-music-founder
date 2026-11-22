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
                ...(window as any).electronAPI,
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
        const expandBtn = page.locator('[aria-label="Expand Panel"]').first(); // bypass-strict: select active panel/modal layer among stacked containers
        await expandBtn.click();
        await page.waitForTimeout(1000);

        // 3. Expanded State: should be wider (width ~320px)
        const boxExpanded = await panel.boundingBox();
        expect(boxExpanded?.width).toBeGreaterThanOrEqual(300);

        // 4. The expanded panel opens on the Messages tab, empty for a fresh session.
        // (The "No Tool Selected" context fallback is unreachable: every module that can
        // show the Context Controls tab renders its own tool panel.)
        await expect(page.getByText('No messages yet').first()).toBeVisible(); // bypass-strict: text appears in multiple responsive layouts

        // 5. Collapse Panel using Close button inside
        const closeBtn = page.locator('[aria-label="Close Panel"]').first(); // bypass-strict: select active panel/modal layer among stacked containers
        await closeBtn.click();
        await page.waitForTimeout(1000);

        const boxCollapsedAgain = await panel.boundingBox();
        expect(boxCollapsedAgain?.width).toBeLessThanOrEqual(55);
    });

    test('should interact with Project Assets tab and load seeded assets', async ({ authedPage: page }) => {
        // Open panel to Assets tab
        const assetsTab = page.locator('[aria-label="Project Assets"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await assetsTab.click();
        await page.waitForTimeout(500);

        // Verify it is expanded and shows "No assets yet" fallback initially
        await expect(page.locator('text=No assets yet').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

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
                    projectId: store.getState().currentProjectId,
                    origin: 'generated'
                }]
            });
        });

        // Verify the asset is rendered in the list/grid
        await expect(page.locator('text=Mock E2E generated image').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Clicking the asset should redirect us to the creative studio
        // The card's click target is an overlay button labelled "Edit in Studio: <prompt>".
        await page.getByRole('button', { name: 'Edit in Studio: Mock E2E generated image' }).first().click(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await page.waitForTimeout(1500);

        // Verify navigation to Creative Studio occurred
        await expect(page.url()).toContain('/creative');
    });

    test('should list and read artifacts in the Artifacts tab', async ({ authedPage: page }) => {
        // Open panel to Artifacts tab
        const artifactsTab = page.locator('[aria-label="Artifacts"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await artifactsTab.click();
        await page.waitForTimeout(500);

        // Verify the mocked artifact file is listed
        const artifactItem = page.locator('text=mock-e2e-artifact.md').first(); // bypass-strict: select first item in dynamic list or collection
        await expect(artifactItem).toBeVisible();

        // Click the artifact to read its content
        await artifactItem.click();
        await page.waitForTimeout(500);

        // Verify the artifact markdown content is rendered
        await expect(page.locator('text=Mock E2E Artifact').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Click "Back to list"
        const backBtn = page.locator('text=Back to list').first(); // bypass-strict: select first item in dynamic list or collection
        await backBtn.click();
        await page.waitForTimeout(500);

        // Should return to the list
        await expect(artifactItem).toBeVisible();
    });

    test('should open Omni Agent tab and interact with the chat interface', async ({ authedPage: page }) => {
        // Open panel to Omni Agent tab
        const agentTab = page.locator('[aria-label="Omni Agent"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await agentTab.click();
        await page.waitForTimeout(500);

        // Verify header elements
        await expect(page.locator('text=Messages').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Check input field
        const promptArea = page.locator('textarea, [placeholder*="Ask me anything"]').first(); // bypass-strict: form input may coexist with background modal or duplicate field
        await expect(promptArea).toBeVisible();

        // Type and send a test message
        await promptArea.fill('Hello indii, this is an automated E2E test message.');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Verify message was added to chat
        await expect(page.locator('text=Hello indii, this is an').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
    });

    test('should dynamically render Context Controls panel for Creative Director', async ({ authedPage: page }) => {
        // Navigate directly to Creative Director
        await page.goto('/creative', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Should render the StudioControlsPanel
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('[data-testid="studio-controls-panel"]')).toBeVisible({ timeout: 10_000 });
    });

    test('should interact with filters and search in Project Assets tab', async ({ authedPage: page }) => {
        // Open panel to Assets tab
        const assetsTab = page.locator('[aria-label="Project Assets"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
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
                        projectId: store.getState().currentProjectId,
                        origin: 'generated'
                    },
                    {
                        id: 'mock-vid-1',
                        type: 'video',
                        url: 'https://mock-video.com/v1.mp4',
                        prompt: 'Synthwave music video',
                        timestamp: Date.now(),
                        projectId: store.getState().currentProjectId,
                        origin: 'generated'
                    }
                ]
            });
        });

        // Scope to the panel: the same assets also appear in the Your Creations gallery.
        const rightPanel = page.locator('[aria-label="Context panel"]');

        // Verify both assets are initially visible
        await expect(rightPanel.locator('text=Cyberpunk landscape image').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await expect(rightPanel.locator('text=Synthwave music video').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Click on IMAGES filter
        const imagesFilter = rightPanel.locator('button:has-text("Images")').first(); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        await imagesFilter.click();
        await page.waitForTimeout(500);

        // Image should be visible, video should NOT be visible
        await expect(rightPanel.locator('text=Cyberpunk landscape image').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await expect(rightPanel.locator('text=Synthwave music video').first()).not.toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Click on VIDEOS filter
        const videosFilter = rightPanel.locator('button:has-text("Videos")').first(); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        await videosFilter.click();
        await page.waitForTimeout(500);

        // Video should be visible, image should NOT be visible
        await expect(rightPanel.locator('text=Synthwave music video').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await expect(rightPanel.locator('text=Cyberpunk landscape image').first()).not.toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards

        // Test search input
        const allFilter = rightPanel.locator('button:has-text("All")').first(); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        await allFilter.click();
        await page.waitForTimeout(500);

        const searchInput = rightPanel.locator('[placeholder="Search assets..."]').first(); // bypass-strict: form input may coexist with background modal or duplicate field
        await searchInput.fill('Cyberpunk');
        await page.waitForTimeout(500);

        // Only search matching item should show
        await expect(rightPanel.locator('text=Cyberpunk landscape image').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await expect(rightPanel.locator('text=Synthwave music video').first()).not.toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
    });

    test('should dynamically render Context Controls panel for Workflow Builder and execute workflow', async ({ authedPage: page }) => {
        // Navigate directly to Workflow
        await page.goto('/workflow', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Workflow panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Workflow Builder').first()).toBeVisible(); // bypass-strict: select active panel/modal layer among stacked containers

        // The panel's Run button is disabled until the workflow has nodes, so load a
        // built-in system protocol first.
        await page.getByText('Campaign Launch', { exact: true }).first().click(); // bypass-strict: protocol and workflow names render in separate sidebar lists (WorkflowSidebarWidgets), so the name can match more than once

        // Click "Run Workflow" button
        const runBtn = rightPanel.locator('button:has-text("Run Workflow")').first(); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        await expect(runBtn).toBeVisible();
        await runBtn.click();

        // Verify toast message "Workflow execution started"
        await expect(page.locator('text=Workflow execution started').first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
    });

    test('should dynamically render Context Controls panel for Knowledge Base and open ingest dialog', async ({ authedPage: page }) => {
        // Navigate directly to Knowledge
        await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"], main', { timeout: 15_000 });

        // Open panel to Context Controls tab
        const contextTab = page.locator('[aria-label="Context Controls"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Knowledge panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Knowledge Base').first()).toBeVisible(); // bypass-strict: select active panel/modal layer among stacked containers

        // "Upload document" is a native file input (aria-label "Upload knowledge documents")
        // laid over a decorative button, so activating it opens the file chooser.
        await expect(rightPanel.getByText('Upload document').first()).toBeVisible(); // bypass-strict: select active panel/modal layer among stacked containers
        const fileInput = rightPanel.getByLabel('Upload knowledge documents');
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            fileInput.click(),
        ]);
        expect(fileChooser.isMultiple()).toBe(true);
    });

    test('should dynamically render Context Controls panel for Marketing and prepare protocol', async ({ authedPage: page }) => {
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
        const contextTab = page.locator('[aria-label="Context Controls"]').first(); // bypass-strict: navigation element rendered across desktop and mobile layouts
        await contextTab.click();
        await page.waitForTimeout(1000);

        // Verify Marketing panel title
        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel.locator('text=Marketing & Growth').first()).toBeVisible(); // bypass-strict: select active panel/modal layer among stacked containers

        // Change select options
        const select = rightPanel.locator('select').first(); // bypass-strict: select active panel/modal layer among stacked containers
        await select.selectOption('INDII_GROWTH_PROTOCOL');

        // The server accepts the run and returns an execution id; the persisted record
        // is then read back from Firestore, which is offline in this harness, so supply
        // a non-completed execution through the service singleton.
        await page.route(/cloudfunctions\.net\/createWorkflowExecution/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify({ data: { executionId: 'e2e-exec-001', status: 'PENDING' } }),
            });
        });
        await page.evaluate(async () => {
            const { workflowStateService } = await import('/src/services/agent/WorkflowStateService.ts');
            (workflowStateService as any).getExecution = async (_userId: string, id: string) => ({ id, status: 'RUNNING' });
        });

        // The panel only prepares a protocol package (a live launch needs connected
        // ad credentials and approval), so the button is "Prepare Protocol".
        const prepareBtn = rightPanel.locator('button:has-text("Prepare Protocol")').first(); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        await expect(prepareBtn).toBeVisible();
        await prepareBtn.click();

        // A non-completed execution is reported as queued, never as launched.
        await expect(page.getByText(/Protocol queued as e2e-exec-001/).first()).toBeVisible(); // bypass-strict: select first item in dynamic list or collection
    });
});
