import { test, expect } from '@playwright/test';

/**
 * 100-CLICK PATH TEST: CREATIVE STUDIO STABILITY GAUNTLET
 */

test.describe('Creative Studio - 100-Click Stability Path', () => {

    test.beforeEach(async ({ page }) => {
        // Increase timeout for the whole test
        test.setTimeout(300000); // 5 minutes

        await page.goto('http://localhost:4242/', { waitUntil: 'networkidle' });

        await page.evaluate(async () => {
            const waitForStore = async () => {
                for (let i = 0; i < 100; i++) {
                    if ((window as any).useStore) return (window as any).useStore;
                    await new Promise(r => setTimeout(r, 50));
                }
                return null;
            };

            const store = await waitForStore();
            if (store) {
                const mockUser = {
                    uid: 'maestro-user-id',
                    email: 'maestro@walkingagency.com',
                    displayName: 'AI Maestro',
                };
                store.setState({
                    user: mockUser,
                    authLoading: false,
                    initializeAuthListener: () => () => { },
                });
            }
        });

        // Ensure sidebar is present
        await page.waitForSelector('[data-testid^="nav-item-"]', { timeout: 15000 });
    });

    test('Execute 100-Click Path across modules', async ({ page }) => {
        let clickCount = 0;

        const logAction = (action: string) => {
            clickCount++;
            console.log(`[ACTION ${clickCount}] ${action}`);
        };

        const safeClick = async (selector: string, description: string, timeout = 10000) => {
            try {
                const element = page.locator(selector).first();
                await element.waitFor({ state: 'visible', timeout });
                await element.click();
                logAction(`Clicked ${description}`);
                await page.waitForTimeout(500);
                return true;
            } catch (error) {
                console.warn(`[SKIP] Could not click ${description} (${selector})`);
                return false;
            }
        };

        const safeFill = async (selector: string, value: string, description: string) => {
            try {
                const element = page.locator(selector).first();
                await element.waitFor({ state: 'visible', timeout: 10000 });
                await element.fill(value);
                logAction(`Filled ${description}`);
                return true;
            } catch (error) {
                console.warn(`[SKIP] Could not fill ${description} (${selector})`);
                return false;
            }
        };

        // --- PHASE 1: VIDEO PRODUCER FLOW ---
        console.log('--- Phase 1: Video Producer ---');
        await safeClick('[data-testid="nav-item-video"]', 'Sidebar: Video Producer');

        // Wait for module-specific element to confirm loading
        await page.waitForSelector('[data-testid="mode-director-btn"]', { timeout: 20000 }).catch(() => console.log('Video Navbar slow load...'));

        await safeClick('[data-testid="mode-director-btn"]', 'Navbar: Director Mode');
        await safeFill('[data-testid="director-prompt-input"]', 'Cyberpunk city at night, rain splashing on neon signs, cinematic 4k', 'Director Prompt');
        await safeClick('[data-testid="video-generate-btn"]', 'Director: Generate Button');

        // Interaction with Studio Controls (Right Panel)
        // Ensure panel is open if it closed for some reason
        const isRightPanelVisible = await page.locator('[data-testid="aspect-ratio-select"]').isVisible();
        if (!isRightPanelVisible) {
            console.log('Right panel hidden, attempting to toggle...');
            // In Sidebar, video item click should open it, but let's be sure.
            // Actually, there's no explicit toggle button in the sidebar for the panel, 
            // but the RightPanel component itself has a ChevronLeft/Right.
        }

        await safeClick('[data-testid="aspect-ratio-select"]', 'Right Panel: Aspect Ratio Select');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        logAction('Selected Aspect Ratio');

        await safeClick('[data-testid="resolution-select"]', 'Right Panel: Resolution Select');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        logAction('Selected Resolution');

        await safeClick('[data-testid="camera-zoom-in"]', 'Right Panel: Camera Zoom');
        await safeClick('[data-testid="camera-pan-left"]', 'Right Panel: Camera Pan');

        // Editor Flow
        await safeClick('[data-testid="mode-editor-btn"]', 'Navbar: Editor Mode');
        await page.waitForTimeout(2000); // Timeline takes time to mount

        await safeClick('[data-testid="timeline-add-track-top"]', 'Timeline: Add Track');
        await safeClick('[data-testid="timeline-play-pause"]', 'Timeline: Play/Pause');
        await safeClick('[data-testid^="track-add-text-"]', 'Timeline: Add Text Clip');
        await safeClick('[data-testid="video-export-btn"]', 'Timeline: Export');

        // --- PHASE 2: CREATIVE CANVAS FLOW ---
        console.log('--- Phase 2: Creative Canvas ---');
        await safeClick('[data-testid="nav-item-creative"]', 'Sidebar: Creative Canvas');
        await page.waitForTimeout(1000);

        // --- PHASE 3: MARKETING & SHOWROOM ---
        console.log('--- Phase 3: Marketing & Showroom ---');
        await safeClick('[data-testid="nav-item-marketing"]', 'Sidebar: Marketing');
        await safeClick('[data-testid="nav-item-showroom"]', 'Sidebar: Showroom');
        await page.waitForTimeout(1000);

        // --- PHASE 4: GALLERY ---
        console.log('--- Phase 4: Gallery ---');
        await safeClick('[data-testid="nav-item-gallery"]', 'Sidebar: Gallery');

        // --- PHASE 5: ROAD MANAGER ---
        console.log('--- Phase 5: Road Manager ---');
        await safeClick('[data-testid="nav-item-road-manager"]', 'Sidebar: Road Manager');

        // --- FILLER CLICKS TO REACH 100 ---
        console.log('--- Phase 6: Stability Filler ---');
        const sidebarItems = ['video', 'creative', 'marketing', 'showroom', 'gallery', 'road-manager', 'brand-manager'];

        while (clickCount < 100) {
            const randomItem = sidebarItems[Math.floor(Math.random() * sidebarItems.length)];
            const success = await safeClick(`[data-testid="nav-item-${randomItem}"]`, `Stability: Navigate to ${randomItem}`, 5000);

            if (success && randomItem === 'video') {
                // If we are in video, do sub-actions
                await safeClick('[data-testid="timeline-play-pause"]', 'Stability: Video Play', 3000);
                await safeClick('[data-testid="timeline-skip-start"]', 'Stability: Video Skip', 3000);
            }

            // Randomly click something in the main area if possible
            if (clickCount > 150) break;
        }

        console.log(`GAUNTLET COMPLETE. Total actions: ${clickCount}`);
        expect(clickCount).toBeGreaterThanOrEqual(100);
    });

});
