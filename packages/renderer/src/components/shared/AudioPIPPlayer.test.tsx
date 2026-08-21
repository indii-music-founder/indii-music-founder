import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import AudioPIPPlayer from './AudioPIPPlayer';
import { useStore } from '@/core/store';
import { events } from '@/core/events';

/**
 * A failed play() must not leave the store claiming playback: the UI would
 * show a "playing" track that is actually silent with no feedback. The
 * player must roll the store back and surface a toast.
 */
describe('AudioPIPPlayer playback failure handling', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let playSpy: ReturnType<typeof vi.spyOn>;
    let emitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
            () => new Promise((_resolve, reject) => {
                setTimeout(() => reject(new DOMException('play() failed', 'NotAllowedError')), 10);
            }),
        );
        emitSpy = vi.spyOn(events, 'emit');
        useStore.setState({
            currentTrack: {
                id: 't1',
                type: 'music',
                prompt: 'test track',
                url: 'https://storage.example/t1.wav',
                timestamp: Date.now(),
                projectId: 'p1',
            },
            isPlaying: true,
            isPIPVisible: true,
        });
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        playSpy.mockRestore();
        emitSpy.mockRestore();
        useStore.setState({ currentTrack: null, isPlaying: false, isPIPVisible: false });
        vi.useRealTimers();
    });

    it('rolls the store back and alerts the user when playback fails', async () => {
        await act(async () => {
            root.render(<AudioPIPPlayer />);
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(useStore.getState().isPlaying).toBe(false);
        expect(emitSpy).toHaveBeenCalledWith('SYSTEM_ALERT', expect.objectContaining({ level: 'error' }));
    });

    it('does not alert when the play() rejection raced a user pause', async () => {
        await act(async () => {
            root.render(<AudioPIPPlayer />);
        });

        await act(async () => {
            // User hits pause before the play() rejection lands.
            useStore.setState({ isPlaying: false });
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(playSpy).toHaveBeenCalled();
        // The user paused; the race must stay silent (no error toast).
        expect(emitSpy).not.toHaveBeenCalled();
        expect(useStore.getState().isPlaying).toBe(false);
    });
});
