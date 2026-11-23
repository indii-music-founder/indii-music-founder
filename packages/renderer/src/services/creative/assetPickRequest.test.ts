import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssetPickRequest } from './assetPickRequest';

describe('assetPickRequest (ISSUE-1707)', () => {
    beforeEach(() => useAssetPickRequest.setState({ request: null, guard: null }));

    it('starts with no request and no guard', () => {
        expect(useAssetPickRequest.getState()).toMatchObject({ request: null, guard: null });
    });

    it('stores and clears a pick request', () => {
        const onPick = vi.fn();
        useAssetPickRequest.getState().setRequest({ purpose: 'cover art', accept: 'image', onPick });
        expect(useAssetPickRequest.getState().request?.purpose).toBe('cover art');
        useAssetPickRequest.getState().setRequest(null);
        expect(useAssetPickRequest.getState().request).toBeNull();
    });

    it('stores a navigation guard name', () => {
        useAssetPickRequest.getState().setGuard('Create Release');
        expect(useAssetPickRequest.getState().guard).toBe('Create Release');
    });
});
