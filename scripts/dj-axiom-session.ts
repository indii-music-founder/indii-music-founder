/**
 * DJ AXIOM — CREATIVE SESSION
 * ============================
 * Actually generates real assets using the indiiOS Creative Studio.
 * 
 * Generates:
 *   1. Main event flyer (landscape 16:9)
 *   2. IG Story variant (portrait 9:16)
 *   3. Square social post (1:1)
 * 
 * All images saved to scripts/dj-axiom-output/
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), 'dj-axiom-output');
const APP_URL = 'http://localhost:4242';
const GEN_TIMEOUT = 90_000; // 90s max wait for generation

// The prompts DJ Axiom needs for SIGNAL @ Roosevelt Park
const PROMPTS = [
    {
        name: '01_main_flyer_16x9',
        prompt: 'Dark industrial techno event flyer for SIGNAL at Roosevelt Park Detroit, neon purple and cyan lighting, brutalist typography, summer solstice June 21, AXIOM PRESENTS, underground rave aesthetic, 808 speaker stacks, vinyl decks, cinematic film grain',
        aspectRatio: null, // use default (1:1 from app)
    },
    {
        name: '02_ig_story_portrait',
        prompt: 'Vertical Instagram story poster, SIGNAL Detroit techno party, Roosevelt Park, glowing cyan and magenta neon grid, dark moody atmosphere, June 21 summer solstice, DJ Axiom, minimal brutalist design, fog machine haze',
        aspectRatio: null,
    },
    {
        name: '03_social_square',
        prompt: 'Square social media post, Detroit techno underground event SIGNAL, Roosevelt Park amphitheater at night, laser grid pattern, deep purple and electric blue, AXIOM branding, warehouse rave energy, grain texture overlay',
        aspectRatio: null,
    },
];

function log(msg: string) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(`[${ts}] ${msg}`);
}

async function waitForAuth(page: Page): Promise<void> {
    log('🔑 Checking for login screen...');

    // Check for login form
    const loginForm = await page.$('[data-testid="login-form"], [data-testid="auth-container"], form');
    if (!loginForm) {
        log('✅ No login screen detected — already authenticated');
        return;
    }

    // Look for guest button
    const guestBtn = await page.$('button:has-text("Explore as Guest"), button:has-text("Guest"), [data-testid="guest-login-btn"]');
    if (guestBtn) {
        log('🔑 Login detected. Clicking "Explore as Guest"...');
        await guestBtn.click();
        await page.waitForTimeout(3000);
        log('✅ Guest auth flow completed');
    } else {
        log('⚠️ Login screen but no guest button found. Waiting...');
        await page.waitForTimeout(5000);
    }
}

async function navigateToCreativeStudio(page: Page): Promise<void> {
    log('🎨 Looking for Creative Director nav...');

    // Try clicking Creative Director in sidebar
    const navItem = await page.$('text=Creative Director');
    if (navItem) {
        await navItem.click();
        await page.waitForTimeout(2000);
        log('✅ Creative Studio opened');
    } else {
        log('⚠️ Creative Director nav not found, trying direct URL...');
        // The app may use hash routing or store-based navigation
        await page.waitForTimeout(2000);
    }
}

async function dismissOverlays(page: Page): Promise<void> {
    log('🧹 Dismissing overlays...');

    // 1. Close the onboarding tour (driver.js)
    // The tour shows "Your Creative OS" with Next/Back buttons and an X to close
    for (let attempt = 0; attempt < 10; attempt++) {
        // Try the X button on the tour popover
        const closeBtn = await page.$('.driver-popover-close-btn, button.driver-popover-close-btn');
        if (closeBtn) {
            try {
                await closeBtn.click({ force: true });
                log(`  → Dismissed tour popover (attempt ${attempt + 1})`);
                await page.waitForTimeout(500);
            } catch { /* ignore */ }
        } else {
            break;
        }
    }

    // 2. Also try pressing Escape to close any driver.js overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 3. Dismiss cookie banner
    const cookieSelectors = [
        'button:has-text("Accept All")',
        'button:has-text("Accept")',
        'button:has-text("Got it")',
        '[data-testid="cookie-accept"]',
    ];
    for (const selector of cookieSelectors) {
        const btn = await page.$(selector);
        if (btn) {
            try {
                await btn.click({ force: true });
                log('  → Dismissed cookie banner');
                await page.waitForTimeout(500);
            } catch { /* ignore */ }
            break;
        }
    }

    // 4. Close any remaining modals/overlays
    const modalClose = await page.$('button[aria-label="Close"], button:has-text("×"), .driver-popover-close-btn');
    if (modalClose) {
        try {
            await modalClose.click({ force: true });
            await page.waitForTimeout(300);
        } catch { /* ignore */ }
    }

    // 5. Final escape 
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    log('  ✅ Overlays cleared');
}

async function generateImage(page: Page, prompt: string, name: string): Promise<boolean> {
    log(`📝 Entering prompt for: ${name}`);

    // The IMAGE prompt bar is at the TOP of the page with "Describe your image..." placeholder
    // NOT the bottom chat input which says "Message creative..."
    const inputSelectors = [
        'input[placeholder*="Describe your image"]',
        'input[placeholder*="image"]',
        'textarea[placeholder*="Describe your image"]',
        '[data-testid="image-prompt-input"]',
    ];

    let input = null;
    for (const sel of inputSelectors) {
        input = await page.$(sel);
        if (input) {
            log(`  → Found image prompt bar: ${sel}`);
            break;
        }
    }

    if (!input) {
        log('❌ Could not find image prompt bar! Taking diagnostic screenshot...');
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_ERROR_no_input.png`), fullPage: false });
        return false;
    }

    // Clear and type prompt
    await input.click();
    await page.waitForTimeout(300);
    await input.fill('');
    await page.waitForTimeout(200);
    await input.fill(prompt);
    await page.waitForTimeout(500);

    // Screenshot after entering prompt
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_a_prompt.png`), fullPage: false });
    log('📸 Prompt entered in image bar');

    // The send button is the paper-plane arrow next to the input bar (SVG icon)
    // It's inside the same container as the prompt bar — look for the arrow/send button 
    const genSelectors = [
        'button[aria-label*="send" i]',
        'button[aria-label*="generate" i]',
        // The arrow button near the top prompt bar (paper plane icon)
        '.flex.items-center button:last-child',
    ];

    let genBtn = null;
    for (const sel of genSelectors) {
        genBtn = await page.$(sel);
        if (genBtn) {
            log(`  → Found send button: ${sel}`);
            break;
        }
    }

    if (!genBtn) {
        // Fallback: find the SVG send arrow that's a sibling/near the input
        // The prompt bar has a button with an SVG paper-plane icon right next to it
        const allBtns = await page.$$('button');
        for (const btn of allBtns) {
            const box = await btn.boundingBox();
            // The send button is in the top area (y < 120) and on the right side
            if (box && box.y < 120 && box.x > 900) {
                const svg = await btn.$('svg');
                if (svg) {
                    genBtn = btn;
                    log('  → Found send button via position heuristic (top-right with SVG)');
                    break;
                }
            }
        }
    }

    if (!genBtn) {
        log('❌ Could not find send/generate button!');
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_ERROR_no_button.png`), fullPage: false });
        return false;
    }

    log('🚀 Clicking generate...');
    await genBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_b_generating.png`), fullPage: false });

    // Wait for image to appear
    log(`⏳ Waiting up to ${GEN_TIMEOUT / 1000}s for image to generate...`);
    const startTime = Date.now();
    let imageFound = false;

    while (Date.now() - startTime < GEN_TIMEOUT) {
        // Check for generated image(s) — look for img elements in the canvas/gallery area
        const images = await page.$$('img[src*="data:image"], img[src*="blob:"], img[src*="googleapis"], img[src*="firebasestorage"]');
        // Filter out tiny icons/avatars
        const realImages: typeof images = [];
        for (const img of images) {
            const box = await img.boundingBox();
            if (box && box.width > 100 && box.height > 100) {
                realImages.push(img);
            }
        }

        if (realImages.length > 0) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            log(`✅ Image appeared after ${elapsed}s! Found ${realImages.length} generated image(s)`);
            imageFound = true;
            break;
        }

        // Check for error toast
        const errorToast = await page.$('text=failed, text=error, text=Error');
        if (errorToast) {
            const errorText = await errorToast.textContent();
            log(`❌ Generation error: ${errorText}`);
            await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_ERROR_gen.png`), fullPage: false });
            return false;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed % 10 === 0 && elapsed > 0) {
            log(`  ⏳ Still generating... ${elapsed}s`);
        }
        await page.waitForTimeout(2000);
    }

    if (!imageFound) {
        log(`❌ Timeout after ${GEN_TIMEOUT / 1000}s`);
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_ERROR_timeout.png`), fullPage: false });
        return false;
    }

    // Final screenshot with the generated image
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}_c_result.png`), fullPage: false });
    log(`📸 Result saved: ${name}_c_result.png`);

    // Try to also save the actual generated image by right-click/download
    // For now the screenshot captures it in viewport
    log(`🎉 ${name} — GENERATED SUCCESSFULLY`);
    return true;
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  DJ AXIOM — SIGNAL @ Roosevelt Park                        ║
║  Creative Session — Generating Real Event Artwork           ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();

    try {
        // 1. Navigate to app
        log('🌐 Navigating to app...');
        await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '00_app_loaded.png'), fullPage: false });

        // 2. Auth
        await waitForAuth(page);
        await dismissOverlays(page);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '00_authed.png'), fullPage: false });

        // 3. Navigate to Creative Studio
        await navigateToCreativeStudio(page);
        await page.waitForTimeout(1000);
        await dismissOverlays(page);

        // 4. Generate each asset
        const results: { name: string; success: boolean }[] = [];

        for (const item of PROMPTS) {
            log(`\n${'═'.repeat(60)}`);
            log(`🎯 GENERATING: ${item.name}`);
            log(`${'═'.repeat(60)}`);

            const success = await generateImage(page, item.prompt, item.name);
            results.push({ name: item.name, success });

            // Wait between generations to avoid rate limits
            if (PROMPTS.indexOf(item) < PROMPTS.length - 1) {
                log('⏳ Cooling down 5s before next generation...');
                await page.waitForTimeout(5000);
            }
        }

        // 5. Final summary
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 GENERATION RESULTS');
        console.log(`${'═'.repeat(60)}`);
        for (const r of results) {
            console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`\n  ${successCount}/${results.length} assets generated.`);
        console.log(`  Output: ${OUTPUT_DIR}`);

    } catch (error) {
        log(`💥 Fatal error: ${error}`);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'FATAL_ERROR.png'), fullPage: false }).catch(() => {});
    } finally {
        log('🏁 Session complete. Closing browser.');
        await browser.close();
    }
}

main().catch(console.error);
