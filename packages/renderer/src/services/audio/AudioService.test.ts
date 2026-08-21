import { beforeEach, describe, expect, it, vi } from 'vitest';
import { audioService, AudioPlaybackInterruptedError } from './AudioService';

describe('AudioService URL playback', () => {
    const play = vi.fn(async () => undefined);
    let createdAudio: {
        src: string;
        play: typeof play;
        pause: () => void;
        onended: (() => void) | null;
        onerror: ((error: unknown) => void) | null;
    };

    beforeEach(() => {
        play.mockClear();
        audioService.stop();
        audioService.setEnabled(true);
        class MockAudio {
            constructor(src: string) {
                createdAudio = {
                    src,
                    play,
                    pause: vi.fn(),
                    onended: null,
                    onerror: null,
                };
            }

            play() {
                return play();
            }

            pause() {
                createdAudio.pause();
            }

            set onended(handler: (() => void) | null) {
                createdAudio.onended = handler;
            }

            set onerror(handler: ((error: unknown) => void) | null) {
                createdAudio.onerror = handler;
            }
        }
        vi.stubGlobal('Audio', MockAudio);
    });

    it('plays an HTTPS Storage URL directly without converting it to a data URI', async () => {
        const playback = audioService.playUrl('https://storage.example/generated.wav', 'audio/wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());

        expect(createdAudio.src).toBe('https://storage.example/generated.wav');
        createdAudio.onended?.();
        await expect(playback).resolves.toBeUndefined();
    });

    it('rejects unresolved gs URIs instead of handing an unplayable source to the browser', async () => {
        await expect(audioService.playUrl('gs://bucket/generated.wav')).rejects.toThrow('HTTPS or blob');
        expect(play).not.toHaveBeenCalled();
    });
});

describe('AudioService stop/mute settles every pending playback promise', () => {
    const play = vi.fn(() => new Promise<void>(() => {}));
    let createdAudios: Array<{
        src: string;
        play: typeof play;
        pause: () => void;
        onended: (() => void) | null;
        onerror: ((error: unknown) => void) | null;
    }> = [];

    beforeEach(() => {
        createdAudios = [];
        play.mockClear();
        audioService.stop();
        audioService.setEnabled(true);
        class MockAudio {
            constructor(src: string) {
                createdAudios.push({
                    src,
                    play,
                    pause: vi.fn(),
                    onended: null,
                    onerror: null,
                });
            }

            play() {
                return play();
            }

            pause() {
                createdAudios[createdAudios.length - 1]!.pause();
            }

            set onended(handler: (() => void) | null) {
                createdAudios[createdAudios.length - 1]!.onended = handler;
            }

            set onerror(handler: ((error: unknown) => void) | null) {
                createdAudios[createdAudios.length - 1]!.onerror = handler;
            }
        }
        vi.stubGlobal('Audio', MockAudio);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('rejects the currently playing item when stop() is called', async () => {
        const playback = audioService.playUrl('https://storage.example/a.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());

        audioService.stop();

        await expect(playback).rejects.toBeInstanceOf(AudioPlaybackInterruptedError);
    });

    it('rejects every queued item when stop() is called', async () => {
        const first = audioService.playUrl('https://storage.example/a.wav');
        const second = audioService.playUrl('https://storage.example/b.wav');
        const third = audioService.playUrl('https://storage.example/c.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());

        audioService.stop();

        await expect(first).rejects.toBeInstanceOf(AudioPlaybackInterruptedError);
        await expect(second).rejects.toBeInstanceOf(AudioPlaybackInterruptedError);
        await expect(third).rejects.toBeInstanceOf(AudioPlaybackInterruptedError);
    });

    it('muting via setEnabled(false) settles pending playback instead of hanging it', async () => {
        const playback = audioService.playUrl('https://storage.example/a.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());

        audioService.setEnabled(false);

        await expect(playback).rejects.toBeInstanceOf(AudioPlaybackInterruptedError);
    });

    it('detaches handlers from the stopped element so it cannot drive the queue later', async () => {
        const first = audioService.playUrl('https://storage.example/a.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
        const stoppedElement = createdAudios[0]!;

        audioService.stop();
        expect(stoppedElement.onended).toBeNull();
        expect(stoppedElement.onerror).toBeNull();
        expect(stoppedElement.pause).toHaveBeenCalledOnce();

        // A stale onended firing later must not resolve the settled promise or start new playback.
        const settled = await first.catch((err) => err);
        stoppedElement.onended?.();
        expect(settled).toBeInstanceOf(AudioPlaybackInterruptedError);
        expect(play).toHaveBeenCalledTimes(1);
    });

    it('plays a new item normally after a stop()', async () => {
        const first = audioService.playUrl('https://storage.example/a.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
        audioService.stop();
        await first.catch(() => {}); // Settled by stop(); consume the rejection.

        const second = audioService.playUrl('https://storage.example/b.wav');
        await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2));

        const secondElement = createdAudios[1]!;
        secondElement.onended?.();
        await expect(second).resolves.toBeUndefined();
    });
});
