#!/usr/bin/env node
/**
 * Captures clean, chrome-free 2560x1440 (1280x720 @ 2x) Retina screenshots of
 * each real Studio module in Present Mode (`?present=1`) for the landing site.
 *
 * Expects a running renderer dev/preview server at STUDIO_URL (defaults to
 * http://localhost:4242) with VITE_E2E=true VITE_FIREBASE_E2E_MOCK=true
 * VITE_FIREBASE_PROJECT_ID=mock-project VITE_RENDERER_ONLY=true.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'packages/landing/public/screenshots');
const studioUrl = process.env.STUDIO_URL || 'http://localhost:4242';
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const TARGETS = [
    { file: 'dashboard.png', moduleId: 'dashboard' },
    { file: 'creative.png', moduleId: 'creative' },
    { file: 'workflow.png', moduleId: 'workflow' },
    { file: 'canvas.png', moduleId: 'project-canvas' },
    { file: 'distribution.png', moduleId: 'distribution' },
    { file: 'analytics.png', moduleId: 'analytics' },
    { file: 'finance.png', moduleId: 'finance' },
    { file: 'legal.png', moduleId: 'legal' },
    { file: 'marketing.png', moduleId: 'marketing' },
    { file: 'screenwriter.png', moduleId: 'screenwriter' },
    { file: 'merch.png', moduleId: 'merch' },
    { file: 'publicist.png', moduleId: 'publicist' },
    { file: 'social.png', moduleId: 'social' },
    { file: 'licensing.png', moduleId: 'licensing' },
    { file: 'tour.png', moduleId: 'road' },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(
    chromiumPath ? { executablePath: chromiumPath } : {},
);

try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 810 },
        deviceScaleFactor: 2,
        serviceWorkers: 'block',
    });

    await context.addInitScript(() => {
        window.FIREBASE_E2E_MOCK = true;
        window.FIREBASE_USER_MOCK = {
            uid: 'artist-showcase',
            email: 'studio@indii.music',
            displayName: 'indii Artist',
            isAnonymous: false,
            getIdToken: async () => 'mock-token',
        };
        try {
            localStorage.setItem('FIREBASE_E2E_MOCK', 'true');
            localStorage.setItem('onboarding_dismissed', 'true');
            localStorage.setItem('indii_tour_completed_v1', 'true');
            localStorage.setItem('indii_platform_card_dismissed', 'true');
            localStorage.setItem('indii_cookie_consent', JSON.stringify({ essential: true, analytics: false, updatedAt: Date.now() }));
        } catch {
            // ignore
        }
    });

    const page = await context.newPage();

    // Stub network calls cleanly so the mock E2E runtime never stalls waiting on Firestore/Vertex.
    await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.startsWith(studioUrl) || url.startsWith('data:') || url.startsWith('blob:')) {
            return route.continue();
        }
        if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit.googleapis.com')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        return route.abort();
    });

    await page.goto(`${studioUrl}/?present=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.useStore), { timeout: 20_000 });
    await page.waitForTimeout(1800);

    // Ensure clean profile label (never "E2E Test User") in sidebar if rendered
    await page.evaluate(() => {
        const store = window.useStore?.getState?.();
        if (store?.userProfile) {
            window.useStore.setState({
                userProfile: {
                    ...store.userProfile,
                    displayName: 'indii Artist',
                    email: 'studio@indii.music',
                },
            });
        }
    });

    // Wait 2.4s so the temporary 2s "Presenting · Shift+P to exit" toast disappears cleanly.
    await page.waitForTimeout(2400);

    for (const target of TARGETS) {
        await page.evaluate((moduleId) => {
            window.useStore.getState().setModule(moduleId);
        }, target.moduleId);
        await page.waitForTimeout(1400);
        const dest = join(outDir, target.file);
        await page.screenshot({ path: dest });
        console.log(`captured ${target.moduleId} -> ${target.file}`);
    }
} finally {
    await browser.close();
}
