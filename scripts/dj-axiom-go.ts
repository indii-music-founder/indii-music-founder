/**
 * DJ AXIOM — Generate Real Image (v4 — fixed overlay dismissal)
 * Uses JavaScript injection to dismiss driver.js tour,
 * then the exact same generation pattern from working daisy-chain.
 */
import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts', 'dj-axiom-output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Clean
for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
}

function log(emoji: string, msg: string) {
    const ts = new Date().toISOString().split('T')[1]?.split('.')[0];
    console.log(`[${ts}] ${emoji} ${msg}`);
}

async function screenshot(page: Page, name: string) {
    const filepath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    log('📸', `${name}.png`);
}

const PROMPTS = [
    'Dark industrial techno event flyer, SIGNAL at Roosevelt Park Detroit, neon purple and cyan laser grid, brutalist typography, underground rave aesthetic, summer solstice, 808 speaker stacks, cinematic film grain',
];

async function main() {
    console.log('\n  DJ AXIOM — SIGNAL @ Roosevelt Park\n  Generating REAL images\n');

    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    try {
        // LOAD
        log('🌐', 'Loading app...');
        await page.goto('http://localhost:4242', { waitUntil: 'domcontentloaded', timeout: 30000 });
        try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch { /* ok */ }
        await page.waitForTimeout(3000);
        await screenshot(page, '01_loaded');

        // AUTH
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            log('🔑', 'Guest login...');
            await guestBtn.click();
            try { await page.waitForSelector('[data-testid="guest-login-btn"]', { state: 'hidden', timeout: 15000 }); } catch { /* ok */ }
        }
        await page.waitForTimeout(3000);
        log('✅', 'Authed');

        // DISMISS OVERLAYS
        log('🧹', 'Dismissing overlays...');
        
        // Cookie banner first
        const cookies = page.locator('button:has-text("Accept All")');
        if (await cookies.isVisible({ timeout: 2000 }).catch(() => false)) {
            await cookies.click({ force: true });
            log('🍪', 'Cookies dismissed');
            await page.waitForTimeout(500);
        }

        // Driver.js tour — properly destroy it via the API
        await page.evaluate(() => {
            // driver.js stores the instance on window typically
            // @ts-expect-error driver global
            if (window.driverObj) { window.driverObj.destroy(); return; }
            // Fallback: click the X button directly
            const closeBtn = document.querySelector('.driver-popover-close-btn') as HTMLElement;
            if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(1000);

        // If overlay SVG STILL there, remove it via DOM
        await page.evaluate(() => {
            document.querySelector('svg.driver-overlay')?.remove();
            document.querySelector('.driver-popover')?.remove();
        });
        await page.waitForTimeout(500);
        await screenshot(page, '02_clean');
        log('✅', 'Overlays cleared');

        // NAVIGATE to Creative Director — use FORCE click to bypass any remaining overlay
        log('🎨', 'Navigating to Creative Director...');
        try {
            await page.waitForSelector('[data-testid^="nav-item-"]', { timeout: 15000 });
        } catch {
            throw new Error('Sidebar never loaded');
        }

        const creativeNav = page.locator('[data-testid="nav-item-creative"]');
        await creativeNav.click({ force: true, timeout: 5000 });
        log('🎯', 'Clicked Creative Director (force=true)');
        await page.waitForTimeout(3000);

        // Dismiss overlays AGAIN (they can reappear on module change)
        await page.evaluate(() => {
            const svg = document.querySelector('svg.driver-overlay');
            if (svg) svg.remove();
            const popover = document.querySelector('.driver-popover');
            if (popover) popover.remove();
        });
        const cookies2 = page.locator('button:has-text("Accept All")');
        if (await cookies2.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cookies2.click();
            await page.waitForTimeout(500);
        }
        await page.waitForTimeout(1000);
        await screenshot(page, '03_creative_studio');
        log('✅', 'Creative Studio loaded');

        // GENERATE
        for (let i = 0; i < PROMPTS.length; i++) {
            const prompt = PROMPTS[i]!;
            const label = `image_${i + 1}`;
            log('🎯', `═══ GENERATING ${label} ═══`);

            // Find the "Describe your image..." input
            const promptSelectors = [
                'input[placeholder*="Describe your image"]',
                'input[placeholder*="image"]',
                'textarea[placeholder*="Describe your image"]',
                'textarea[placeholder*="image"]',
            ];

            let promptInput = null;
            for (const sel of promptSelectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
                    promptInput = el;
                    log('🎯', `Input: ${sel}`);
                    break;
                }
            }

            if (!promptInput) {
                log('❌', 'No image prompt bar found');
                await screenshot(page, `${label}_ERROR`);
                // Diagnostic
                const all = await page.locator('input, textarea').all();
                for (let j = 0; j < all.length; j++) {
                    const ph = await all[j]!.getAttribute('placeholder') || '';
                    const vis = await all[j]!.isVisible();
                    log('🔍', `  [${j}] ph="${ph}" vis=${vis}`);
                }
                continue;
            }

            await promptInput.click();
            await promptInput.fill(prompt);
            await page.waitForTimeout(500);
            await screenshot(page, `${label}_a_prompt`);

            // Press Enter (same as working daisy-chain)
            await promptInput.press('Enter');
            await page.waitForTimeout(1000);
            await screenshot(page, `${label}_b_triggered`);
            log('🚀', 'Enter pressed — generation triggered');

            // Wait for image (up to 90s)
            let imageFound = false;
            for (let tick = 0; tick < 18; tick++) {
                await page.waitForTimeout(5000);
                const elapsed = (tick + 1) * 5;

                const imgCount = await page.locator('img[src*="blob:"], img[src*="data:image/png"], img[src*="data:image/jpeg"], img[src*="firebasestorage"], img[src*="googleapis"]').count();
                if (imgCount > 0) {
                    imageFound = true;
                    log('✅', `IMAGE after ${elapsed}s (${imgCount} imgs)`);
                    break;
                }
                const canvases = await page.locator('canvas.upper-canvas, canvas.lower-canvas').count();
                if (canvases > 0) {
                    imageFound = true;
                    log('✅', `CANVAS after ${elapsed}s`);
                    break;
                }

                const spinning = await page.locator('.animate-spin').count();
                log('⏳', `${elapsed}s ${spinning > 0 ? '(spinner)' : ''}`);

                if (elapsed % 15 === 0) await screenshot(page, `${label}_wait_${elapsed}s`);
            }

            await page.waitForTimeout(2000);
            await screenshot(page, imageFound ? `${label}_c_RESULT` : `${label}_c_TIMEOUT`);
            log(imageFound ? '🎉' : '❌', imageFound ? 'IMAGE GENERATED!' : 'Timeout');
        }

    } catch (err: unknown) {
        log('💥', `${err instanceof Error ? err.message : err}`);
        await screenshot(page, 'FATAL').catch(() => {});
    } finally {
        console.log(`\n📁 ${OUTPUT_DIR}`);
        fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png')).forEach(f => console.log(`  📄 ${f}`));
        console.log('\nBrowser open 10s...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
}

main().catch(console.error);
