import type { BoardroomWorkspaceTab } from '@/core/store/slices/boardroomSlice';
import type { AppSlice } from '@/core/store/slices/appSlice';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { navigateToModule, navigationNotCompletedMessage } from './navigationOutcome';
import type { AgentContext, AnyToolFunction } from '../types';
import type { OrgId } from '@/modules/registration/types';
import { importWithRetry } from '@/utils/dynamicImport';
import { z } from 'zod';
import { PREVIEW_MODULES } from '@/modules/boardroom/components/boardroomPreviewModules';

async function navigateForAgent(module: AppSlice['currentModule'], context?: AgentContext) {
    const { useStore } = await importWithRetry(() => import('@/core/store'));
    if (context?.boardroomExecution) {
        const store = useStore.getState();
        if (context.signal?.aborted || store.conversationMode !== 'boardroom') {
            return toolError('The Boardroom mission is no longer active.', 'BOARDROOM_MISSION_INACTIVE');
        }
        if (!PREVIEW_MODULES.some(preview => preview.id === module)) {
            return toolError('This module is unavailable in Studio Preview.', 'BOARDROOM_PREVIEW_UNAVAILABLE');
        }
        store.openBoardroomModulePreview(module);
        return toolSuccess({ module, surface: 'boardroom' }, `Opened ${module} in Boardroom Studio Preview`);
    }

    if (!await navigateToModule(useStore, module)) {
        return toolError(navigationNotCompletedMessage(module, useStore.getState().currentModule), 'NAVIGATION_NOT_COMPLETED');
    }
    return toolSuccess({ module }, `Navigated to module: ${module}`);
}

const workspaceTabs = {
    browser: 'Live Browser',
    module: 'Studio Preview',
    workbench: 'Asset Workbench',
    'agent-feed': 'Agent Live Feed',
} satisfies Record<BoardroomWorkspaceTab, string>;

const workspaceTabSchema = z.enum(['browser', 'module', 'workbench', 'agent-feed']);

export const NavigationTools = {
    open_boardroom_workspace_tab: wrapTool('open_boardroom_workspace_tab', async (args: { tab: string; studioModule?: string }, context) => {
        const tab = workspaceTabSchema.safeParse(args.tab);
        if (!tab.success) return toolError('Choose one of the four Boardroom workspace tabs.', 'INVALID_WORKSPACE_TAB');

        const preview = PREVIEW_MODULES.find(module => module.id === args.studioModule);
        if (args.studioModule !== undefined && (tab.data !== 'module' || !preview)) {
            return toolError('Choose a supported module for Studio Preview.', 'BOARDROOM_PREVIEW_UNAVAILABLE');
        }

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        const mission = context?.boardroomExecution;
        if (context?.isReadOnly || context?.signal?.aborted || state.conversationMode !== 'boardroom'
            || !mission || mission.ownerAgentId !== 'generalist'
            || context.projectId !== state.currentProjectId
            || (context.sessionId ?? null) !== (state.activeSessionId ?? null)
            || !state.agentHistory.some(message => message.id === mission.requestId)) {
            return toolError('An active Conductor action in this Boardroom is required.', 'BOARDROOM_MISSION_INACTIVE');
        }

        if (preview) state.openBoardroomModulePreview(preview.id);
        else state.setBoardroomWorkspaceTab(tab.data);
        const current = useStore.getState();
        if (current.boardroomWorkspaceTab !== tab.data || current.boardroomWorkspaceLayout === 'closed'
            || (preview && current.boardroomPreviewModuleId !== preview.id)) {
            return toolError('The workspace tab did not open.', 'NAVIGATION_NOT_COMPLETED');
        }
        return toolSuccess({
            tab: tab.data,
            layout: current.boardroomWorkspaceLayout,
            ...(preview ? { studioModule: preview.id } : {}),
        }, preview ? `Opened ${preview.id} in Studio Preview.` : `Opened ${workspaceTabs[tab.data]}.`);
    }),

    get_boardroom_workspace_status: wrapTool('get_boardroom_workspace_status', async (_args, context) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        if (context?.conversationMode !== 'boardroom' || context.signal?.aborted
            || state.conversationMode !== 'boardroom' || context.projectId !== state.currentProjectId
            || (context.sessionId ?? null) !== (state.activeSessionId ?? null)) {
            return toolError('The Boardroom workspace is unavailable for this request.', 'BOARDROOM_MISSION_INACTIVE');
        }

        const { boardroomWorkspaceTab, boardroomWorkspaceLayout } = state;
        const recentSteps = state.agentHistory.filter(message => message.metadata?.boardroomStepId).slice(-12);
        const missionActivity = recentSteps.flatMap(message => {
            const status = message.metadata?.boardroomStepStatus;
            return typeof status === 'string' ? [{ agentId: message.agentId, status }] : [];
        });
        return toolSuccess({
            tab: boardroomWorkspaceTab,
            layout: boardroomWorkspaceLayout,
            studioModule: state.boardroomPreviewModuleId,
            workbenchSelectionKind: state.boardroomWorkbenchTarget?.kind ?? null,
            missionActivity,
        }, boardroomWorkspaceLayout === 'closed'
            ? 'The Boardroom workspace pane is closed.'
            : `${workspaceTabs[boardroomWorkspaceTab]} is the active Boardroom tab.`);
    }),


    switch_module: wrapTool('switch_module', async (args: { module: AppSlice['currentModule'] }, context) =>
        navigateForAgent(args.module, context)),

    /**
     * Deep-link navigation — switches module AND optionally focuses a specific
     * panel, tab, track, or org within that module. Used by registration intents.
     */
    navigate_to: wrapTool('navigate_to', async (args: {
        module: AppSlice['currentModule'];
        orgId?: OrgId;
        trackId?: string;
        tab?: string;
    }, context) => {
        const outcome = await navigateForAgent(args.module, context);
        if (!outcome.success) return outcome;
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();

        // If navigating to registration, set the focus
        if (args.module === 'registration' && (args.orgId || args.trackId)) {
            store.setRegistrationFocus({
                orgId: args.orgId ?? null,
                trackId: args.trackId ?? null,
            });
            // Activate Autonomous co-pilot
            if (args.orgId) {
                store.setRegistrationIntelligenceMessage(
                    `Opening ${args.orgId.toUpperCase()} registration. Let me pre-fill what I already know about your catalog…`
                );
            }
        }

        return toolSuccess(
            { module: args.module, orgId: args.orgId ?? null, trackId: args.trackId ?? null },
            `${context?.boardroomExecution ? 'Opened in Boardroom Studio Preview' : 'Navigated to'} ${args.module}${args.orgId ? ` › ${args.orgId.toUpperCase()}` : ''}${args.trackId ? ` for track ${args.trackId}` : ''}`
        );
    })
} satisfies Record<string, AnyToolFunction>;
