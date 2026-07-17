import { beforeEach, describe, expect, it, vi } from 'vitest';
import { audioService } from './AudioService';

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
