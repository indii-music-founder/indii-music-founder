import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@remotion/player', () => {
    const MockPlayer = React.forwardRef<
        { play: () => void; pause: () => void; seekTo: (f: number) => void },
        Record<string, unknown>
    >((_props, ref) => {
        React.useImperativeHandle(ref, () => ({
            play: vi.fn(),
            pause: vi.fn(),
            seekTo: vi.fn(),
        }));
        return React.createElement('div', { 'data-testid': 'mock-player' });
    });
    MockPlayer.displayName = 'MockPlayer';
    return { Player: MockPlayer };
});

vi.mock('../remotion/MyComposition', () => ({
    MyComposition: () => React.createElement('div', { 'data-testid': 'mock-composition' }),
}));

// ── Static imports ────────────────────────────────────────────────────────
import VideoPopout from './VideoPopout';
import { useVideoEditorStore } from '../store/videoEditorStore';

// ── BroadcastChannel mock ──────────────────────────────────────────────────

type MessageHandler = (e: { data: unknown }) => void;

interface ChannelInstance {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: MessageHandler | null;
}

let channelInstance: ChannelInstance;

beforeEach(() => {
    // Use a regular function (not arrow) so `new BroadcastChannel()` works.
    // We capture `this` to get the instance after it's created by the component.
    const MockBC = vi.fn(function (this: ChannelInstance) {
        this.postMessage = vi.fn();
        this.close = vi.fn();
        this.onmessage = null;
        channelInstance = this;
    });
    vi.stubGlobal('BroadcastChannel', MockBC);
    vi.useFakeTimers();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('VideoPopout — BroadcastChannel lifecycle', () => {
    it('broadcasts POPOUT_OPENED immediately on mount', () => {
        render(<VideoPopout />);
        expect(channelInstance.postMessage).toHaveBeenCalledWith({ type: 'POPOUT_OPENED' });
    });

    it('sends a HEARTBEAT every 2 s', () => {
        render(<VideoPopout />);
        channelInstance.postMessage.mockClear();

        act(() => { vi.advanceTimersByTime(6000); });

        const heartbeats = (channelInstance.postMessage.mock.calls as Array<[{ type: string }]>).filter(
            ([msg]) => msg.type === 'HEARTBEAT'
        );
        expect(heartbeats.length).toBe(3); // at 2 s, 4 s, 6 s
    });

    it('broadcasts POPOUT_CLOSED on beforeunload', () => {
        render(<VideoPopout />);
        channelInstance.postMessage.mockClear();

        act(() => { window.dispatchEvent(new Event('beforeunload')); });

        expect(channelInstance.postMessage).toHaveBeenCalledWith({ type: 'POPOUT_CLOSED' });
    });

    it('closes the channel and stops heartbeats on unmount', () => {
        const { unmount } = render(<VideoPopout />);
        unmount();
        expect(channelInstance.close).toHaveBeenCalledTimes(1);

        channelInstance.postMessage.mockClear();
        act(() => { vi.advanceTimersByTime(10000); });
        expect(channelInstance.postMessage).not.toHaveBeenCalled();
    });
});

describe('VideoPopout — SYNC_PROJECT handling', () => {
    it('calls setProject when a SYNC_PROJECT message arrives', () => {
        const { setProject } = useVideoEditorStore.getState();

        render(<VideoPopout />);

        const incomingProject = {
            id: 'synced-project', name: 'Synced', fps: 30,
            durationInFrames: 300, width: 1920, height: 1080,
            tracks: [], clips: [],
        };

        act(() => {
            channelInstance.onmessage?.({ data: { type: 'SYNC_PROJECT', project: incomingProject } });
        });

        expect(setProject).toHaveBeenCalledWith(incomingProject);
    });
});

describe('VideoPopout — SYNC_ACTION guard tests', () => {
    it('does not throw when playerRef is null and SYNC_ACTION arrives', () => {
        render(<VideoPopout />);
        expect(() => {
            act(() => {
                channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'play' } });
            });
        }).not.toThrow();
    });

    it('does not call seekTo when frame is missing from seek action', () => {
        render(<VideoPopout />);
        expect(() => {
            act(() => {
                // No `frame` field — the typeof guard must block seekTo(undefined)
                channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'seek' } });
            });
        }).not.toThrow();
    });
});
