import { renderHook } from '@testing-library/react';
import { useURLSync } from './useURLSync';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create variables accessible inside vi.mock
const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    location: { pathname: '/', search: '' },
    setModule: vi.fn(),
    currentModule: { value: 'dashboard' },
    distributionTab: { value: 'releases' },
    financeTab: { value: 'overview' },
    setDistributionTab: vi.fn(),
    setFinanceTab: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location
}));

// Selector-aware store mock (ISSUE-1439: the hook subscribes to the active tab).
vi.mock('@/core/store', () => {
    const storeFn: any = (selector?: (s: unknown) => unknown) => {
        const state = {
            currentModule: mocks.currentModule.value,
            setModule: mocks.setModule,
            distributionTab: mocks.distributionTab.value,
            financeTab: mocks.financeTab.value,
        };
        return selector ? selector(state) : state;
    };
    storeFn.getState = () => ({
        currentModule: mocks.currentModule.value,
        setModule: mocks.setModule,
        distributionTab: mocks.distributionTab.value,
        financeTab: mocks.financeTab.value,
        setDistributionTab: mocks.setDistributionTab,
        setFinanceTab: mocks.setFinanceTab,
    });
    return { useStore: storeFn };
});

// Mock constants
vi.mock('@/core/constants', () => ({
    isValidModule: (m: string) => ['dashboard', 'creative', 'finance', 'legal', 'knowledge', 'distribution'].includes(m)
}));

describe('useURLSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mutable mocks
        mocks.location.pathname = '/';
        mocks.location.search = '';
        mocks.currentModule.value = 'dashboard';
        mocks.distributionTab.value = 'releases';
        mocks.financeTab.value = 'overview';
    });

    it('updates store when URL changes (Deep Link)', () => {
        mocks.location.pathname = '/creative';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('creative');
    });

    it('restores the Legal Department on a direct /legal reload', () => {
        mocks.location.pathname = '/legal';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('legal');
    });

    it('maps the public-facing /knowledge-base deep link to Knowledge Base', () => {
        mocks.location.pathname = '/knowledge-base';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('knowledge');
        expect(mocks.setModule).not.toHaveBeenCalledWith('workflow');
    });

    it('updates URL when store changes (Navigation)', () => {
        const { rerender } = renderHook(() => useURLSync());

        mocks.currentModule.value = 'finance';
        rerender();

        expect(mocks.navigate).toHaveBeenCalledWith('/finance');
    });

    it('carries a non-default store-backed tab on a module navigation (ISSUE-1439)', () => {
        const { rerender } = renderHook(() => useURLSync());

        mocks.currentModule.value = 'distribution';
        mocks.distributionTab.value = 'qc';
        rerender();

        expect(mocks.navigate).toHaveBeenCalledWith('/distribution?tab=qc');
    });

    it('mirrors a same-module tab switch into ?tab= with replace (ISSUE-1439)', () => {
        mocks.location.pathname = '/finance';
        mocks.currentModule.value = 'finance';
        mocks.financeTab.value = 'royalties';

        renderHook(() => useURLSync());

        expect(mocks.navigate).toHaveBeenCalledWith('/finance?tab=royalties', { replace: true });
    });

    it('applies a same-module ?tab= deep link through the store-backed setter (ISSUE-1439)', () => {
        mocks.location.pathname = '/finance';
        mocks.location.search = '?tab=royalties';
        mocks.currentModule.value = 'finance';

        renderHook(() => useURLSync());

        expect(mocks.setFinanceTab).toHaveBeenCalledWith('royalties');
        expect(mocks.setModule).not.toHaveBeenCalled();
    });

    it('deep-links a module and its tab in one navigation (ISSUE-1439)', () => {
        mocks.location.pathname = '/finance';
        mocks.location.search = '?tab=royalties';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('finance', { tab: 'royalties' });
    });

    it('an explicit ?tab= wins over the legacy alias tab (ISSUE-1439)', () => {
        mocks.location.pathname = '/audio-analyzer';
        mocks.location.search = '?tab=transmissions';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('distribution', { tab: 'transmissions' });
    });

    it('does not update URL if already matching', () => {
        mocks.currentModule.value = 'dashboard';
        mocks.location.pathname = '/';

        renderHook(() => useURLSync());

        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('strips a stale tab param when the destination module has no URL-addressable tabs', () => {
        mocks.location.pathname = '/dashboard';
        mocks.location.search = '?tab=royalties';
        mocks.currentModule.value = 'dashboard';

        renderHook(() => useURLSync());

        expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('does not update store if module is invalid', () => {
        mocks.location.pathname = '/invalid';

        renderHook(() => useURLSync());

        expect(mocks.setModule).not.toHaveBeenCalled();
    });

    it('maps legacy video deep links to the Creative Studio module without rewriting them first', () => {
        mocks.location.pathname = '/video-studio';

        renderHook(() => useURLSync());

        expect(mocks.setModule).toHaveBeenCalledWith('creative');
        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('canonicalizes a resolved legacy video route while preserving video mode', () => {
        mocks.location.pathname = '/video-producer';
        mocks.currentModule.value = 'creative';

        renderHook(() => useURLSync());

        expect(mocks.setModule).not.toHaveBeenCalled();
        expect(mocks.navigate).toHaveBeenCalledWith('/creative/video', { replace: true });
    });
});
