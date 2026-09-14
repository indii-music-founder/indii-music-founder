import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4243';
const ARTIFACTS_DIR = path.join(process.cwd(), '.agent/artifacts/browser_verification');

test.describe('Tier 0 Artist Master Directive & Visual DNA Live Browser Verification', () => {
    test.beforeAll(() => {
        if (!fs.existsSync(ARTIFACTS_DIR)) {
            fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        }
    });

    test('Execute 3-Part Live Browser Verification Protocol on Localhost', async ({ page }) => {
        test.setTimeout(300_000);

        const consoleLogs: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
            }
        });

        console.log(`[Browser:Live] Navigating to studio web server at ${BASE_URL}...`);
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1000);

        // Capture initial boot screen
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_initial_landing.png') });

        // Wait for store initialization
        await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 20_000 });
        console.log('[Browser:Live] Store initialized successfully.');

        // Check if artist is already authenticated
        const isAuthed = await page.evaluate(() => {
            const store = (window as any).useStore;
            return store && store.getState().user !== null;
        });

        if (!isAuthed) {
            console.log('[Browser:Live] Not authenticated. Attempting authentic signup in browser UI...');
            const toggleBtn = page.locator('[data-testid="toggle-auth-mode"]');
            if (await toggleBtn.isVisible().catch(() => false)) {
                console.log('[Browser:Live] Switching to Create Account form...');
                await toggleBtn.click();
                await page.waitForTimeout(500);
            }

            const email = `artist-${Date.now()}@indii.music`;
            const password = 'TestPassword123!';
            const dob = '1995-05-15';

            const emailInput = page.locator('input[aria-label="email"]');
            if (await emailInput.isVisible().catch(() => false)) {
                console.log(`[Browser:Live] Filling authentic signup for ${email}...`);
                await emailInput.fill(email);
                await page.locator('input[aria-label="password"]').fill(password);
                await page.locator('input[aria-label="confirm password"]').fill(password);
                await page.locator('input[aria-label="date of birth"]').fill(dob);
                await page.locator('button[type="submit"]').click();
                await page.waitForTimeout(3000);
            }

            // Wait for user to authenticate via UI
            await page.waitForFunction(() => {
                const store = (window as any).useStore;
                return store && store.getState().user !== null;
            }, { timeout: 60_000 });
            console.log('[Browser:Live] Artist authenticated successfully.');
        }

        // ---------------------------------------------------------------------
        // SEQUENCE 1: Tier 0 Master Directive Living UI
        // ---------------------------------------------------------------------
        console.log('[Browser:Live] --- Starting Sequence 1: Master Directive Living UI ---');

        // Dismiss onboarding and switch to Settings module
        await page.evaluate(() => {
            localStorage.setItem('onboarding_dismissed', 'true');
            const store = (window as any).useStore;
            if (store) {
                store.getState().setModule('settings');
            }
        });
        await page.waitForTimeout(1000);

        // Locate and click Master Directive tab
        const playbookTab = page.locator('[data-testid="settings-tab-playbook"]');
        await expect(playbookTab).toBeVisible({ timeout: 10_000 });
        await playbookTab.click();

        // Wait for directive to load from Firestore and mount section cards
        await page.waitForSelector('[data-testid="directive-section-sonicSpecs"]', { timeout: 15_000 });

        // Verify all 5 section cards/pills mount
        const sections = [
            'sonicSpecs',
            'businessLegal',
            'brandingAesthetics',
            'releaseDistribution',
            'customPlaybook',
        ];

        for (const secKey of sections) {
            const secPill = page.locator(`[data-testid="directive-section-${secKey}"]`);
            await expect(secPill).toBeVisible({ timeout: 10_000 });
            console.log(`[Browser:Live] Verified section card mounted: ${secKey}`);
        }

        // Select Sonic & Mastering Standards
        const sonicSec = page.locator('[data-testid="directive-section-sonicSpecs"]');
        await sonicSec.click();
        await page.waitForTimeout(500);

        // Add custom mastering constraint
        const testRule = 'Mastering target ceiling: -14.0 LUFS integrated, 48kHz, 24-bit PCM';
        const ruleInput = page.locator('[data-testid="add-rule-input"]');
        await expect(ruleInput).toBeVisible();
        await ruleInput.fill(testRule);

        const addRuleBtn = page.locator('[data-testid="add-rule-button"]');
        await expect(addRuleBtn).toBeEnabled();
        await addRuleBtn.click();
        await page.waitForTimeout(500);

        // Assert rule appears in active section list
        const ruleItem = page.locator(`text=${testRule}`);
        await expect(ruleItem).toBeVisible();
        console.log('[Browser:Live] Custom sonic spec rule added to list.');

        // Click Save Changes / Save Directive
        const saveBtn = page.locator('[data-testid="save-playbook-button"]');
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();
        await page.waitForTimeout(1000);

        // Capture Sequence 1 screenshot
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_seq1_master_directive_saved.png') });
        console.log('[Browser:Live] Sequence 1 completed and saved.');

        // ---------------------------------------------------------------------
        // SEQUENCE 2: Visual DNA & Automated Brand Cascading
        // ---------------------------------------------------------------------
        console.log('[Browser:Live] --- Starting Sequence 2: Visual DNA & Brand Color Cascading ---');

        // Select Brand & Aesthetics section
        const brandSec = page.locator('[data-testid="directive-section-brandingAesthetics"]');
        await brandSec.click();
        await page.waitForTimeout(500);

        // Verify swatch bar is visible
        const swatchBar = page.locator('[data-testid="live-brand-swatch-bar"]');
        await expect(swatchBar).toBeVisible();
        console.log('[Browser:Live] Active Visual DNA Palette swatch bar rendered.');

        // Trigger dynamic brand color update through store lifecycle
        const newPrimary = '#00ff66';
        const newSecondary = '#d936d9';
        const newAccent = '#3beaf0';

        await page.evaluate(
            ({ p, s, a }) => {
                const store = (window as any).useStore;
                if (store) {
                    store.getState().updateBrandKit({
                        colors: [p, s, a, '#ffb800'],
                        primaryColor: p,
                        secondaryColor: s,
                        accentColor: a,
                    });
                }
            },
            { p: newPrimary, s: newSecondary, a: newAccent }
        );
        await page.waitForTimeout(1000);

        // Inspect DOM computed CSS custom properties on document.documentElement
        const computedPrimary = await page.evaluate(() => {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--artist-brand-primary')
                .trim()
                .toLowerCase();
        });

        console.log(`[Browser:Live] DOM computed --artist-brand-primary: ${computedPrimary}`);
        expect(computedPrimary).toBe(newPrimary.toLowerCase());

        // Capture Sequence 2 screenshot
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_seq2_brand_visual_dna_cascading.png') });
        console.log('[Browser:Live] Sequence 2 verified: CSS custom property cascade confirmed.');

        // ---------------------------------------------------------------------
        // SEQUENCE 3: AI Specialist Swarm Context Reflection
        // ---------------------------------------------------------------------
        console.log('[Browser:Live] --- Starting Sequence 3: Swarm Context Reflection ---');

        // Verify directive contains our Sequence 1 rule
        const directiveSnapshot = await page.evaluate(async () => {
            const service = (window as any).artistDirectiveService;
            if (!service) return null;
            return await service.getDirective();
        });

        expect(directiveSnapshot).not.toBeNull();
        const sonicRules = directiveSnapshot?.sections?.sonicSpecs?.rules || [];
        expect(sonicRules).toContain(testRule);
        console.log('[Browser:Live] Directive snapshot contains sonic spec rule.');

        // Simulate agent refinement tool call: refineSection on businessLegal
        const agentRule = 'Never sign away master recording ownership under any contract.';
        const refineResult = await page.evaluate(async (rule) => {
            const service = (window as any).artistDirectiveService;
            if (!service) return { success: false, error: 'No artistDirectiveService on window' };
            return await service.refineSection(
                'businessLegal',
                rule,
                'add_rule',
                'Artist stated contract non-negotiable in chat session',
                'agent'
            );
        }, agentRule);

        console.log('[Browser:Live] Agent refinement execution result:', refineResult);
        expect(refineResult.success).toBe(true);

        // Switch to Business & Legal section in UI to verify live reactive reflection
        const legalSec = page.locator('[data-testid="directive-section-businessLegal"]');
        await legalSec.click();
        await page.waitForTimeout(1000);

        // Assert that the agent-refined rule appears in the living UI
        const agentRuleEl = page.locator(`text=${agentRule}`);
        await expect(agentRuleEl).toBeVisible();
        console.log('[Browser:Live] Agent-refined legal rule successfully reflected in living UI.');

        // Capture Sequence 3 screenshot
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_seq3_swarm_reflection_updated.png') });
        console.log('[Browser:Live] Sequence 3 verified: Swarm reflection complete.');

        // Summary log
        const summary = {
            verifiedSequences: ['1: Master Directive Living UI', '2: Visual DNA Cascading', '3: Swarm Reflection'],
            computedPrimary,
            sonicRulesCount: sonicRules.length,
            agentRuleReflected: true,
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(
            path.join(ARTIFACTS_DIR, 'verification_summary.json'),
            JSON.stringify(summary, null, 2)
        );
        console.log('[Browser:Live] All 3 sequences PASS.');
    });
});
