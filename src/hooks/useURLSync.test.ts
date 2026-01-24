import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useURLSync } from '@/hooks/useURLSync';

// Mock dependencies
const mockSetModule = vi.fn();
const mockNavigate = vi.fn();
let mockPathname = '/';
let mockCurrentModule = 'dashboard';

vi.mock('@/core/store', () => ({
    useStore: () => ({
        currentModule: mockCurrentModule,
        setModule: mockSetModule,
    })
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname })
}));

vi.mock('@/core/constants', () => ({
    isValidModule: (mod: string) => ['dashboard', 'creative', 'marketing'].includes(mod)
}));

describe('useURLSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = '/';
        mockCurrentModule = 'dashboard';
    });

    it('should update store when URL changes (Deep Link)', () => {
        mockPathname = '/creative';
        // Rerender hook to trigger effect
        renderHook(() => useURLSync());

        expect(mockSetModule).toHaveBeenCalledWith('creative');
    });

    it('should update URL when store changes', () => {
        mockCurrentModule = 'marketing';
        renderHook(() => useURLSync());

        expect(mockNavigate).toHaveBeenCalledWith('/marketing');
    });

    it('should NOT update URL if store matches URL (Stable)', () => {
        mockPathname = '/creative';
        mockCurrentModule = 'creative';
        renderHook(() => useURLSync());

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockSetModule).not.toHaveBeenCalled();
    });

    it('should NOT navigate if sub-path exists but module matches', () => {
        mockPathname = '/creative/123';
        mockCurrentModule = 'creative';
        renderHook(() => useURLSync());

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should NOT update store for invalid modules', () => {
        mockPathname = '/invalid-thing';
        renderHook(() => useURLSync());

        expect(mockSetModule).not.toHaveBeenCalled();
    });
});
