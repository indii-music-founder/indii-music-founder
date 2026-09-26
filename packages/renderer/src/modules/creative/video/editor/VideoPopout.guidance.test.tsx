/**
 * VideoPopout Jev guidance (pop-out fallback unit — guidance-side contract).
 *
 * The raw compiler error is ALWAYS visible; the Jev judgment only ever ADDS
 * an artist-facing guidance line (action → copy, null/none → no line).
 * Channel/sync lifecycle lives in VideoPopout.test.tsx.
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    judge: vi.fn(),
    preview: vi.fn(),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgePreviewErrorGuidance: mocks.judge,
}));

vi.mock('./hooks/useCompiledVideoPreview', () => ({
    useCompiledVideoPreview: mocks.preview,
}));

const storeState = {
    project: { id: 'pop-1', width: 1920, height: 1080, fps: 30, clips: [] },
    previewArtifactUrl: null as string | null,
    setProject: vi.fn(),
    setPreviewArtifactUrl: vi.fn(),
};

vi.mock('../store/videoEditorStore', () => ({
    useVideoEditorStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

import VideoPopout from './VideoPopout';

beforeEach(() => {
    vi.clearAllMocks();
    // Constructor-style stub — the component does `new BroadcastChannel(...)`.
    vi.stubGlobal('BroadcastChannel', class {
        postMessage = vi.fn();
        close = vi.fn();
        onmessage: ((event: { data?: unknown }) => void) | null = null;
    });
    mocks.preview.mockReturnValue({ html: null, error: null, isCompiling: false });
    storeState.previewArtifactUrl = null;
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('VideoPopout — Jev error guidance', () => {
    it('shows the raw error plus guidance when the judgment picks an action', async () => {
        mocks.preview.mockReturnValue({ html: null, error: 'compiler: clip c1 exceeds the project duration', isCompiling: false });
        mocks.judge.mockResolvedValue('trim_timeline');

        render(<VideoPopout />);

        // Raw error stays visible — the judgment never replaces it.
        expect(screen.getByText(/compiler: clip c1 exceeds the project duration/)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText(/trim or retime it in the editor/i)).toBeInTheDocument();
        });
        expect(mocks.judge).toHaveBeenCalledWith('compiler: clip c1 exceeds the project duration');
    });

    it('shows no guidance line when the judgment returns null (unavailable / none)', async () => {
        mocks.preview.mockReturnValue({ html: null, error: 'something unfathomable', isCompiling: false });
        mocks.judge.mockResolvedValue(null);

        render(<VideoPopout />);

        expect(screen.getByText(/something unfathomable/)).toBeInTheDocument();
        await waitFor(() => expect(mocks.judge).toHaveBeenCalled());
        expect(screen.queryByText(/trim or retime/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/re-link or replace/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Transient hiccup/i)).not.toBeInTheDocument();
    });

    it('drops stale guidance when a new error has no actionable match', async () => {
        mocks.judge.mockResolvedValueOnce('retry');
        mocks.preview.mockReturnValue({ html: null, error: 'first failure', isCompiling: false });

        const { rerender } = render(<VideoPopout />);
        await waitFor(() => expect(screen.getByText(/Transient hiccup/i)).toBeInTheDocument());

        mocks.preview.mockReturnValue({ html: null, error: 'second failure', isCompiling: false });
        mocks.judge.mockResolvedValueOnce(null);
        rerender(<VideoPopout />);

        await waitFor(() => {
            expect(screen.getByText(/second failure/)).toBeInTheDocument();
            expect(screen.queryByText(/Transient hiccup/i)).not.toBeInTheDocument();
        });
    });

    it('keeps the rendered-artifact fallback when compilation fails outright', () => {
        mocks.preview.mockReturnValue({ html: null, error: 'compiler: invalid durationInFrames 0', isCompiling: false });
        storeState.previewArtifactUrl = 'blob:rendered-artifact';

        render(<VideoPopout />);

        const video = screen.getByTestId('popout-video') as HTMLVideoElement;
        expect(video).toHaveAttribute('src', 'blob:rendered-artifact');
        expect(video.loop).toBe(true);
    });

    it('renders the live player when compilation succeeds', () => {
        mocks.preview.mockReturnValue({ html: '<html><body data-composition-id="pop-1"></body></html>', error: null, isCompiling: false });

        render(<VideoPopout />);

        const player = screen.getByTestId('popout-hyperframes-player');
        expect(player.getAttribute('srcdoc')).toContain('data-composition-id="pop-1"');
        // Pop-out loops natively; loop bounds belong to the viewer itself.
        expect(player.getAttribute('loop')).toBe('true');
    });
});
