import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

// Controls whether the Player forwards its ref (toggled per test).
let shouldInstallRef = true;
// Latest player instance — set by useImperativeHandle so guard tests can spy on seekTo.
let lastPlayerInstance: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn> } | null = null;

vi.mock('@remotion/player', () => {
    const MockPlayer = React.forwardRef<
        { play: () => void; pause: () => void; seekTo: (f: number) => void },
        Record<string, unknown>
    >((_props, ref) => {
        React.useImperativeHandle(ref, () => {
            if (!shouldInstallRef) return null as unknown as { play: () => void; pause: () => void; seekTo: (f: number) => void };
            const instance = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn() };
            lastPlayerInstance = instance;
            return instance;
        });
        return React.createElement('div', { 'data-testid': 'mock-player' });
    });
    MockPlayer.displayName = 'MockPlayer';
    return { Player: MockPlayer };
});

vi.mock('../remotion/MyComposition', () => ({
    MyComposition: () => React.createElement('div', { 'data-testid': 'mock-composition' }),
}));

// ── Static imports ────────────────────────────────────────────────────────
import VideoPopout from '@/modules/video/editor/VideoPopout';
import { useVideoEditorStore } from '@/modules/video/store/videoEditorStore';

// ── BroadcastChannel mock ──────────────────────────────────────────────────

type MessageHandler = (e: { data: unknown }) => void;

interface ChannelInstance {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: MessageHandler | null;
}

let channelInstance: ChannelInstance;

beforeEach(() => {
    shouldInstallRef = true;
    lastPlayerInstance = null;
    // Regular function (not arrow) so `new BroadcastChannel()` works.
    // Return an explicit object to avoid the no-this-alias lint rule.
    const MockBC = vi.fn(function () {
        const instance: ChannelInstance = {
            postMessage: vi.fn(),
            close: vi.fn(),
            onmessage: null,
        };
        channelInstance = instance;
        return instance;
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
    it('silently ignores SYNC_ACTION when playerRef is null', () => {
        // Prevent the Player from setting the ref — exercises the !playerRef.current guard.
        shouldInstallRef = false;
        render(<VideoPopout />);

        expect(() => {
            act(() => {
                channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'play' } });
            });
        }).not.toThrow();
        // Nothing was installed, so lastPlayerInstance should be null.
        expect(lastPlayerInstance).toBeNull();
    });

    it('does not call seekTo when frame is absent from seek action', () => {
        render(<VideoPopout />);
        // lastPlayerInstance is set by useImperativeHandle after mount.
        expect(lastPlayerInstance).not.toBeNull();

        act(() => {
            // Missing `frame` field — the typeof guard must block seekTo(undefined).
            channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'seek' } });
        });

        expect(lastPlayerInstance!.seekTo).not.toHaveBeenCalled();
    });
});
