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

type WorkspaceState = ReturnType<typeof import('@/core/store').useStore.getState>;

function isCurrentBoardroom(state: WorkspaceState, context?: AgentContext): boolean {
    return state.conversationMode === 'boardroom' && !context?.signal?.aborted &&
        context?.projectId === state.currentProjectId &&
        (context?.sessionId ?? null) === (state.activeSessionId ?? null);
}

function isCurrentConductorMission(state: WorkspaceState, context?: AgentContext): boolean {
    const mission = context?.boardroomExecution;
    return !context?.isReadOnly && isCurrentBoardroom(state, context) &&
        mission?.ownerAgentId === 'generalist' &&
        state.agentHistory.some(message => message.id === mission.requestId);
}

const publicBrowserUrl = z.string().max(512).refine(value => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.search && !url.hash;
});

function isGoogleFontsPage(url: URL): boolean {
    return url.hostname === 'fonts.google.com' &&
        (url.pathname === '/' || /^\/specimen\/[a-zA-Z0-9+%-]+\/?$/.test(url.pathname));
}

function artistRequestedBrowserUrl(url: URL, request: string): boolean {
    if (isGoogleFontsPage(url) && /\bgoogle\s+fonts\b/i.test(request)) return true;
    const addresses: readonly string[] = request.match(/https:\/\/[^\s<>"'\x60]+/gi) ?? [];
    return addresses.some(candidate => {
        const address = candidate.replace(/[.,;!?)]+$/, '');
        return URL.canParse(address) && new URL(address).href === url.href;
    });
}

export const NavigationTools = {
    open_boardroom_workspace_tab: wrapTool('open_boardroom_workspace_tab', async (args: {
        tab: string;
        studioModule?: string;
        browserUrl?: string;
        workbenchAssetId?: string;
    }, context) => {
        const tab = workspaceTabSchema.safeParse(args.tab);
        if (!tab.success) return toolError('Choose one of the four Boardroom workspace tabs.', 'INVALID_WORKSPACE_TAB');

        const preview = PREVIEW_MODULES.find(module => module.id === args.studioModule);
        if (args.studioModule !== undefined && (tab.data !== 'module' || !preview)) {
            return toolError('Choose a supported module for Studio Preview.', 'BOARDROOM_PREVIEW_UNAVAILABLE');
        }

        const url = args.browserUrl === undefined ? undefined : publicBrowserUrl.safeParse(args.browserUrl);
        if (url && (tab.data !== 'browser' || !url.success)) {
            return toolError('Use a plain HTTPS address in Live Browser.', 'INVALID_BOARDROOM_BROWSER_URL');
        }
        if (args.workbenchAssetId !== undefined && (typeof args.workbenchAssetId !== 'string' || tab.data !== 'workbench')) {
            return toolError('Choose an existing gallery asset for the Asset Workbench tab.', 'INVALID_WORKBENCH_ASSET');
        }

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        if (!isCurrentConductorMission(state, context)) {
            return toolError('An active Conductor action in this Boardroom is required.', 'BOARDROOM_MISSION_INACTIVE');
        }

        const asset = args.workbenchAssetId === undefined ? undefined : state.generatedHistory.find(
            item => item.id === args.workbenchAssetId && item.projectId === state.currentProjectId,
        );
        if (args.workbenchAssetId !== undefined && !asset) {
            return toolError('That asset was not found in this project’s gallery.', 'INVALID_WORKBENCH_ASSET');
        }

        if (url?.success) {
            const page = new URL(url.data);
            const browser = window.electronAPI?.boardroomBrowser;
            if (!artistRequestedBrowserUrl(page, context?.boardroomTask?.rawUserUtterance ?? '')) {
                return toolError('Ask explicitly for Google Fonts or provide the exact HTTPS address to open.', 'BOARDROOM_BROWSER_REQUEST_REQUIRED');
            }
            if (!browser && !isGoogleFontsPage(page)) {
                return toolError('Use Live Browser’s address bar for this site, or open it from desktop Studio.', 'BOARDROOM_BROWSER_DESKTOP_REQUIRED');
            }

            if (browser) {
                const receipt = await browser.navigate(page.href);
                const current = useStore.getState();
                if (!isCurrentConductorMission(current, context) || current.boardroomWorkspaceTab !== state.boardroomWorkspaceTab
                    || current.boardroomWorkspaceLayout !== state.boardroomWorkspaceLayout) {
                    return toolError('The Boardroom changed while opening the page.', 'BOARDROOM_MISSION_INACTIVE');
                }
                if (!receipt.success) return toolError('Live Browser could not open the requested page.', 'NAVIGATION_NOT_COMPLETED');
                current.openBoardroomBrowser(receipt.url ?? page.href);
                return toolSuccess({ tab: 'browser', pageLoaded: true }, 'Opened the requested page in Live Browser.');
            }
            state.openBoardroomBrowser(page.href);
            return toolSuccess({ tab: 'browser', pageLoaded: false, requiresExternalOpen: true },
                'Google Fonts is ready in Live Browser. Choose Open in browser to view the catalog.');
        }

        if (asset) state.openBoardroomWorkbench({ kind: 'asset', itemId: asset.id });
        else if (preview) state.openBoardroomModulePreview(preview.id);
        else state.setBoardroomWorkspaceTab(tab.data);
        const current = useStore.getState();
        if (current.boardroomWorkspaceTab !== tab.data || current.boardroomWorkspaceLayout === 'closed'
            || (preview && current.boardroomPreviewModuleId !== preview.id)
            || (asset && (current.boardroomWorkbenchTarget?.kind !== 'asset' || current.boardroomWorkbenchTarget.itemId !== asset.id))) {
            return toolError('The workspace tab did not open.', 'NAVIGATION_NOT_COMPLETED');
        }
        return toolSuccess({
            tab: tab.data,
            layout: current.boardroomWorkspaceLayout,
            ...(preview ? { studioModule: preview.id } : {}),
            ...(asset ? { workbenchAssetId: asset.id } : {}),
        }, preview ? `Opened ${preview.id} in Studio Preview.` : `Opened ${workspaceTabs[tab.data]}.`);
    }),

    get_boardroom_workspace_status: wrapTool('get_boardroom_workspace_status', async (_args, context) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        if (context?.conversationMode !== 'boardroom' || !isCurrentBoardroom(state, context)) {
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
            handoffCount: state.a2aMessages.length,
            workflowStatuses: Object.values(state.activeGraphExecution?.nodeStates ?? {})
                .slice(0, 20).map(node => node.status),
        }, boardroomWorkspaceLayout === 'closed'
            ? 'The Boardroom workspace pane is closed.'
            : `${workspaceTabs[boardroomWorkspaceTab]} is the active Boardroom tab.`);
    }),


    download_boardroom_font: wrapTool('download_boardroom_font', async (args: { family: string }, context) => {
        const [{ useStore }, fonts, { downloadBlob }] = await Promise.all([
            importWithRetry(() => import('@/core/store')),
            importWithRetry(() => import('@/services/canvas/BundledArtworkFonts')),
            importWithRetry(() => import('@/utils/download')),
        ]);
        if (!isCurrentConductorMission(useStore.getState(), context)) {
            return toolError('An active Conductor action in this Boardroom is required.', 'BOARDROOM_MISSION_INACTIVE');
        }

        const font = typeof args.family === 'string' && fonts.BUNDLED_ARTWORK_FONTS.find(
            candidate => candidate.family.toLowerCase() === args.family.trim().toLowerCase(),
        );
        if (!font) {
            return toolError('Choose Montserrat, Archivo Black, or Space Mono from indii’s bundled fonts.', 'BOARDROOM_FONT_UNAVAILABLE');
        }
        const { filename, bytes } = await fonts.buildBundledArtworkFontArchive(font);
        if (!isCurrentConductorMission(useStore.getState(), context)) {
            return toolError('The Boardroom changed before the download was requested.', 'BOARDROOM_MISSION_INACTIVE');
        }

        await downloadBlob(new Blob([bytes], { type: 'application/zip' }), filename);
        return toolSuccess({ filename, family: font.family, downloadRequested: true, saved: null },
            `Requested ${filename}, containing the bundled WOFF2 font and its license. Check downloads for completion.`);
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
