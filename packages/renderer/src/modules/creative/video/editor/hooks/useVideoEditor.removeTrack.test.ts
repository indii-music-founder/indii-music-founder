import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoEditor } from './useVideoEditor';
import { useVideoEditorStore, blankProjectForId } from '@/modules/creative/video/store/videoEditorStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// This suite needs the REAL store — the global setup swaps in a fully-stubbed
// mock whose removeTrack is a no-op vi.fn(), which cannot prove a cascade.
vi.mock('@/modules/creative/video/store/videoEditorStore', async (importOriginal) => importOriginal());

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: { call: vi.fn() },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn(), addToast: vi.fn() }),
}));

vi.mock('@/services/firebase', () => ({ functionsWest1: {} }));

const TRACK_WITH_CLIPS = 'track-1';
const EMPTY_TRACK = 'track-2';

/**
 * Regression: deleting a track silently deleted every clip on it, with no undo
 * anywhere in the editor and no confirmation. On a timeline referencing
 * irreplaceable session footage that is unrecoverable.
 * Found by /qa on 2026-07-22 during the ISSUE-1180 step-1 audit.
 * Report: .agent/test_ledger/OPEN_ISSUES_V2.md
 */
describe('useVideoEditor — destructive track removal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useVideoEditorStore.setState({
            project: {
                ...blankProjectForId('proj-1'),
                clips: [
                    { id: 'c1', type: 'video', startFrame: 0, durationInFrames: 30, trackId: TRACK_WITH_CLIPS, name: 'Take 1' },
                    { id: 'c2', type: 'video', startFrame: 30, durationInFrames: 30, trackId: TRACK_WITH_CLIPS, name: 'Take 2' },
                ],
            },
        });
    });

    it('asks before deleting a track that has clips, and keeps them when declined', async () => {
        vi.mocked(ConfirmDialog.call).mockResolvedValue(false as never);

        const { result } = renderHook(() => useVideoEditor());
        await act(async () => {
            await result.current.removeTrack(TRACK_WITH_CLIPS);
        });

        expect(ConfirmDialog.call).toHaveBeenCalledTimes(1);
        // Nothing removed: both clips and the track survive a declined confirm.
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(2);
        expect(useVideoEditorStore.getState().project.tracks.some(t => t.id === TRACK_WITH_CLIPS)).toBe(true);
    });

    it('names the exact number of clips at risk so the choice is informed', async () => {
        vi.mocked(ConfirmDialog.call).mockResolvedValue(false as never);

        const { result } = renderHook(() => useVideoEditor());
        await act(async () => {
            await result.current.removeTrack(TRACK_WITH_CLIPS);
        });

        const args = vi.mocked(ConfirmDialog.call).mock.calls[0]?.[0] as { message: string; variant?: string };
        expect(args.message).toContain('2 clips');
        expect(args.variant).toBe('destructive');
    });

    it('deletes the track and its clips once confirmed', async () => {
        vi.mocked(ConfirmDialog.call).mockResolvedValue(true as never);

        const { result } = renderHook(() => useVideoEditor());
        await act(async () => {
            await result.current.removeTrack(TRACK_WITH_CLIPS);
        });

        expect(useVideoEditorStore.getState().project.clips).toHaveLength(0);
        expect(useVideoEditorStore.getState().project.tracks.some(t => t.id === TRACK_WITH_CLIPS)).toBe(false);
    });

    it('does not interrupt for an empty track — removing one stays a single click', async () => {
        const { result } = renderHook(() => useVideoEditor());
        await act(async () => {
            await result.current.removeTrack(EMPTY_TRACK);
        });

        expect(ConfirmDialog.call).not.toHaveBeenCalled();
        expect(useVideoEditorStore.getState().project.tracks.some(t => t.id === EMPTY_TRACK)).toBe(false);
        // The other track's clips are untouched.
        expect(useVideoEditorStore.getState().project.clips).toHaveLength(2);
    });
});
