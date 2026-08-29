import { test, expect } from './fixtures/auth';

/**
 * Regression: Studio Video Editor preview rendered a 2x3px "black player"
 * after the video-player DOM-ownership refactor — the intermediate container
 * only carried max-w/max-h (constraints, not a width source), so video.js
 * fluid sizing collapsed against a degenerate box even though the video
 * loaded and decoded fine.
 *
 * Structural evidence (mocked auth + injected store state): asserts the real
 * mount produces a visible, correctly-sized player with actual decoded
 * frames. Not a customer-path proof.
 */
test('video editor preview mounts a real, full-size player for a decoded clip', async ({ authedPage: page }) => {
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

    await page.goto('/');
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });

    await page.evaluate(() => {
        const store = (window as unknown as {
            useStore: { setState: (p: object) => void; getState: () => {
                setModule: (m: string) => Promise<void>;
                setGenerationMode: (m: 'image' | 'video') => void;
                setViewMode: (m: string) => void;
            } }
        }).useStore;
        store.getState().setModule('creative');
        store.setState({
            generatedHistory: [{
                id: 'e2e-preview-1',
                url: '/e2e/sample-clip.mp4',
                type: 'video',
                prompt: 'e2e preview regression clip',
                timestamp: Date.now(),
            }],
        });
        store.getState().setGenerationMode('video');
        store.getState().setViewMode('video_production');
    });

    await page.waitForSelector('[data-testid="creative-studio-container"]', { timeout: 30_000 });

    // Persisted slice fields get reasserted if a late rehydrate reverts them.
    for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            const store = (window as unknown as {
                useStore: { getState: () => {
                    setGenerationMode: (m: 'image' | 'video') => void;
                    setViewMode: (m: string) => void;
                    viewMode: string; generationMode: string;
                } }
            }).useStore;
            const s = store.getState();
            if (s.viewMode !== 'video_production' || s.generationMode !== 'video') {
                s.setGenerationMode('video');
                s.setViewMode('video_production');
            }
        });
    }

    const player = page.locator('[data-testid="video-player"]').first();
    await expect(player).toBeVisible({ timeout: 15_000 });

    // THE regression assertion: the player must occupy real space, not the
    // degenerate border box (was 2x3px at the bug).
    const box = await player.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(100);

    // And the clip must actually decode (real mp4 served by the dev server).
    // Poll readyState instead of a fixed sleep — slow runners must not flake.
    await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="video-player"] video, video-js[data-testid="video-player"] video');
        return (el as HTMLVideoElement | null)?.readyState !== undefined && (el as HTMLVideoElement).readyState >= 2;
    }, { timeout: 20_000 });
    const video = await player.evaluate((el) => {
        const v = el.tagName === 'VIDEO' ? el : el.querySelector('video');
        return { videoWidth: v?.videoWidth ?? 0, readyState: v?.readyState ?? 0, error: v?.error?.message ?? null };
    });
    expect(video.videoWidth).toBeGreaterThan(0);
    expect(video.readyState).toBeGreaterThanOrEqual(2);
    expect(video.error).toBeNull();
});
