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
                const Tag = prop as keyof JSX.IntrinsicElements;
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
});
