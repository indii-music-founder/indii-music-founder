import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Static imports ────────────────────────────────────────────────────────
import VideoPopout from '@/modules/creative/video/editor/VideoPopout';
import { useVideoEditorStore, INITIAL_PROJECT } from '@/modules/creative/video/store/videoEditorStore';

// ── BroadcastChannel mock ──────────────────────────────────────────────────

type MessageHandler = (e: { data: unknown }) => void;

interface ChannelInstance {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: MessageHandler | null;
}

let channelInstance: ChannelInstance;

beforeEach(() => {
    // Regular function (not arrow) so `new BroadcastChannel()` works.
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
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const setArtifact = (url: string | null) => {
    useVideoEditorStore.setState({ previewArtifactUrl: url });
};

describe('VideoPopout — BroadcastChannel lifecycle', () => {
    it('broadcasts POPOUT_OPENED immediately on mount', () => {
        render(<VideoPopout />);
        expect(channelInstance.postMessage).toHaveBeenCalledWith({ type: 'POPOUT_OPENED' });
    });

    it('closes the channel on unmount', () => {
        const { unmount } = render(<VideoPopout />);
        unmount();
        expect(channelInstance.close).toHaveBeenCalled();
    });
});

describe('VideoPopout — SYNC_PROJECT handling', () => {
    it('applies the synced project and rendered artifact', () => {
        render(<VideoPopout />);
        const sent = { ...INITIAL_PROJECT, name: 'Synced Project' };
        channelInstance.onmessage?.({
            data: { type: 'SYNC_PROJECT', project: sent, artifactUrl: 'file:///tmp/synced.mp4' },
        });
        const state = useVideoEditorStore.getState();
        if (state.project?.name !== 'Synced Project') { throw new Error('RAW STATE: ' + JSON.stringify({ keys: Object.keys(state), projectKeys: state.project ? Object.keys(state.project) : null, name: state.project && (state.project as {name?: string}).name })); }
        expect(state.project.name).toBe('Synced Project');
        expect(state.previewArtifactUrl).toBe('file:///tmp/synced.mp4');
    });
});

describe('VideoPopout — SYNC_ACTION handling', () => {
    it('drives the video element for play/pause/seek', async () => {
        setArtifact('file:///tmp/artifact.mp4');
        render(<VideoPopout />);
        const el = document.querySelector<HTMLVideoElement>('[data-testid="popout-video"]');
        expect(el).toBeTruthy();

        const playSpy = vi.spyOn(el as HTMLVideoElement, 'play').mockResolvedValue(undefined);
        const pauseSpy = vi.spyOn(el as HTMLVideoElement, 'pause');

        channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'play' } });
        expect(playSpy).toHaveBeenCalled();

        channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'pause' } });
        expect(pauseSpy).toHaveBeenCalled();

        channelInstance.onmessage?.({ data: { type: 'SYNC_ACTION', action: 'seek', frame: 45 } });
        expect(el!.currentTime).toBe(1.5); // 45 frames @30fps
    });

    it('shows an empty state without a rendered artifact', () => {
        setArtifact(null);
        render(<VideoPopout />);
        expect(document.querySelector('[data-testid="popout-video"]')).toBeNull();
        expect(document.body.textContent).toContain('No rendered artifact');
    });
});
