import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';
import { AspectRatioSchema } from '@/modules/creative/video/schemas';
import type {
    BoardroomControlSurface,
    BoardroomWorkbenchTarget,
    BoardroomWorkspaceTab,
} from '@/core/store/slices/boardroomSlice';
import { PREVIEW_MODULES } from '@/modules/boardroom/components/boardroomPreviewModules';

export type BoardroomWorkspaceTargetKind = 'browser' | 'studio' | 'workbench' | 'feed';

export interface BoardroomWorkspaceAction {
    missionId: string;
    stepId: string;
    agentId: string;
    target: BoardroomWorkspaceTargetKind;
    operation: string;
    payload?: Record<string, unknown>;
    expectedRevision?: number;
}

export interface BoardroomWorkspaceResult {
    ok: boolean;
    observed: string;
    error?: string;
    revision?: number;
}

const VALID_TABS: readonly BoardroomWorkspaceTab[] = ['browser', 'module', 'workbench', 'agent-feed'];

function mapTargetToControlSurface(target: BoardroomWorkspaceTargetKind): BoardroomControlSurface | null {
    switch (target) {
        case 'browser':
            return 'browser';
        case 'studio':
            return 'studio';
        case 'workbench':
            return 'workbench';
        default:
            return null;
    }
}

function resolveStudioModule(payload?: Record<string, unknown>): ModuleId | undefined {
    const candidate = typeof payload?.moduleId === 'string'
        ? payload.moduleId
        : typeof payload?.studioModule === 'string'
            ? payload.studioModule
            : undefined;
    if (!candidate) return undefined;
    const match = PREVIEW_MODULES.find(item => item.id === candidate);
    return match ? match.id : undefined;
}

function buildWorkbenchTarget(action: BoardroomWorkspaceAction): BoardroomWorkbenchTarget | undefined {
    const payload = action.payload;
    if (payload && 'target' in payload && payload.target !== undefined) {
        return payload.target as BoardroomWorkbenchTarget;
    }
    if (action.operation === 'open_split_sheet') {
        return {
            kind: 'split-sheet',
            ...(typeof payload?.itemId === 'string' ? { itemId: payload.itemId } : {}),
            ...(typeof payload?.title === 'string' ? { title: payload.title } : {}),
        };
    }
    if (typeof payload?.itemId === 'string') {
        return { kind: 'asset', itemId: payload.itemId };
    }
    if (typeof payload?.filename === 'string') {
        return { kind: 'artifact', filename: payload.filename };
    }
    if (typeof payload?.panelId === 'string') {
        return { kind: 'canvas', panelId: payload.panelId };
    }
    return undefined;
}

/**
 * Executes a typed workspace UI action requested by an agent/tool and verifies
 * post-dispatch store state so callers never assume an unopened tab succeeded.
 */
export async function executeWorkspaceAction(
    action: BoardroomWorkspaceAction,
): Promise<BoardroomWorkspaceResult> {
    const state = useStore.getState();
    const control = state.boardroomControl;

    if (
        typeof action.expectedRevision === 'number' &&
        control &&
        action.expectedRevision !== control.revision
    ) {
        return {
            ok: false,
            observed: `control_revision_${control.revision}_holder_${control.holder}`,
            error: 'Control changed before this action could run.',
            revision: control.revision,
        };
    }

    const layout = action.payload?.layout === 'split' || action.payload?.layout === 'stage'
        ? action.payload.layout
        : undefined;
    const surface = mapTargetToControlSurface(action.target);

    switch (action.target) {
        case 'browser': {
            const url = typeof action.payload?.url === 'string' ? action.payload.url : undefined;
            if (url !== undefined || layout !== undefined) {
                if (layout !== undefined) {
                    state.openBoardroomBrowser?.(url, layout);
                } else {
                    state.openBoardroomBrowser?.(url);
                }
            } else {
                state.setBoardroomWorkspaceTab?.('browser');
            }
            const current = useStore.getState();
            const hasWorkspaceState =
                typeof current.boardroomWorkspaceTab === 'string' &&
                typeof current.boardroomWorkspaceLayout === 'string';
            if (hasWorkspaceState && (current.boardroomWorkspaceTab !== 'browser' || current.boardroomWorkspaceLayout === 'closed')) {
                return {
                    ok: false,
                    observed: `tab:${current.boardroomWorkspaceTab},layout:${current.boardroomWorkspaceLayout}`,
                    error: 'Live Browser did not open.',
                    revision: current.boardroomControl?.revision,
                };
            }
            if (surface && current.grantBoardroomControl && action.agentId && current.boardroomControl?.holder !== action.agentId) {
                current.grantBoardroomControl(surface, action.agentId, `${action.missionId}:${action.stepId}`);
            }
            return {
                ok: true,
                observed: url ? `browser:${url}` : 'browser',
                revision: useStore.getState().boardroomControl?.revision,
            };
        }

        case 'studio': {
            const payload = action.payload ?? {};
            const moduleId = resolveStudioModule(payload) ?? (action.operation === 'open_image_studio' ? 'creative' : undefined);

            const parsedAspectRatio = typeof payload.aspectRatio === 'string'
                ? AspectRatioSchema.safeParse(payload.aspectRatio)
                : null;
            if (action.operation === 'set_prompt' || action.operation === 'open_image_studio') {
                const promptText = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
                if (promptText) {
                    state.setCreativePrompt?.(promptText);
                }
            }
            if (
                parsedAspectRatio?.success &&
                (action.operation === 'set_prompt' ||
                    action.operation === 'open_image_studio' ||
                    action.operation === 'set_aspect_ratio')
            ) {
                state.setStudioControls?.({
                    ...(state.studioControls ?? {}),
                    aspectRatio: parsedAspectRatio.data,
                });
            }

            if (action.operation === 'open_image_studio') {
                state.setGenerationMode?.('image');
                state.setViewMode?.('canvas');
            }

            if (moduleId) {
                if (layout !== undefined) {
                    state.openBoardroomModulePreview?.(moduleId, layout);
                } else {
                    state.openBoardroomModulePreview?.(moduleId);
                }
            } else if (action.operation === 'open') {
                state.setBoardroomWorkspaceTab?.('module');
            } else if (!['set_prompt', 'set_aspect_ratio'].includes(action.operation)) {
                return {
                    ok: false,
                    observed: 'unsupported_studio_operation',
                    error: `Unsupported studio operation: ${action.operation}`,
                    revision: state.boardroomControl?.revision,
                };
            }

            const current = useStore.getState();
            const hasWorkspaceState =
                typeof current.boardroomWorkspaceTab === 'string' &&
                typeof current.boardroomWorkspaceLayout === 'string';
            if (
                hasWorkspaceState &&
                (moduleId || action.operation === 'open' || action.operation === 'open_image_studio') &&
                (current.boardroomWorkspaceTab !== 'module' ||
                    current.boardroomWorkspaceLayout === 'closed' ||
                    (moduleId && current.boardroomPreviewModuleId !== moduleId))
            ) {
                return {
                    ok: false,
                    observed: `tab:${current.boardroomWorkspaceTab},module:${current.boardroomPreviewModuleId}`,
                    error: 'Studio Preview did not open the requested module.',
                    revision: current.boardroomControl?.revision,
                };
            }
            if (surface && current.grantBoardroomControl && action.agentId && current.boardroomControl?.holder !== action.agentId) {
                current.grantBoardroomControl(surface, action.agentId, `${action.missionId}:${action.stepId}`);
            }
            return {
                ok: true,
                observed: moduleId ? `studio:${moduleId}` : `studio:${action.operation}`,
                revision: useStore.getState().boardroomControl?.revision,
            };
        }

        case 'workbench': {
            const target = buildWorkbenchTarget(action);
            if (target !== undefined) {
                if (layout !== undefined) {
                    state.openBoardroomWorkbench?.(target, layout);
                } else {
                    state.openBoardroomWorkbench?.(target);
                }
            } else {
                state.setBoardroomWorkspaceTab?.('workbench');
            }
            const current = useStore.getState();
            const hasWorkspaceState =
                typeof current.boardroomWorkspaceTab === 'string' &&
                typeof current.boardroomWorkspaceLayout === 'string';
            const targetMatches =
                target === undefined ||
                (current.boardroomWorkbenchTarget?.kind === target?.kind &&
                    (target?.kind !== 'asset' ||
                        (current.boardroomWorkbenchTarget?.kind === 'asset' &&
                            current.boardroomWorkbenchTarget.itemId === target.itemId)) &&
                    (target?.kind !== 'artifact' ||
                        (current.boardroomWorkbenchTarget?.kind === 'artifact' &&
                            current.boardroomWorkbenchTarget.filename === target.filename)) &&
                    (target?.kind !== 'canvas' ||
                        (current.boardroomWorkbenchTarget?.kind === 'canvas' &&
                            current.boardroomWorkbenchTarget.panelId === target.panelId)) &&
                    (target?.kind !== 'split-sheet' ||
                        (current.boardroomWorkbenchTarget?.kind === 'split-sheet' &&
                            current.boardroomWorkbenchTarget.itemId === target.itemId &&
                            current.boardroomWorkbenchTarget.title === target.title)));

            if (
                hasWorkspaceState &&
                (current.boardroomWorkspaceTab !== 'workbench' ||
                    current.boardroomWorkspaceLayout === 'closed' ||
                    !targetMatches)
            ) {
                return {
                    ok: false,
                    observed: `tab:${current.boardroomWorkspaceTab},layout:${current.boardroomWorkspaceLayout},target:${current.boardroomWorkbenchTarget?.kind ?? 'none'}`,
                    error: 'Workbench did not open the requested target.',
                    revision: current.boardroomControl?.revision,
                };
            }
            if (surface && current.grantBoardroomControl && action.agentId && current.boardroomControl?.holder !== action.agentId) {
                current.grantBoardroomControl(surface, action.agentId, `${action.missionId}:${action.stepId}`);
            }
            return {
                ok: true,
                observed: target ? `workbench:${target.kind}` : 'workbench',
                revision: useStore.getState().boardroomControl?.revision,
            };
        }

        case 'feed': {
            if (layout !== undefined) {
                state.openBoardroomAgentFeed?.(layout);
            } else {
                state.setBoardroomWorkspaceTab?.('agent-feed');
            }
            const current = useStore.getState();
            const hasWorkspaceState =
                typeof current.boardroomWorkspaceTab === 'string' &&
                typeof current.boardroomWorkspaceLayout === 'string';
            if (
                hasWorkspaceState &&
                (current.boardroomWorkspaceTab !== 'agent-feed' || current.boardroomWorkspaceLayout === 'closed')
            ) {
                return {
                    ok: false,
                    observed: `tab:${current.boardroomWorkspaceTab},layout:${current.boardroomWorkspaceLayout}`,
                    error: 'Agent Live Feed did not open.',
                    revision: current.boardroomControl?.revision,
                };
            }
            return {
                ok: true,
                observed: 'agent-feed',
                revision: current.boardroomControl?.revision,
            };
        }

        default: {
            const unknownTarget: string = action.target;
            const validList = VALID_TABS.join(', ');
            return {
                ok: false,
                observed: `unsupported_target:${unknownTarget}`,
                error: `Unsupported workspace target "${unknownTarget}". Expected one of ${validList}.`,
                revision: state.boardroomControl?.revision,
            };
        }
    }
}
