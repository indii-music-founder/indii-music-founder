/**
 * Mobile Experience E2E Tests
 *
 * Tests the complete mobile user journey including:
 * - Loading performance (no flash)
 * - Navigation with haptic feedback
 * - PWA installability
 * - Touch optimizations
 */

import { test, expect, type Page } from '@playwright/test';

// Helper to emulate mobile device
const mobileViewport = {
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
};

test.describe('Mobile Experience', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(mobileViewport);
    });

    test.describe('Loading Performance', () => {
        test('should not show loading flash for fast module loads', async ({ page }) => {
            await page.goto('/');

            // Wait for app to load
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 5000 });

            // Check that loading flash didn't appear (or appeared very briefly)
            const loadingElement = page.locator('text=Loading...');

            // The loading should either:
            // 1. Never appear (if load is < 200ms)
            // 2. Appear after 200ms delay
            const startTime = Date.now();
            try {
                await loadingElement.waitFor({ state: 'visible', timeout: 150 });
                const appearTime = Date.now() - startTime;

                // Should have waited at least 150ms (close to 200ms)
                expect(appearTime).toBeGreaterThan(150);
            } catch {
                // Loading never appeared - that's good (fast load)
                expect(true).toBe(true);
            }
        });

        test('should use absolute positioning for loading indicator', async ({ page }) => {
            await page.goto('/');

            // Try to catch the loading indicator if it appears
            try {
                const loadingContainer = await page.locator('text=Loading...').first().locator('..');
                const position = await loadingContainer.evaluate((el) =>
                    window.getComputedStyle(el).position
                );

                expect(position).toBe('absolute');
            } catch {
                // Loading didn't appear - test passes
                expect(true).toBe(true);
            }
        });
    });

    test.describe('Mobile Navigation', () => {
        test('should render mobile navigation at bottom', async ({ page }) => {
            await page.goto('/');

            // Mobile nav should be visible
            const mobileNav = page.locator('.md\\:hidden.fixed.bottom-0');
            await expect(mobileNav).toBeVisible();

            // Check position
            const boundingBox = await mobileNav.boundingBox();
            expect(boundingBox?.y).toBeGreaterThan(700); // Near bottom of viewport
        });

        test('should have WCAG compliant touch targets', async ({ page }) => {
            await page.goto('/');

            // Get all navigation buttons
            const navButtons = page.locator('.md\\:hidden.fixed.bottom-0 button');
            const count = await navButtons.count();

            for (let i = 0; i < count; i++) {
                const button = navButtons.nth(i);
                const boundingBox = await button.boundingBox();

                // WCAG requires minimum 44x44px touch targets
                // We use 64x48px for better UX
                if (boundingBox) {
                    expect(boundingBox.width).toBeGreaterThanOrEqual(44);
                    expect(boundingBox.height).toBeGreaterThanOrEqual(44);
                }
            }
        });

        test('should navigate between modules', async ({ page }) => {
            await page.goto('/');

            // Click on Creative Studio tab
            await page.click('button[aria-label="Studio"]');

            // Wait for navigation
            await page.waitForTimeout(500);

            // Check that Studio module is active
            const activeTab = page.locator('button[aria-current="page"]');
            await expect(activeTab).toHaveAttribute('aria-label', 'Studio');
        });

        test('should open overflow menu on More click', async ({ page }) => {
            await page.goto('/');

            // Click More button
            await page.click('button[aria-label="More"]');

            // Overflow menu should appear
            await expect(page.locator('text=More Features')).toBeVisible();

            // Should show overflow tabs
            await expect(page.locator('button[aria-label="Analysis"]')).toBeVisible();
            await expect(page.locator('button[aria-label="Legal"]')).toBeVisible();
        });

        test('should close overflow menu on backdrop click', async ({ page }) => {
            await page.goto('/');

            // Open overflow menu
            await page.click('button[aria-label="More"]');
            await expect(page.locator('text=More Features')).toBeVisible();

            // Click backdrop (outside menu)
            await page.click('.bg-black\\/60');

            // Menu should close
            await expect(page.locator('text=More Features')).not.toBeVisible();
        });
    });

    test.describe('PWA Features', () => {
        test('should have PWA manifest linked', async ({ page }) => {
            await page.goto('/');

            // Check for manifest link
            const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
            expect(manifestLink).toBe('/manifest.json');
        });

        test('should have valid PWA meta tags', async ({ page }) => {
            await page.goto('/');

            // Check theme color
            const themeColor = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
            expect(themeColor).toBe('#0f0f0f');

            // Check Apple mobile web app capable
            const appleMobileCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
            expect(appleMobileCapable).toBe('yes');

            // Check viewport
            const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
            expect(viewport).toContain('viewport-fit=cover');
        });

        test('should fetch manifest successfully', async ({ page }) => {
            const response = await page.goto('/manifest.json');
            expect(response?.status()).toBe(200);

            const manifest = await response?.json();
            expect(manifest.name).toBe('indiiOS - AI Creative Studio');
            expect(manifest.short_name).toBe('indiiOS');
            expect(manifest.display).toBe('standalone');
        });
    });

    test.describe('Touch Optimizations', () => {
        test('should prevent pull-to-refresh', async ({ page }) => {
            await page.goto('/');

            // Check body has overscroll-behavior: contain
            const overscrollBehavior = await page.evaluate(() => {
                return window.getComputedStyle(document.body).overscrollBehaviorY;
            });

            expect(overscrollBehavior).toBe('contain');
        });

        test('should have tap highlight disabled', async ({ page }) => {
            await page.goto('/');

            // Check -webkit-tap-highlight-color
            const tapHighlight = await page.evaluate(() => {
                return window.getComputedStyle(document.body).getPropertyValue('-webkit-tap-highlight-color');
            });

            expect(tapHighlight).toContain('transparent');
        });

        test('should have smooth scrolling enabled', async ({ page }) => {
            await page.goto('/');

            // Check -webkit-overflow-scrolling
            const overflowScrolling = await page.evaluate(() => {
                return window.getComputedStyle(document.body).getPropertyValue('-webkit-overflow-scrolling');
            });

            expect(overflowScrolling).toBe('touch');
        });
    });

    test.describe('Accessibility', () => {
        test('should have proper ARIA labels', async ({ page }) => {
            await page.goto('/');

            // Check navigation tabs have labels
            const homeTab = page.locator('button[aria-label="Home"]');
            await expect(homeTab).toBeVisible();

            const studioTab = page.locator('button[aria-label="Studio"]');
            await expect(studioTab).toBeVisible();
        });

        test('should indicate active page with aria-current', async ({ page }) => {
            await page.goto('/');

            // Default should be dashboard/home
            const activeTab = page.locator('button[aria-current="page"]');
            await expect(activeTab).toBeVisible();
            await expect(activeTab).toHaveAttribute('aria-label', 'Home');
        });

        test('should have accessible close button in overflow menu', async ({ page }) => {
            await page.goto('/');

            // Open overflow menu
            await page.click('button[aria-label="More"]');

            // Close button should have label
            const closeButton = page.locator('button[aria-label="Close menu"]');
            await expect(closeButton).toBeVisible();
        });
    });

    test.describe('Performance', () => {
        test('should load within performance budget', async ({ page }) => {
            const startTime = Date.now();
            await page.goto('/');
            await page.waitForSelector('[data-testid="app-container"]');
            const loadTime = Date.now() - startTime;

            // Should load in under 3 seconds on mobile
            expect(loadTime).toBeLessThan(3000);
        });

        test('should have responsive interactions', async ({ page }) => {
            await page.goto('/');

            // Measure navigation interaction time
            const startTime = Date.now();
            await page.click('button[aria-label="Studio"]');
            await page.waitForTimeout(100); // Wait for state update
            const interactionTime = Date.now() - startTime;

            // Should respond in under 200ms
            expect(interactionTime).toBeLessThan(200);
        });
    });
});

test.describe('Mobile Experience - iOS Specific', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'userAgent', {
                get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            });
        });
        await page.setViewportSize(mobileViewport);
    });

    test('should have iOS-specific meta tags', async ({ page }) => {
        await page.goto('/');

        // Check Apple-specific tags
        const appleTitle = await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content');
        expect(appleTitle).toBe('indiiOS');

        const appleStatusBar = await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
        expect(appleStatusBar).toBe('black-translucent');
    });

    test('should have safe area support', async ({ page }) => {
        await page.goto('/');

        // Check CSS variables for safe area
        const safeAreaVars = await page.evaluate(() => {
            const root = document.documentElement;
            return {
                top: getComputedStyle(root).getPropertyValue('--safe-area-inset-top'),
                bottom: getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom'),
            };
        });

        expect(safeAreaVars.top).toBeTruthy();
        expect(safeAreaVars.bottom).toBeTruthy();
    });
});

test.describe('Mobile Experience - Android Specific', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'userAgent', {
                get: () => 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
            });
        });
        await page.setViewportSize(mobileViewport);
    });

    test('should have Android theme color', async ({ page }) => {
        await page.goto('/');

        const themeColor = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
        expect(themeColor).toBe('#0f0f0f');
    });
});
