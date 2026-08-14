import { renderHook } from '@testing-library/react';
import { useURLSync } from './useURLSync';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create variables accessible inside vi.mock
const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    location: { pathname: '/' },
    setModule: vi.fn(),
    currentModule: { value: 'dashboard' }
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: () => ({
        currentModule: mocks.currentModule.value,
        setModule: mocks.setModule
    })
}));

// Mock constants
vi.mock('@/core/constants', () => ({
    isValidModule: (m: string) => ['dashboard', 'creative', 'finance', 'legal', 'knowledge'].includes(m)
}));

describe('useURLSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mutable mocks
        mocks.location.pathname = '/';
        mocks.currentModule.value = 'dashboard';
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

    it('does not update URL if already matching', () => {
        mocks.currentModule.value = 'dashboard';
        mocks.location.pathname = '/';

        renderHook(() => useURLSync());

        expect(mocks.navigate).not.toHaveBeenCalled();
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
