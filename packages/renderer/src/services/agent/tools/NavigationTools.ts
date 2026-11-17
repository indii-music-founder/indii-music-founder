import type { AppSlice } from '@/core/store/slices/appSlice';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { navigateToModule, navigationNotCompletedMessage } from './navigationOutcome';
import type { AnyToolFunction } from '../types';
import type { OrgId } from '@/modules/registration/types';
import { importWithRetry } from '@/utils/dynamicImport';

export const NavigationTools = {
    switch_module: wrapTool('switch_module', async (args: { module: AppSlice['currentModule'] }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        if (!await navigateToModule(useStore, args.module)) {
            return toolError(navigationNotCompletedMessage(args.module, useStore.getState().currentModule), 'NAVIGATION_NOT_COMPLETED');
        }
        return toolSuccess({ module: args.module }, `Navigated to module: ${args.module}`);
    }),

    /**
     * Deep-link navigation — switches module AND optionally focuses a specific
     * panel, tab, track, or org within that module. Used by registration intents.
     */
    navigate_to: wrapTool('navigate_to', async (args: {
        module: AppSlice['currentModule'];
        orgId?: OrgId;
        trackId?: string;
        tab?: string;
    }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();

        // Switch module first, and only continue (and claim success) if it happened.
        if (!await navigateToModule(useStore, args.module)) {
            return toolError(navigationNotCompletedMessage(args.module, useStore.getState().currentModule), 'NAVIGATION_NOT_COMPLETED');
        }

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
            `Navigated to ${args.module}${args.orgId ? ` › ${args.orgId.toUpperCase()}` : ''}${args.trackId ? ` for track ${args.trackId}` : ''}`
        );
    })
} satisfies Record<string, AnyToolFunction>;
