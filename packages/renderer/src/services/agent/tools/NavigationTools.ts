import type { AppSlice } from '@/core/store/slices/appSlice';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { navigateToModule, navigationNotCompletedMessage } from './navigationOutcome';
import type { AgentContext, AnyToolFunction } from '../types';
import type { OrgId } from '@/modules/registration/types';
import { importWithRetry } from '@/utils/dynamicImport';
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

export const NavigationTools = {
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
