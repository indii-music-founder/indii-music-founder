import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
    currentModule: 'dashboard',
    currentProjectId: 'project-1',
    activeSessionId: 'session-1',
    a2aMessages: [],
    activeGraphExecution: { nodeStates: { step: { status: 'STEP_COMPLETE' } } },
    generatedHistory: [{ id: 'asset-1', projectId: 'project-1' }, { id: 'asset-2', projectId: 'other' }],
    openBoardroomBrowser: vi.fn(),
    openBoardroomWorkbench: vi.fn(),
    agentHistory: [{ id: 'mission', agentId: 'generalist', metadata: {
        boardroomStepId: 'step', boardroomStepStatus: 'complete', boardroomStepTask: 'private content',
    } }],
    boardroomWorkspaceTab: 'browser',
    boardroomWorkspaceLayout: 'closed',
    boardroomPreviewModuleId: 'creative',
    boardroomWorkbenchTarget: { kind: 'asset', itemId: 'private-asset' },
    setBoardroomWorkspaceTab: vi.fn(),
    conversationMode: 'direct',
    openBoardroomModulePreview: vi.fn(),
    setModule: vi.fn(),
    setRegistrationFocus: vi.fn(),
    setRegistrationIntelligenceMessage: vi.fn(),
}));
vi.mock('@/core/store', () => ({ useStore: { getState: () => state } }));

import { NavigationTools } from '../NavigationTools';

describe('NavigationTools navigation outcome', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.currentModule = 'dashboard';
        state.conversationMode = 'direct';
        state.boardroomWorkspaceLayout = 'closed';
        state.boardroomWorkspaceTab = 'browser';
        state.setBoardroomWorkspaceTab.mockImplementation((tab: string) => {
            state.boardroomWorkspaceTab = tab;
            state.boardroomWorkspaceLayout = 'split';
        });
        state.setModule.mockImplementation(async (module: string) => { state.currentModule = module; });
    });

    it('switch_module reports success only after the module changed', async () => {
        const result = await (NavigationTools.switch_module as (a: unknown) => Promise<any>)({ module: 'creative' });
        expect(result.success).toBe(true);
        expect(state.currentModule).toBe('creative');
    });

    it('switch_module does not claim navigation when the switch is declined', async () => {
        state.setModule.mockImplementation(async () => undefined);
        const result = await (NavigationTools.switch_module as (a: unknown) => Promise<any>)({ module: 'creative' });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('NAVIGATION_NOT_COMPLETED');
        expect(result.message).toContain('still on dashboard');
    });

    it('opens an assigned mission module inside the Boardroom', async () => {
        state.conversationMode = 'boardroom';
        const result = await NavigationTools.switch_module({ module: 'creative' }, {
            boardroomExecution: { requestId: 'mission', stepId: 'step', ownerAgentId: 'creative' },
        });
        expect(result.success).toBe(true);
        expect(state.openBoardroomModulePreview).toHaveBeenCalledWith('creative');
        expect(state.setModule).not.toHaveBeenCalled();
    });

    it('refuses a delayed mission action once the artist leaves the Boardroom', async () => {
        const result = await NavigationTools.switch_module({ module: 'creative' }, {
            boardroomExecution: { requestId: 'mission', stepId: 'step', ownerAgentId: 'creative' },
        });
        expect(result.metadata?.errorCode).toBe('BOARDROOM_MISSION_INACTIVE');
        expect(state.openBoardroomModulePreview).not.toHaveBeenCalled();
        expect(state.setModule).not.toHaveBeenCalled();
    });

    it('navigate_to does not set registration focus or claim success when the switch is declined', async () => {
        state.setModule.mockImplementation(async () => undefined);
        const result = await (NavigationTools.navigate_to as (a: unknown) => Promise<any>)({ module: 'registration', orgId: 'ascap' });
        expect(result.success).toBe(false);
        expect(state.setRegistrationFocus).not.toHaveBeenCalled();
    });

    it('navigate_to applies the registration focus once the switch completed', async () => {
        const result = await (NavigationTools.navigate_to as (a: unknown) => Promise<any>)({ module: 'registration', orgId: 'ascap' });
        expect(result.success).toBe(true);
        expect(state.setRegistrationFocus).toHaveBeenCalledWith({ orgId: 'ascap', trackId: null });
    });
});

describe('Boardroom workspace tools (structural only)', () => {
    const context = {
        conversationMode: 'boardroom',
        projectId: 'project-1',
        sessionId: 'session-1',
        boardroomExecution: { requestId: 'mission', stepId: 'step', ownerAgentId: 'generalist' },
    } as const;

    beforeEach(() => {
        vi.clearAllMocks();
        state.conversationMode = 'boardroom';
        state.boardroomWorkspaceLayout = 'closed';
        state.boardroomWorkspaceTab = 'browser';
        state.setBoardroomWorkspaceTab.mockImplementation((tab: string) => {
            state.boardroomWorkspaceTab = tab;
            state.boardroomWorkspaceLayout = 'split';
        });
    });

    it.each(['browser', 'module', 'workbench', 'agent-feed'])('opens the shared %s tab', async tab => {
        const result = await NavigationTools.open_boardroom_workspace_tab({ tab }, context);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ tab, layout: 'split' });
    });

    it('opens a requested Studio Preview module without leaving Boardroom', async () => {
        state.openBoardroomModulePreview.mockImplementationOnce((module: string) => {
            state.boardroomPreviewModuleId = module;
            state.boardroomWorkspaceTab = 'module';
            state.boardroomWorkspaceLayout = 'split';
        });
        const result = await NavigationTools.open_boardroom_workspace_tab({ tab: 'module', studioModule: 'creative' }, context);
        expect(result.data).toEqual({ tab: 'module', layout: 'split', studioModule: 'creative' });
        expect(state.openBoardroomModulePreview).toHaveBeenCalledWith('creative');
        expect(state.setModule).not.toHaveBeenCalled();
    });

    it('declines a read-only turn, a switched session, and arbitrary tab values', async () => {
        for (const request of [
            NavigationTools.open_boardroom_workspace_tab({ tab: 'agent-feed' }, { ...context, isReadOnly: true }),
            NavigationTools.open_boardroom_workspace_tab({ tab: 'agent-feed' }, { ...context, sessionId: 'other' }),
            NavigationTools.open_boardroom_workspace_tab({ tab: 'https://example.com' }, context),
        ]) {
            expect((await request).success).toBe(false);
        }
        expect(state.setBoardroomWorkspaceTab).not.toHaveBeenCalled();
    });

    it('opens the public font catalog without claiming that web embedded it', async () => {
        const result = await NavigationTools.open_boardroom_workspace_tab({
            tab: 'browser', browserUrl: 'https://fonts.google.com/',
        }, { ...context, boardroomTask: { rawUserUtterance: 'Open Google Fonts in Live Browser' } });
        expect(state.openBoardroomBrowser).toHaveBeenCalledWith('https://fonts.google.com/');
        expect(result.data).toEqual({ tab: 'browser', pageLoaded: false, requiresExternalOpen: true });
    });

    it('ignores browser destinations that came from somewhere other than the artist’s request', async () => {
        const result = await NavigationTools.open_boardroom_workspace_tab({
            tab: 'browser', browserUrl: 'https://fonts.google.com/',
        }, { ...context, boardroomTask: { rawUserUtterance: 'What is active?' } });
        expect(result.success).toBe(false);
        expect(state.openBoardroomBrowser).not.toHaveBeenCalled();
    });

    it('selects a current project gallery asset and refuses one from a different project', async () => {
        state.openBoardroomWorkbench.mockImplementationOnce(target => {
            state.boardroomWorkbenchTarget = target;
            state.boardroomWorkspaceTab = 'workbench';
            state.boardroomWorkspaceLayout = 'split';
        });
        const result = await NavigationTools.open_boardroom_workspace_tab({
            tab: 'workbench', workbenchAssetId: 'asset-1',
        }, context);
        expect(result.data).toEqual({ tab: 'workbench', layout: 'split', workbenchAssetId: 'asset-1' });
        const otherProject = await NavigationTools.open_boardroom_workspace_tab({
            tab: 'workbench', workbenchAssetId: 'asset-2',
        }, context);
        expect(otherProject.success).toBe(false);
        expect(state.openBoardroomWorkbench).toHaveBeenCalledTimes(1);
    });

    it('reports status without returning the mission text or asset ID', async () => {
        const result = await NavigationTools.get_boardroom_workspace_status({}, { ...context, isReadOnly: true });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            tab: 'browser',
            layout: 'closed',
            studioModule: 'creative',
            workbenchSelectionKind: 'asset',
            handoffCount: 0,
            workflowStatuses: ['STEP_COMPLETE'],
            missionActivity: [{ agentId: 'generalist', status: 'complete' }],
        });
    });
});
