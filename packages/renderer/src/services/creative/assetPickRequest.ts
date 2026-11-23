import { create } from 'zustand';

/**
 * ISSUE-1707: lets a dialog ask Project Assets for one image without the
 * artist having to drag it, and stops a click in Project Assets from
 * navigating to the Studio editor (and discarding a half-filled dialog).
 *
 * - `request`: while set, clicking a matching asset hands it to `onPick`.
 * - `guard`: while set (and no request is active), opening an asset in the
 *   Studio is refused with a message naming the open dialog.
 */
export interface AssetPickRequest {
    /** Plain-language use, e.g. "cover art". Shown in the Project Assets banner. */
    purpose: string;
    accept: 'image';
    onPick: (asset: { id: string; type: string; url: string; prompt?: string }) => void | Promise<void>;
}

interface AssetPickState {
    request: AssetPickRequest | null;
    /** Bumped on every setRequest, so a late callback can tell the dialog moved on. */
    requestVersion: number;
    guard: string | null;
    setRequest: (request: AssetPickRequest | null) => void;
    setGuard: (guard: string | null) => void;
}

export const useAssetPickRequest = create<AssetPickState>(set => ({
    request: null,
    requestVersion: 0,
    guard: null,
    setRequest: request => set(state => ({ request, requestVersion: state.requestVersion + 1 })),
    setGuard: guard => set({ guard }),
}));
