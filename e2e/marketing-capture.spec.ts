import { test, expect } from './fixtures/auth';
import * as path from 'path';
import * as fs from 'fs';

const BASE_OUT = path.resolve('assets/marketing-screenshots');

function ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure all target directories exist
ensureDir(path.join(BASE_OUT, 'desktop/landing'));
ensureDir(path.join(BASE_OUT, 'desktop/studio'));
ensureDir(path.join(BASE_OUT, 'desktop/modals'));
ensureDir(path.join(BASE_OUT, 'mobile/landing'));
ensureDir(path.join(BASE_OUT, 'mobile/studio'));
ensureDir(path.join(BASE_OUT, 'mobile/modals'));

test.describe('Marketing Capture - Landing Page (Production)', () => {
    test.setTimeout(180_000);

    test('capture landing page desktop - sections and views', async ({ page }) => {
        await page.setViewportSize({ width: 2560, height: 1440 });
        const outDir = path.join(BASE_OUT, 'desktop/landing');

        // Go to public landing page
        await page.goto('https://indii.music', { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1500);

        // 1. Full page
        await page.screenshot({ path: path.join(outDir, '00-full-landing-page.png'), fullPage: true });

        // 2. Hero
        await page.screenshot({ path: path.join(outDir, '01-hero-fold.png') });

        // 3. Sections if present in DOM
        const sectionSelectors: Record<string, string> = {
            '02-showcase': '#showcase, [data-testid="app-studio-showcase"], section:has-text("Studio")',
            '03-pricing': '#pricing, section:has-text("Pricing"), section:has-text("Membership")',
            '04-waitlist': '#waitlist, section:has-text("Waitlist"), section:has-text("Apply")',
            '05-principles': '#principles, section:has-text("Principles"), section:has-text("Manifesto")',
            '06-detroit': '#detroit, section:has-text("Detroit")',
            '07-conductor': '#conductor, section:has-text("Conductor")',
        };

        for (const [name, selector] of Object.entries(sectionSelectors)) {
            const el = page.locator(selector).first(); // bypass-strict
            if (await el.isVisible().catch(() => false)) {
                await el.scrollIntoViewIfNeeded().catch(() => {});
                await page.waitForTimeout(500);
                await el.screenshot({ path: path.join(outDir, `${name}.png`) }).catch(() => {});
            }
        }

        // 4. Public auth & legal subpages
        const subpages = [
            { name: '08-login-page', url: 'https://indii.music/login' },
            { name: '09-signup-page', url: 'https://indii.music/signup' },
            { name: '10-terms-page', url: 'https://indii.music/terms' },
            { name: '11-privacy-page', url: 'https://indii.music/privacy' },
        ];

        for (const sp of subpages) {
            try {
                await page.goto(sp.url, { waitUntil: 'networkidle', timeout: 20000 });
                await page.waitForTimeout(800);
                await page.screenshot({ path: path.join(outDir, `${sp.name}.png`) });
            } catch (e) {
                console.log(`Skipping subpage ${sp.name}: ${(e as Error).message}`);
            }
        }
    });

    test('capture landing page mobile - sections and views', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const outDir = path.join(BASE_OUT, 'mobile/landing');

        await page.goto('https://indii.music', { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1500);

        // Mobile Full page
        await page.screenshot({ path: path.join(outDir, '00-mobile-landing-fullpage.png'), fullPage: true });
        // Mobile Hero
        await page.screenshot({ path: path.join(outDir, '01-mobile-hero.png') });

        // Mobile Menu toggle if present
        const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i], [data-testid="mobile-menu-toggle"]').first(); // bypass-strict
        if (await menuBtn.isVisible().catch(() => false)) {
            await menuBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(outDir, '02-mobile-menu-open.png') });
            await menuBtn.click().catch(() => {});
        }

        // Mobile Login
        try {
            await page.goto('https://indii.music/login', { waitUntil: 'networkidle', timeout: 20000 });
            await page.waitForTimeout(800);
            await page.screenshot({ path: path.join(outDir, '03-mobile-login.png') });
        } catch (e) {
            // ignore
        }
    });
});

test.describe('Marketing Capture - Studio Application (Desktop)', () => {
    test.setTimeout(360_000);

    test('capture all studio modules, subtabs, and modals in 2560x1440 Retina', async ({ authedPage: page }) => {
        await page.setViewportSize({ width: 2560, height: 1440 });
        const studioOut = path.join(BASE_OUT, 'desktop/studio');
        const modalOut = path.join(BASE_OUT, 'desktop/modals');

        // Wait for app container to be ready
        const appContainer = page.locator('[data-testid="app-container"]').first(); // bypass-strict
        await expect(appContainer).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(1500);

        // Capture Dashboard
        await page.screenshot({ path: path.join(studioOut, '01-dashboard.png') });

        // Core modules to capture with priority
        const modulesToCapture: Array<{ id: string; name: string }> = [
            { id: 'creative', name: '02-creative-director' },
            { id: 'distribution', name: '03-distribution' },
            { id: 'analytics', name: '04-analytics' },
            { id: 'finance', name: '05-finance' },
            { id: 'legal', name: '06-legal' },
            { id: 'marketing', name: '07-marketing' },
            { id: 'social', name: '08-social-media' },
            { id: 'merch', name: '09-merch' },
            { id: 'brand', name: '10-brand-manager' },
            { id: 'workflow', name: '11-workflow-lab' },
            { id: 'licensing', name: '12-licensing' },
            { id: 'publicist', name: '13-publicist' },
            { id: 'road', name: '14-road-tour' },
            { id: 'files', name: '15-cloud-files' },
            { id: 'knowledge', name: '16-knowledge-base' },
            { id: 'observability', name: '17-observability-telemetry' },
            { id: 'settings', name: '18-settings' },
            { id: 'founders-portal', name: '19-founders-portal' },
            { id: 'project-canvas', name: '20-project-canvas' },
            { id: 'raw-converter', name: '21-raw-converter' },
            { id: 'screenwriter', name: '22-screenwriter' },
            { id: 'crm', name: '23-crm' },
            { id: 'memory', name: '24-agent-memory' },
            { id: 'history', name: '25-action-history' },
        ];

        for (const mod of modulesToCapture) {
            console.log(`[CAPTURE] Navigating to ${mod.id} (${mod.name})...`);
            try {
                // Try direct hash or URL navigation
                await page.goto(`/#${mod.id}`, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);

                // Full screen view of module
                await page.screenshot({ path: path.join(studioOut, `${mod.name}.png`) });

                // Check for internal tabs (role="tab" or [data-state])
                const tabs = page.locator('[role="tab"], button[data-state]:not([data-state="inactive"])').filter({
                    hasText: /.+/
                });
                const tabCount = await tabs.count().catch(() => 0);

                if (tabCount > 1 && tabCount < 10) {
                    for (let t = 0; t < tabCount; t++) {
                        const tab = tabs.nth(t); // bypass-strict
                        const tabText = (await tab.textContent() || `tab-${t}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        if (tabText && tabText.length < 30) {
                            await tab.click().catch(() => {});
                            await page.waitForTimeout(800);
                            await page.screenshot({ path: path.join(studioOut, `${mod.name}--tab-${tabText}.png`) }).catch(() => {});
                        }
                    }
                }
            } catch (err) {
                console.log(`[CAPTURE ERROR] Failed to capture module ${mod.id}: ${(err as Error).message}`);
            }
        }

        // ==========================================
        // Modals & Overlays
        // ==========================================
        console.log('[CAPTURE] Capturing Modals & Overlays...');

        // 1. Command Bar (Cmd+K / Ctrl+K)
        try {
            await page.keyboard.press('Meta+k');
            await page.waitForTimeout(800);
            const commandBar = page.locator('[data-testid="command-bar"], [role="combobox"], [placeholder*="Search" i], [placeholder*="Ask" i]').first(); // bypass-strict
            if (await commandBar.isVisible().catch(() => false)) {
                await page.screenshot({ path: path.join(modalOut, 'modal-01-command-bar.png') });
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        } catch (e) {
            console.log('Command bar capture skipped:', (e as Error).message);
        }

        // 2. Keyboard Shortcuts Modal (?)
        try {
            await page.keyboard.press('Shift+?');
            await page.waitForTimeout(800);
            await page.screenshot({ path: path.join(modalOut, 'modal-02-keyboard-shortcuts.png') });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        } catch (e) {
            // ignore
        }

        // 3. New Release / Distribution Modal
        try {
            await page.goto('/#distribution', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1500);
            const newReleaseBtn = page.locator('button:has-text("New Release"), button:has-text("Create Release"), [data-testid="btn-create-release"]').first(); // bypass-strict
            if (await newReleaseBtn.isVisible().catch(() => false)) {
                await newReleaseBtn.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: path.join(modalOut, 'modal-03-distribution-new-release.png') });
                await page.keyboard.press('Escape');
            }
        } catch (e) {
            // ignore
        }

        // 4. Contract / Agreement Wizard Modal
        try {
            await page.goto('/#legal', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1500);
            const newContractBtn = page.locator('button:has-text("New Contract"), button:has-text("New Agreement"), button:has-text("Create Agreement")').first(); // bypass-strict
            if (await newContractBtn.isVisible().catch(() => false)) {
                await newContractBtn.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: path.join(modalOut, 'modal-04-legal-contract-wizard.png') });
                await page.keyboard.press('Escape');
            }
        } catch (e) {
            // ignore
        }
    });
});

test.describe('Marketing Capture - Studio Application (Mobile Views)', () => {
    test.setTimeout(240_000);
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('capture key studio mobile views in 390x844 iPhone resolution', async ({ authedPage: page }) => {
        const mobileOut = path.join(BASE_OUT, 'mobile/studio');
        const modalOut = path.join(BASE_OUT, 'mobile/modals');

        const appContainer = page.locator('[data-testid="app-container"]').first(); // bypass-strict
        await expect(appContainer).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(1500);

        // 1. Mobile Dashboard
        await page.screenshot({ path: path.join(mobileOut, '01-mobile-dashboard.png') });

        // 2. Mobile Navigation Drawer / Menu (More tab on bottom tab bar)
        const moreTabBtn = page.locator('button[aria-label="More"], [role="tab"]:has-text("More")').first(); // bypass-strict
        if (await moreTabBtn.isVisible().catch(() => false)) {
            await moreTabBtn.click();
            await page.waitForTimeout(600);
            await page.screenshot({ path: path.join(modalOut, 'mobile-01-navigation-drawer.png') });
            // Close drawer by pressing Escape or backdrop
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(400);
        }

        // QuickCapture bottom sheet
        const fabBtn = page.locator('button.rounded-full[class*="from-teal"]').first(); // bypass-strict
        if (await fabBtn.isVisible().catch(() => false)) {
            await fabBtn.click();
            await page.waitForTimeout(600);
            await page.screenshot({ path: path.join(modalOut, 'mobile-02-quick-capture.png') });
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(400);
        }

        // 3. Mobile Remote / Controller surface
        try {
            await page.goto('/#mobile-remote', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(mobileOut, '02-mobile-remote-surface.png') });
        } catch (e) {
            // ignore
        }

        // 4. Mobile key modules
        const mobileModules = [
            { id: 'distribution', name: '03-mobile-distribution' },
            { id: 'creative', name: '04-mobile-creative' },
            { id: 'analytics', name: '05-mobile-analytics' },
            { id: 'finance', name: '06-mobile-finance' },
            { id: 'social', name: '07-mobile-social' },
            { id: 'settings', name: '08-mobile-settings' },
        ];

        for (const m of mobileModules) {
            try {
                await page.goto(`/#${m.id}`, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1500);
                await page.screenshot({ path: path.join(mobileOut, `${m.name}.png`) });
            } catch (e) {
                // ignore
            }
        }
    });
});
