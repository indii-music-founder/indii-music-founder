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
import { CreativeHistorySlice, buildCreativeHistoryState } from './creativeHistorySlice';
import { CreativeControlsSlice, buildCreativeControlsState } from './creativeControlsSlice';

// Combined interface for the root store
export interface CreativeSlice extends CreativeHistorySlice, CreativeControlsSlice {}

// Type re-exports for backward compatibility
export type { HistoryItem };
export type { CanvasImage } from './creativeHistorySlice';
export type { ShotItem, WhiskCategory, TargetMedia, WhiskItem, WhiskState, SavedPrompt } from './creativeControlsSlice';

/**
 * Composed StateCreator that merges both creative sub-slices.
 * This is the single entry point consumed by the root store.
 */
export const createCreativeSlice: StateCreator<CreativeSlice> = (set, get, store) => {
    const historyState = buildCreativeHistoryState(set, get);
    const controlsState = buildCreativeControlsState(set, get);

    return {
        ...historyState,
        ...controlsState,
    };
};
