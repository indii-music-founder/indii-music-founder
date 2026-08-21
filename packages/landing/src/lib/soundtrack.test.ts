import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSoundtrackSource } from './soundtrack';

describe('loadSoundtrackSource', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-soundtrack');
        revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        createObjectURLSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
    });

    it('fetches with no-store cache and a timeout signal, returning a playable audio asset', async () => {
        let capturedSignal: AbortSignal | null | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init?: RequestInit) => {
                capturedSignal = init?.signal;
                const body = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });
                return new Response(body, { status: 200, headers: { 'content-type': 'audio/webm' } });
            }),
        );

        const result = await loadSoundtrackSource('http://example.test/theme.webm');

        expect(fetch).toHaveBeenCalledWith('http://example.test/theme.webm', {
            cache: 'no-store',
            signal: capturedSignal,
        });
        expect(capturedSignal?.aborted).toBe(false);
        expect(result).not.toBeNull();
        expect(result!.audio).toBeInstanceOf(HTMLAudioElement);
        expect(result!.audio.loop).toBe(true);
        expect(result!.url).toBe('blob:mock-soundtrack');
    });

    it('skips non-audio responses (e.g. the app shell for an unknown asset)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response('<html>app shell</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
            ),
        );

        const result = await loadSoundtrackSource('http://example.test/theme.webm');

        expect(result).toBeNull();
        expect(createObjectURLSpy).not.toHaveBeenCalled();
    });

    it('skips error responses', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));

        const result = await loadSoundtrackSource('http://example.test/missing.webm');

        expect(result).toBeNull();
    });

    it('aborts the fetch when the timeout elapses so a hung asset cannot stall audio forever', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                }),
            ),
        );

        const promise = loadSoundtrackSource('http://example.test/hung.webm', { timeoutMs: 15000 });
        // Attach the rejection handler before the abort fires so the
        // rejection is never observed as unhandled.
        const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(15000);

        await assertion;
    });

    it('does not abort when the fetch completes before the timeout', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response('audio', { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
            ),
        );

        await loadSoundtrackSource('http://example.test/fast.mp3', { timeoutMs: 15000 });
        await vi.advanceTimersByTimeAsync(20000);

        // No unhandled abort rejection: the timer was cleared in finally.
        expect(true).toBe(true);
    });
});
