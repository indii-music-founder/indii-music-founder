/**
 * App-wide stacking scale for full-screen surfaces.
 *
 * The Boardroom is a full-screen portal at `boardroom`. Anything that must be
 * usable while it is open (cost approvals, toasts, tooltips) has to sit above
 * it, or the user cannot see it and awaited flows hang (ISSUE-1625).
 * Tailwind needs literal class names, so each layer is a full class string.
 */
export const Z_LAYER = {
    /** Full-screen Boardroom portal. */
    boardroom: 'z-[99999]',
    /** Sheets and drawers opened from inside the Boardroom; ConfirmDialog overlay. */
    sheet: 'z-[100000]',
    /** Blocking modals that gate an awaited flow (cost warning, agent approval). */
    modal: 'z-[100010]',
    /** Toast notifications. Above menus so feedback is never hidden. */
    toast: 'z-[100025]',
    /** Tooltips (see components/ui/tooltip.tsx). */
    tooltip: 'z-[100030]',
} as const;

export type ZLayer = keyof typeof Z_LAYER;

/** Numeric value of a layer, for ordering checks. */
export function zLayerValue(layer: ZLayer): number {
    return Number(Z_LAYER[layer].match(/\d+/)?.[0] ?? 0);
}
