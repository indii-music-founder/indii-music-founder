import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: Record<string, any> = {};

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => state,
    },
}));

import { executeWorkspaceAction } from './boardroomWorkspaceActions';

describe('boardroomWorkspaceActions (WP8)', () => {
    beforeEach(() => {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, {
            boardroomWorkspaceLayout: 'closed',
            boardroomWorkspaceTab: 'browser',
            boardroomPreviewModuleId: 'creative',
            boardroomWorkbenchTarget: null,
            creativePrompt: '',
            studioControls: { aspectRatio: '1:1' },
            boardroomControlRevocation: 0,
            boardroomControl: {
                surface: 'browser',
                holder: 'artist',
                grantId: null,
                revision: 0,
            },
            setBoardroomWorkspaceTab: vi.fn((tab: string) => {
                state.boardroomWorkspaceTab = tab;
                if (state.boardroomWorkspaceLayout === 'closed') state.boardroomWorkspaceLayout = 'split';
            }),
            openBoardroomBrowser: vi.fn((url?: string, layout?: string) => {
                state.boardroomWorkspaceTab = 'browser';
                state.boardroomWorkspaceLayout = layout ?? 'split';
                if (url) state.boardroomBrowserUrl = url;
            }),
            openBoardroomModulePreview: vi.fn((moduleId: string, layout?: string) => {
                state.boardroomWorkspaceTab = 'module';
                state.boardroomWorkspaceLayout = layout ?? 'split';
                state.boardroomPreviewModuleId = moduleId;
            }),
            openBoardroomWorkbench: vi.fn((target: unknown, layout?: string) => {
                state.boardroomWorkspaceTab = 'workbench';
                state.boardroomWorkspaceLayout = layout ?? 'split';
                if (target !== undefined) state.boardroomWorkbenchTarget = target;
            }),
            openBoardroomAgentFeed: vi.fn((layout?: string) => {
                state.boardroomWorkspaceTab = 'agent-feed';
                state.boardroomWorkspaceLayout = layout ?? 'split';
            }),
            setCreativePrompt: vi.fn((prompt: string) => {
                state.creativePrompt = prompt;
            }),
            setStudioControls: vi.fn((controls: Record<string, unknown>) => {
                state.studioControls = controls;
            }),
            setGenerationMode: vi.fn(),
            setViewMode: vi.fn(),
            grantBoardroomControl: vi.fn((surface: string, holder: string, grantId: string) => {
                state.boardroomControl = {
                    surface,
                    holder,
                    grantId,
                    revision: state.boardroomControl.revision + 1,
                };
            }),
            takeBoardroomControl: vi.fn(() => {
                state.boardroomControl = {
                    ...state.boardroomControl,
                    holder: 'artist',
                    grantId: null,
                    revision: state.boardroomControl.revision + 1,
                };
            }),
        });
    });

    it('returns ok:false with an observed reason when the workspace tab fails to open', async () => {
        state.openBoardroomWorkbench.mockImplementation(() => {
            // Simulates a declined or no-op navigation leaving workspace closed
        });

        const result = await executeWorkspaceAction({
            missionId: 'm-1',
            stepId: 's-1',
            agentId: 'legal',
            target: 'workbench',
            operation: 'open_split_sheet',
            payload: { itemId: 'split-001', title: 'Track 1 Split Sheet' },
        });

        expect(result.ok).toBe(false);
        expect(result.observed).toContain('layout:closed');
        expect(result.error).toContain('Workbench');
    });

    it('rejects a stale-revision queued action after the artist takes control (Spec D2)', async () => {
        const expectedRevision = state.boardroomControl.revision;
        state.takeBoardroomControl('studio');

        const result = await executeWorkspaceAction({
            missionId: 'm-2',
            stepId: 's-2',
            agentId: 'creative',
            target: 'studio',
            operation: 'open_image_studio',
            payload: { moduleId: 'creative', prompt: 'Late prompt', aspectRatio: '16:9' },
            expectedRevision,
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('Control changed');
        expect(state.setCreativePrompt).not.toHaveBeenCalled();
        expect(state.openBoardroomModulePreview).not.toHaveBeenCalled();
    });

    it('executes typed Creative Studio controls and grants studio surface control', async () => {
        const result = await executeWorkspaceAction({
            missionId: 'm-3',
            stepId: 's-3',
            agentId: 'creative',
            target: 'studio',
            operation: 'open_image_studio',
            payload: { moduleId: 'creative', prompt: 'Warm editorial cover portrait', aspectRatio: '4:5' },
        });

        expect(result.ok).toBe(true);
        expect(result.observed).toBe('studio:creative');
        expect(state.creativePrompt).toBe('Warm editorial cover portrait');
        expect(state.studioControls.aspectRatio).toBe('4:5');
        expect(state.setGenerationMode).toHaveBeenCalledWith('image');
        expect(state.setViewMode).toHaveBeenCalledWith('canvas');
        expect(state.boardroomControl).toMatchObject({ surface: 'studio', holder: 'creative' });
    });

    it('opens a split-sheet target on Workbench and records verification', async () => {
        const result = await executeWorkspaceAction({
            missionId: 'm-4',
            stepId: 's-4',
            agentId: 'legal',
            target: 'workbench',
            operation: 'open_split_sheet',
            payload: { itemId: 'split-42', title: 'Producer Split 50/50', layout: 'split' },
        });

        expect(result.ok).toBe(true);
        expect(result.observed).toBe('workbench:split-sheet');
        expect(state.boardroomWorkbenchTarget).toEqual({
            kind: 'split-sheet',
            itemId: 'split-42',
            title: 'Producer Split 50/50',
        });
    });
});
