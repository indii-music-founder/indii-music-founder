import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsFounderTier } from './useIsFounderTier';

const stateMock = vi.hoisted(() => ({ userProfile: null as unknown }));

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: unknown) => unknown) => selector(stateMock),
}));

// useShallow passthrough — the hook's identity logic is what matters here.
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn,
}));

import { useStore } from '@/core/store';

function setProfile(profile: unknown) {
    stateMock.userProfile = profile;
}

describe('useIsFounderTier', () => {
    it.each([
        ['tier field', { tier: 'founder' }],
        ['subscriptionTier field', { subscriptionTier: 'founder' }],
        ['plan field', { plan: 'founder' }],
        ['isFounder flag', { isFounder: true }],
    ])('recognizes founder status via %s', (_label, profile) => {
        setProfile(profile);
        const { result } = renderHook(() => useIsFounderTier());
        expect(result.current).toBe(true);
    });

    it('is false for free and anonymous-adjacent profiles', () => {
        for (const profile of [
            { tier: 'free' },
            { subscriptionTier: 'pro' },
            {},
            null,
        ]) {
            setProfile(profile);
            const { result } = renderHook(() => useIsFounderTier());
            expect(result.current).toBe(false);
        }
    });
});

// Keep the mocked import referenced so tree-shaking doesn't complain in strict setups.
void useStore;
