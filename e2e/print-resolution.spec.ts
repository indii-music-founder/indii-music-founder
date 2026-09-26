import { test, expect } from './fixtures/auth';
import JSZip from 'jszip';
import fs from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * Print-Resolution E2E (ISSUE-328 — structural tier).
 *
 * STRUCTURAL-ONLY: auth is the e2e state-injection fixture and the master
 * asset is seeded through the store — pipeline WIRING is proven in real
 * Chromium (plan verdict, print export, DPI metadata in delivered bytes,
 * web-context desktop guidance). NOT real-user evidence; the local-engine
 * leg requires real hardware per REAL_USER_AUTHENTICITY.md.
 *
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:4243 npx playwright test e2e/print-resolution.spec.ts
 */

/** Seed a real 2048×2048 PNG master into history via the page's own store. */
async function seedMaster(page: Page): Promise<void> {
    await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 2048;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 2048, 2048);
        gradient.addColorStop(0, '#12002b');
        gradient.addColorStop(1, '#4a00e0');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2048, 2048);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 220px sans-serif';
        ctx.fillText('INDII', 640, 1100);

        const store = (window as unknown as {
            useStore?: { getState: () => { addToHistory: (item: Record<string, unknown>) => void; currentProjectId?: string } };
        }).useStore?.getState();
        store.addToHistory({
            id: `e2e-master-${Date.now()}`,
            projectId: store.currentProjectId || 'default',
            type: 'image',
            url: canvas.toDataURL('image/png'),
            prompt: 'E2E print master',
            timestamp: Date.now(),
        });
    });
}

async function openCreativeGallery(page: Page): Promise<void> {
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 45_000 });
    const creativeNav = page.locator('[data-testid="nav-item-creative"]');
    if (await creativeNav.isVisible().catch(() => false)) {
        await creativeNav.click();
    } else {
        await page.evaluate(() => {
            const store = (window as unknown as { useStore?: { getState: () => { setModule: (m: string) => void } } }).useStore;
            store?.getState().setModule('creative');
        });
    }
    await seedMaster(page);
    const gallery = page.locator('[data-testid="creative-gallery"]').first();
    await expect(gallery).toBeVisible({ timeout: 30_000 });
    const firstItem = page.locator('[data-testid^="gallery-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 30_000 });
}

test.describe('print-resolution pipeline (structural)', () => {
    test('plan dialog renders the honest verdict and the print file carries DPI metadata', async ({ authedPage: page }) => {
        await openCreativeGallery(page);

        await page.getByTestId('send-menu-trigger').first().click();
        await page.getByTestId('send-to-print-check').click();
        const dialog = page.getByRole('dialog', { name: 'Print Size Check' });
        await expect(dialog).toBeVisible({ timeout: 15_000 });

        // 2048 master vs 3000 distributor floor → honest upscale-needed verdict.
        await page.getByTestId('printspec-preset-select').selectOption('cover_art_distributor');
        await expect(page.getByTestId('printspec-verdict')).toHaveText(/Upscale needed/);
        await expect(page.getByTestId('printspec-summary')).toContainText('3000 × 3000 px');
        await expect(page.getByTestId('printspec-summary')).toContainText('300 DPI');

        // Use the plan → print file downloads → decode the ZIP: the PNG inside
        // must carry the exact 3000² pixels AND the pHYs DPI chunk.
        const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
        await page.getByTestId('printspec-use-plan').click();
        const download = await downloadPromise;
        const zipPath = await download.path();
        expect(zipPath).toBeTruthy();

        const zip = await JSZip.loadAsync(fs.readFileSync(zipPath!));
        const entryName = Object.keys(zip.files)[0];
        const png = await zip.files[entryName].async('nodebuffer');

        expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
        const view = new DataView(png.buffer, png.byteOffset);
        expect(view.getUint32(16)).toBe(3000); // IHDR width
        expect(view.getUint32(20)).toBe(3000); // IHDR height

        let off = 8;
        const types: string[] = [];
        while (off + 12 <= png.length) {
            const len = view.getUint32(off);
            types.push(String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]));
            off += 12 + len;
        }
        expect(types).toContain('pHYs');
    });

    test('web context surfaces desktop guidance for the local engine instead of failing', async ({ authedPage: page }) => {
        await openCreativeGallery(page);

        await page.getByTestId('send-menu-trigger').first().click();
        await page.getByTestId('send-to-upscale-2x').click();

        // No electronAPI in the e2e browser → honest desktop guidance toast.
        await expect(page.getByText(/Local upscaling runs in the indii desktop app/)).toBeVisible({ timeout: 15_000 });
    });
});
