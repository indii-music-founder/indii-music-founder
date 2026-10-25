import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransportBar from './TransportBar';
import type { HistoryItem } from '@/core/types/history';

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function track(id: string, url: string): HistoryItem {
    return { id, url, type: 'music', timestamp: Date.now() } as HistoryItem;
}

vi.mock('motion/react', () => {
    const motion = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, whileTap: _whileTap, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }:
                React.PropsWithChildren<Record<string, unknown>>) => {
                // ISSUE-1190: `keyof JSX.IntrinsicElements` used to widen to `string` under the
                // old blanket index signature. With real element types it is a union of every
                // tag, so props must satisfy ALL of them (three/drei elements demand `map`).
                // These mocks render a plain DOM tag, so `ElementType` is the accurate cast.
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...props}>{children}</Tag>;
            };
        },
    });
    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('TransportBar playback races', () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        Reflect.deleteProperty(navigator, 'mediaSession');
    });

    it('ignores an older track play result after the current track fails', async () => {
        const first = deferred<void>();
        const second = deferred<void>();
        vi.spyOn(HTMLMediaElement.prototype, 'play')
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise);

        const view = render(<TransportBar track={track('one', 'https://cdn.example/one.mp3')} />);
        view.rerender(<TransportBar track={track('two', 'https://cdn.example/two.mp3')} />);

        await act(async () => {
            second.reject(new Error('current track failed'));
            await second.promise.catch(() => undefined);
        });
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

        await act(async () => {
            first.resolve();
            await first.promise;
        });
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    });

    it('binds supported lock-screen controls to the active audio element and cleans them up', async () => {
        const handlers = new Map<string, ((details: { seekTime?: number; fastSeek?: boolean }) => void) | null>();
        const session = {
            metadata: null as unknown,
            playbackState: 'none',
            setActionHandler: vi.fn((action: string, handler: Parameters<typeof handlers.set>[1]) => handlers.set(action, handler)),
            setPositionState: vi.fn(),
        };
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: session });
        vi.stubGlobal('MediaMetadata', class { constructor(public data: Record<string, unknown>) {} });
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
        const onNext = vi.fn();
        const onPrevious = vi.fn();
        const item = { ...track('one', 'https://cdn.example/one.mp3'), prompt: 'Unreleased Mix' };
        const view = render(<TransportBar track={item} onNext={onNext} onPrevious={onPrevious} />);
        const audio = view.container.querySelector('audio')!;
        Object.defineProperty(audio, 'duration', { configurable: true, value: 100 });
        expect((session.metadata as { data: { title: string } }).data.title).toBe('Unreleased Mix');
        await act(async () => handlers.get('play')?.({}));
        expect(session.playbackState).toBe('playing');
        act(() => handlers.get('seekto')?.({ seekTime: 42 }));
        expect(audio.currentTime).toBe(42);
        act(() => handlers.get('nexttrack')?.({}));
        act(() => handlers.get('previoustrack')?.({}));
        expect(onNext).toHaveBeenCalledOnce();
        expect(onPrevious).toHaveBeenCalledOnce();
        view.unmount();
        expect(handlers.get('play')).toBeNull();
        expect(session.metadata).toBeNull();
    });
});
