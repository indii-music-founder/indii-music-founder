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
    isValidModule: (m: string) => ['dashboard', 'creative', 'finance'].includes(m)
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

    it('updates URL when store changes (Navigation)', () => {
        mocks.currentModule.value = 'finance';
        mocks.location.pathname = '/'; // Mismatch

        renderHook(() => useURLSync());

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
});
