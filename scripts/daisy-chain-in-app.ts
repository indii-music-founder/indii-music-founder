/**
 * Daisy Chain IN-APP E2E Test via Playwright
 * 
 * Drives the actual indiiOS Creative Studio UI at localhost:4242.
 * Handles auth (Explore as Guest) → Creative Studio → Generate Image
 * 
 * This test exercises the REAL app code: ImageGenerationService,
 * the Creative Studio UI, and the entire generation pipeline.
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts', 'daisy-chain-output', 'in-app');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Clean previous output
for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.endsWith('.png')) {
        fs.unlinkSync(path.join(OUTPUT_DIR, f));
    }
}

function log(emoji: string, msg: string) {
    const ts = new Date().toISOString().split('T')[1]?.split('.')[0];
    console.log(`[${ts}] ${emoji} ${msg}`);
}

async function screenshot(page: Page, name: string) {
    const filepath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    log('📸', `Screenshot: ${name}.png`);
    return filepath;
}

async function waitForNetworkIdle(page: Page, timeout = 5000) {
    try {
        await page.waitForLoadState('networkidle', { timeout });
    } catch {
        // Network idle timeout is non-fatal
    }
}

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  DAISY CHAIN — IN-APP E2E TEST (Playwright)                ║');
    console.log('║  Driving the actual indiiOS Creative Studio UI             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 150,
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    try {
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Load App
        // ═══════════════════════════════════════════════════════════
        log('🌐', 'Navigating to app...');
        await page.goto('http://localhost:4242', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForNetworkIdle(page, 5000);
        await page.waitForTimeout(3000);
        await screenshot(page, '01_app_loaded');

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Auth — Explore as Guest (using data-testid)
        // ═══════════════════════════════════════════════════════════
        log('🔑', 'Checking for login screen...');

        // Use the reliable data-testid selector
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        const guestBtnAlt = page.locator('button:has-text("Explore as Guest")');

        let loggedIn = false;
        if (await guestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            log('🔑', 'Login detected (data-testid). Clicking "Explore as Guest"...');
            await guestBtn.click();
            loggedIn = true;
        } else if (await guestBtnAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
            log('🔑', 'Login detected (text fallback). Clicking "Explore as Guest"...');
            await guestBtnAlt.click();
            loggedIn = true;
        }

        if (loggedIn) {
            // Wait for auth to complete — the store sets user, triggers redirect
            log('⏳', 'Waiting for auth + redirect...');
            
            // Wait for the login form to disappear (proving auth succeeded)
            try {
                await page.waitForSelector('[data-testid="guest-login-btn"]', { 
                    state: 'hidden', 
                    timeout: 15000 
                });
                log('✅', 'Login form dismissed — auth succeeded');
            } catch {
                log('⚠️', 'Login form still visible after 15s. May need Firebase config.');
                await screenshot(page, '02_auth_stuck');
                // Try one more click
                if (await guestBtn.isVisible().catch(() => false)) {
                    await guestBtn.click();
                    await page.waitForTimeout(5000);
                }
            }
            
            await page.waitForTimeout(3000);
            await screenshot(page, '02_guest_logged_in');
            log('✅', 'Guest auth flow completed');
        } else {
            log('✅', 'Already authenticated — no login screen');
            await screenshot(page, '02_already_authed');
        }

        // ═══════════════════════════════════════════════════════════
        // DISMISS OVERLAYS: Cookie banner, onboarding tour
        // ═══════════════════════════════════════════════════════════
        
        // 1. Cookie Preferences banner
        const acceptCookies = page.locator('button:has-text("Accept All")');
        if (await acceptCookies.isVisible({ timeout: 2000 }).catch(() => false)) {
            log('🍪', 'Dismissing cookie banner...');
            await acceptCookies.click();
            await page.waitForTimeout(500);
        }

        // 2. Driver.js Onboarding Tour
        const driverOverlay = page.locator('.driver-overlay, .driver-popover');
        if (await driverOverlay.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            log('📋', 'Onboarding tour detected, dismissing with Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            // If still visible, try clicking close
            if (await driverOverlay.first().isVisible({ timeout: 500 }).catch(() => false)) {
                const closeBtn = page.locator('.driver-popover-close-btn').first();
                if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                }
            }
            log('✅', 'Tour dismissed');
        }

        // 3. Skip/Get Started buttons
        const skipBtn = page.locator('button:has-text("Skip"), button:has-text("Get Started"), button:has-text("Continue")');
        if (await skipBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            log('⏭️', 'Onboarding modal detected, clicking through...');
            await skipBtn.first().click();
            await page.waitForTimeout(1000);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Navigate to Creative Director
        // ═══════════════════════════════════════════════════════════
        log('🎨', 'Looking for Creative Director nav...');

        // Wait for the app shell (sidebar) to render
        try {
            await page.waitForSelector('[data-testid^="nav-item-"]', { timeout: 15000 });
        } catch {
            log('⚠️', 'Sidebar nav items not found in 15s.');
            await screenshot(page, '03_no_sidebar');
            // Diagnostic: what IS on the page?
            const bodyText = await page.textContent('body');
            log('🔍', `Page text (first 200 chars): ${bodyText?.slice(0, 200)}`);
            throw new Error('App shell did not load — sidebar not found');
        }
        await screenshot(page, '03_sidebar_visible');

        // Click Creative Director
        const creativeNav = page.locator('[data-testid="nav-item-creative"]');
        if (await creativeNav.isVisible({ timeout: 3000 }).catch(() => false)) {
            await creativeNav.click();
            log('🎯', 'Clicked Creative Director nav item');
        } else {
            // Try expanding sidebar first
            log('🔧', 'Creative nav not visible, trying to expand sidebar...');
            const toggle = page.locator('[data-testid="sidebar-toggle"]');
            if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
                await toggle.click();
                await page.waitForTimeout(800);
            }
            await creativeNav.click({ timeout: 5000 });
            log('🎯', 'Clicked Creative Director (after sidebar expand)');
        }

        await page.waitForTimeout(3000);
        await screenshot(page, '04_creative_studio');
        log('✅', 'Creative Studio opened');

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Enter Prompt via CommandBar
        // ═══════════════════════════════════════════════════════════
        log('📝', 'Finding prompt input...');

        // The app uses a CommandBar with PromptArea. Try multiple selectors.
        const promptSelectors = [
            '[data-testid="prompt-input"]',
            '[data-testid="command-bar-input"]',
            'textarea[placeholder*="image"]',
            'textarea[placeholder*="describe"]',
            'textarea[placeholder*="prompt"]',
            'input[placeholder*="image"]',
            'input[placeholder*="describe"]',
            'input[placeholder*="prompt"]',
            'textarea',
            'input[type="text"]',
        ];

        let promptInput = null;
        for (const selector of promptSelectors) {
            const el = page.locator(selector).first();
            if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
                promptInput = el;
                log('🎯', `Found prompt input: ${selector}`);
                break;
            }
        }

        if (!promptInput) {
            // Diagnostic dump
            await screenshot(page, '04b_no_prompt_input');
            const textareaCount = await page.locator('textarea').count();
            const inputCount = await page.locator('input').count();
            log('🔍', `Page has ${textareaCount} textareas, ${inputCount} inputs`);

            const allInteractable = await page.locator('textarea, input, [contenteditable]').all();
            for (let i = 0; i < Math.min(allInteractable.length, 10); i++) {
                const tag = await allInteractable[i]!.evaluate(el => el.tagName);
                const ph = await allInteractable[i]!.getAttribute('placeholder') || '';
                const vis = await allInteractable[i]!.isVisible();
                const testId = await allInteractable[i]!.getAttribute('data-testid') || '';
                log('🔍', `  [${i}] ${tag} placeholder="${ph}" data-testid="${testId}" visible=${vis}`);
            }

            throw new Error('No prompt input found in Creative Studio');
        }

        const PROMPT = 'Dark industrial warehouse interior converted into a techno club, laser grid ceiling, smoke machine haze, deep purple and cyan lighting, 808 speaker stacks, vinyl decks, Detroit techno aesthetic, cinematic film grain';
        await promptInput.click();
        await promptInput.fill(PROMPT);
        await page.waitForTimeout(500);
        await screenshot(page, '05_prompt_entered');
        log('✅', 'Prompt entered');

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Trigger Generation
        // ═══════════════════════════════════════════════════════════
        log('🚀', 'Triggering generation...');

        // Try pressing Enter first (CommandBar pattern)
        await promptInput.press('Enter');
        await page.waitForTimeout(1000);
        await screenshot(page, '06_generate_triggered');
        log('⏳', 'Generation triggered. Waiting for result...');

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Wait for Image (up to 90s)
        // ═══════════════════════════════════════════════════════════
        log('⏳', 'Waiting up to 90s for image to generate...');

        let imageFound = false;
        for (let i = 0; i < 18; i++) {
            await page.waitForTimeout(5000);
            const elapsed = (i + 1) * 5;
            
            // Check for generated images (blob URLs, data URLs, firebase storage)
            const imgCount = await page.locator('img[src*="blob:"], img[src*="data:image/png"], img[src*="data:image/jpeg"], img[src*="firebasestorage"]').count();
            if (imgCount > 0) {
                imageFound = true;
                log('✅', `Image appeared after ${elapsed}s! Found ${imgCount} generated image(s)`);
                break;
            }

            // Check for canvas elements (Fabric.js)
            const canvasCount = await page.locator('canvas.upper-canvas, canvas.lower-canvas').count();
            if (canvasCount > 0) {
                imageFound = true;
                log('✅', `Canvas detected after ${elapsed}s! (${canvasCount} canvases)`);
                break;
            }

            // Check for loading/spinner state (means generation is in progress)
            const isGenerating = await page.locator('[data-testid="generation-loading"], .animate-spin, [data-generating="true"]').count();
            if (isGenerating > 0) {
                log('⏳', `Still generating... ${elapsed}s (spinner visible)`);
            } else {
                log('⏳', `Waiting... ${elapsed}s`);
            }

            // Periodic screenshots
            if (elapsed % 15 === 0) {
                await screenshot(page, `07_waiting_${elapsed}s`);
            }
        }

        if (imageFound) {
            await page.waitForTimeout(2000);
            await screenshot(page, '08_image_generated');
            log('🎉', 'IMAGE GENERATED IN THE APP!');
        } else {
            await screenshot(page, '08_timeout');
            log('⚠️', 'No image detected after 90s. Check screenshot.');
            
            // Extra diagnostic: any error toasts?
            const toasts = await page.locator('[role="alert"], .toast, [data-testid*="toast"]').allTextContents();
            if (toasts.length > 0) {
                log('🔴', `Error toasts on page: ${toasts.join(' | ')}`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 7: Final State
        // ═══════════════════════════════════════════════════════════
        await screenshot(page, '09_final_state');
        log('✅', 'E2E test complete');

    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log('💥', `Error: ${errMsg}`);
        await screenshot(page, 'ERROR_final').catch(() => {});
    } finally {
        console.log('');
        log('📁', `All screenshots: ${OUTPUT_DIR}`);
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
        files.forEach(f => log('📄', `  ${f}`));
        console.log('');
        console.log('Browser staying open 15s for manual inspection...');
        await page.waitForTimeout(15000);
        await browser.close();
    }
}

main().catch(console.error);
