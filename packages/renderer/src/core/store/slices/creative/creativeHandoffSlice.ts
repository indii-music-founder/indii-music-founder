/**
 * Creative Cross-Stage Handoff Slice
 * Manages asset transfers between Image, Veo, Omni, and the timeline editor.
 * Enables round-tripping of assets without re-upload.
 */

import { StateCreator } from 'zustand';
import { StoreState } from '@/core/store';
import { CreativeStage, StageHandoffPayload, VALID_ASSET_TYPES } from '@/types/handoff';
import { logger } from '@/utils/logger';

export interface CreativeHandoffSlice {
    // Pending handoff for each stage (null = no pending handoff)
    pendingStageHandoff: Record<CreativeStage, StageHandoffPayload | null>;

    /**
     * Send an asset to a target stage.
     * Validates asset type matches the role, sets pending handoff, and navigates.
     */
    sendToStage: (target: CreativeStage, payload: StageHandoffPayload) => void;

    /**
     * Consume pending handoff for a stage (read-and-clear).
     * Called by the target stage component after consuming the asset.
     */
    consumeStageHandoff: (target: CreativeStage) => StageHandoffPayload | null;

    /**
     * Clear pending handoff for a stage (used for cleanup/cancellation).
     */
    clearStageHandoff: (target: CreativeStage) => void;
}

export function buildCreativeHandoffState(
    set: Parameters<StateCreator<StoreState, [], [], CreativeHandoffSlice>>[0],
    get: Parameters<StateCreator<StoreState, [], [], CreativeHandoffSlice>>[1]
): CreativeHandoffSlice {
    return {
    pendingStageHandoff: {
        image: null,
        veo: null,
        omni: null,
        editor: null,
    },

    sendToStage: (target: CreativeStage, payload: StageHandoffPayload) => {
        // Validate asset type is valid for this role
        const validTypes = VALID_ASSET_TYPES[payload.role];
        if (!validTypes.includes(payload.item.type as 'image' | 'video' | 'music' | 'text')) {
            logger.error(
                `[handoff] Invalid asset type "${payload.item.type}" for role "${payload.role}". Valid types: ${validTypes.join(', ')}`
            );
            return;
        }

        // Validate that storageUri exists (required for backend)
        if (!payload.item.storageUri) {
            logger.warn(
                `[handoff] Asset has no storageUri. Backend will not receive gs:// path for stage "${target}".`
            );
        }

        // Set pending handoff
        set((state) => ({
            pendingStageHandoff: {
                ...state.pendingStageHandoff,
                [target]: payload,
            },
        }));

        // Navigate to target stage within creative module (use setViewMode to switch stages)
        const viewModeMap: Record<CreativeStage, 'gallery' | 'video_production' | 'omni'> = {
            'image': 'gallery',
            'veo': 'video_production',
            'omni': 'omni',
            'editor': 'video_production',
        };

        const store = get();
        if (store.setViewMode) {
            store.setViewMode(viewModeMap[target]);
        }

        // Ensure we're in the creative module
        if (store.setModule && store.currentModule !== 'creative') {
            store.setModule('creative').catch((err: unknown) => {
                logger.error('[handoff] Failed to navigate to creative module:', err);
            });
        }
    },

    consumeStageHandoff: (target: CreativeStage) => {
        const state = get();
        const payload = state.pendingStageHandoff[target];

        if (payload) {
            // Clear the pending handoff after consuming
            set((s) => ({
                pendingStageHandoff: {
                    ...s.pendingStageHandoff,
                    [target]: null,
                },
            }));
        }

        return payload;
    },

    clearStageHandoff: (target: CreativeStage) => {
        set((state) => ({
            pendingStageHandoff: {
                ...state.pendingStageHandoff,
                [target]: null,
            },
        }));
    },
    };
}
