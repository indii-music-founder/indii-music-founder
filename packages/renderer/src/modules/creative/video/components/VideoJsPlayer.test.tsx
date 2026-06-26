import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoJsPlayer, type VideoJsPlayerHandle } from './VideoJsPlayer';

const mocks = vi.hoisted(() => {
    const dispose = vi.fn();
    const src = vi.fn();
    const autoplay = vi.fn();
    const controls = vi.fn();
    const muted = vi.fn();
    const loop = vi.fn();
    const poster = vi.fn();
    const on = vi.fn();
    const off = vi.fn();
    const ready = vi.fn((cb: () => void) => cb());
    const currentTime = vi.fn(() => 12);
    const duration = vi.fn(() => 120);
    const buffered = vi.fn(() => null);
    const error = vi.fn(() => null);
    const el = vi.fn(() => document.createElement('div'));
    const player = {
        on,
        off,
        ready,
        dispose,
        src,
        autoplay,
        controls,
        muted,
        loop,
        poster,
        currentTime,
        duration,
        buffered,
        error,
        el,
    };
    const videojs = vi.fn(() => player);
    return { dispose, src, autoplay, controls, muted, loop, poster, on, off, ready, currentTime, duration, buffered, error, el, player, videojs };
});

vi.mock('video.js', () => ({
    default: mocks.videojs,
}));

describe('VideoJsPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates and disposes the player cleanly', () => {
        const ref = React.createRef<VideoJsPlayerHandle>();
        const { unmount } = render(
            <VideoJsPlayer
                ref={ref}
                videoUrl="https://storage.googleapis.com/test-video.mp4"
                onReady={() => undefined}
            />
        );

        expect(mocks.videojs).toHaveBeenCalledTimes(1);
        expect(ref.current).toBeTruthy();
        expect(ref.current?.currentTime()).toBe(12);
        expect(ref.current?.duration()).toBe(120);

        ref.current?.seekTo(33);
        expect(mocks.player.currentTime).toHaveBeenCalledWith(33);

        unmount();
        expect(mocks.dispose).toHaveBeenCalledTimes(1);
    });
});
