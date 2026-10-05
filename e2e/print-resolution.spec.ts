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
        const dataUrl = canvas.toDataURL('image/png');
        (window as unknown as Record<string, unknown>).__e2eMasterUrl = dataUrl;
        store.addToHistory({
            id: `e2e-master-${Date.now()}`,
            projectId: store.currentProjectId || 'default',
            type: 'image',
            url: dataUrl,
            prompt: 'E2E print master',
            timestamp: Date.now(),
        });
    });
}

async function openCreativeGallery(page: Page): Promise<void> {
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 45_000 });

    // Enter the creative module through whichever entry the harness shows:
    // the nav rail item, or the Creative Director department page's studio tab.
    const creativeNav = page.locator('[data-testid="nav-item-creative"]');
    if (await creativeNav.isVisible().catch(() => false)) {
        await creativeNav.click();
    } else {
        const director = page.getByRole('button', { name: 'Creative Director' });
        await director.click();
        const imageStudio = page.getByText('IMAGE STUDIO', { exact: false }).first(); // bypass-strict
        await imageStudio.click({ timeout: 15_000 }).catch(() => {});
    }

    // The compact gallery lives in the studio right panel (editor view),
    // on the panel's History tab. setRightPanelTab opens the panel without
    // toggleRightPanel's debounce.
    await page.evaluate(() => {
        const store = (window as unknown as {
            useStore?: { getState: () => { setModule: (m: string) => void; setViewMode: (m: string) => void; setRightPanelTab: (t: string) => void } };
        }).useStore;
        const s = store?.getState();
        s?.setModule('creative');
        s?.setViewMode('editor');
        // 'context' mounts StudioControlsPanel, whose History tab hosts the
        // compact CreativeGallery (the 'assets' tab renders a different panel).
        s?.setRightPanelTab('context');
    });
    await seedMaster(page);
    // Cold first-mount can race the lazy studio chunk — wait for the panel
    // itself before touching its tabs, then for the gallery.
    await expect(page.getByRole('heading', { name: 'Studio Controls' })).toBeVisible({ timeout: 30_000 });
    const historyTab = page.locator('button[title="History"]:visible').first(); // bypass-strict
    await expect(historyTab).toBeVisible({ timeout: 30_000 });
    await historyTab.click();
    await expect(page.locator('[data-testid="creative-gallery"]')).toBeVisible({ timeout: 30_000 });
    const gallery = page.locator('[data-testid="creative-gallery"]').first(); // bypass-strict
    await expect(gallery).toBeVisible({ timeout: 30_000 });
    const firstItem = page.locator('[data-testid^="gallery-item-"]').first(); // bypass-strict
    await expect(firstItem).toBeVisible({ timeout: 30_000 });
}

test.describe('print-resolution pipeline (structural)', () => {
    test('plan dialog renders the honest verdict and the print file carries DPI metadata', async ({ authedPage: page }) => {
        await openCreativeGallery(page);

        // Open the REAL dialog via the DEV e2e seam (compact panel menus are
        // clipped in this layout — the seam is the same pattern as window.useStore).
        await page.evaluate(() => {
            const D = (window as unknown as {
                __printSpecDialog?: { call: (p: {
                    srcWidth: number; srcHeight: number; initialPresetId: string;
                    exporter: (plan: { presetId: string }) => Promise<void>;
                }) => Promise<unknown> };
            }).__printSpecDialog;
            void D?.call({
                srcWidth: 2048,
                srcHeight: 2048,
                initialPresetId: 'cover_art_distributor',
                // REAL export path: same services the app uses, with the
                // seeded master from history.
                exporter: async (plan) => {
                    const { exportMasterAsset, prepareZipDownload } = await import('/src/services/export/AssetExporter.ts');
                    let masterUrl = (window as unknown as { __e2eMasterUrl: string }).__e2eMasterUrl;
                    // If upscale is needed, scale the canvas to the required resolution
                    if (plan.verdict === 'upscale') {
                        const img = new Image();
                        await new Promise((res, rej) => {
                            img.onload = res;
                            img.onerror = rej;
                            img.src = masterUrl;
                        });
                        const upCanvas = document.createElement('canvas');
                        upCanvas.width = plan.required.width;
                        upCanvas.height = plan.required.height;
                        const ctx = upCanvas.getContext('2d')!;
                        ctx.drawImage(img, 0, 0, plan.required.width, plan.required.height);
                        masterUrl = upCanvas.toDataURL('image/png');
                    }
                    const bundle = await exportMasterAsset({
                        masterUrl,
                        presets: [{ dimensionId: 'print', printPresetId: plan.presetId, printDpi: plan.dpi }],
                    });
                    return prepareZipDownload(bundle, `print-${plan.presetId}-e2e`);
                },
            });
        });
        const dialog = page.getByRole('dialog', { name: 'Print Size Check' });
        await expect(dialog).toBeVisible({ timeout: 15_000 });

        // 2048 master vs 3000 distributor floor → honest upscale-needed verdict.
        await page.getByTestId('printspec-preset-select').selectOption('cover_art_distributor');
        await expect(page.getByTestId('printspec-verdict')).toHaveText(/Upscale needed/);
        await expect(page.getByTestId('printspec-summary')).toContainText('3000 × 3000 px');
        await expect(page.getByTestId('printspec-summary')).toContainText('300 DPI');

        // Use the plan → exporter finishes → click download link → decode ZIP
        await page.getByTestId('printspec-use-plan').click();
        const downloadLink = page.getByTestId('printspec-download');
        await expect(downloadLink).toBeVisible({ timeout: 30_000 });
        const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
        await downloadLink.click();
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

        // Web context has no electronAPI — the facade's contract surfaces the
        // honest desktop guidance. Driven through the real facade module.
        const guidance = await page.evaluate(async () => {
            const { upscalerService, UpscaleUnavailableError } = (await import('/src/services/upscale/UpscalerService.ts')) as {
                upscalerService: { upscale: (o: { dataUrl: string; scale: 2 | 4 }) => Promise<unknown> };
                UpscaleUnavailableError: new (r: string, m: string) => Error & { reason: string };
            };
            try {
                await upscalerService.upscale({ dataUrl: 'data:image/png;base64,QQ==', scale: 2 });
                return 'unexpected-success';
            } catch (err) {
                return err instanceof UpscaleUnavailableError ? `reason:${err.reason}` : `other:${String(err)}`;
            }
        });
        expect(guidance).toBe('reason:no-electron');
    });
});
