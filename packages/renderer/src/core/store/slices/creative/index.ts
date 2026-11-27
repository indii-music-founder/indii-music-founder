/**
 * Creative Slice — Barrel Export
 *
 * Decomposes the original monolithic creativeSlice.ts (501L) into 2 sub-modules:
 *
 * - creativeHistorySlice: History items, canvas images, uploads (Firestore persistence)
 * - creativeControlsSlice: Studio controls, video inputs, character refs, whisk, prompts
 *
 * Consumers continue to import from `@/core/store` as before — no changes needed.
 */

import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';

// Sub-module imports
import { CreativeHistorySlice, buildCreativeHistoryState } from '@/core/store/slices/creative/creativeHistorySlice';
import { CreativeControlsSlice, buildCreativeControlsState } from '@/core/store/slices/creative/creativeControlsSlice';
import { DesignHistorySlice, buildDesignHistoryState } from '@/core/store/slices/creative/designHistorySlice';
import { CreativeHandoffSlice, buildCreativeHandoffState } from '@/core/store/slices/creative/creativeHandoffSlice';

// Combined interface for the root store
export interface CreativeSlice extends CreativeHistorySlice, CreativeControlsSlice, DesignHistorySlice, CreativeHandoffSlice {}

// Type re-exports for backward compatibility
export type { HistoryItem };
export type { CanvasImage } from '@/core/store/slices/creative/creativeHistorySlice';
export type { ShotItem, WhiskCategory, TargetMedia, WhiskItem, WhiskState, SavedPrompt } from '@/core/store/slices/creative/creativeControlsSlice';
export type { DesignVersion } from '@/core/store/slices/creative/designHistorySlice';
export type { CreativeStage, HandoffRole, StageHandoffPayload } from '@/types/handoff';

import type { StoreState } from '@/core/store/types';

/**
 * Composed StateCreator that merges all creative sub-slices.
 * This is the single entry point consumed by the root store.
 */
export const createCreativeSlice: StateCreator<StoreState, [], [], CreativeSlice> = (set, get) => {
    const historyState = buildCreativeHistoryState(set, get);
    const controlsState = buildCreativeControlsState(set, get);
    const designHistoryState = buildDesignHistoryState(set, get);
    const handoffState = buildCreativeHandoffState(set, get);

    return {
        ...historyState,
        ...controlsState,
        ...designHistoryState,
        ...handoffState,
    };
};
