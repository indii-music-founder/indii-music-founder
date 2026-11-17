import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
    currentModule: 'dashboard',
    setModule: vi.fn(),
    setRegistrationFocus: vi.fn(),
    setRegistrationIntelligenceMessage: vi.fn(),
}));
vi.mock('@/core/store', () => ({ useStore: { getState: () => state } }));

import { NavigationTools } from '../NavigationTools';

describe('NavigationTools navigation outcome', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.currentModule = 'dashboard';
        state.setModule.mockImplementation(async (module: string) => { state.currentModule = module; });
    });

    it('switch_module reports success only after the module changed', async () => {
        const result = await (NavigationTools.switch_module as (a: unknown) => Promise<any>)({ module: 'creative' });
        expect(result.success).toBe(true);
        expect(state.currentModule).toBe('creative');
    });

    it('switch_module does not claim navigation when the switch is declined', async () => {
        state.setModule.mockImplementation(async () => undefined);
        const result = await (NavigationTools.switch_module as (a: unknown) => Promise<any>)({ module: 'creative' });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('NAVIGATION_NOT_COMPLETED');
        expect(result.message).toContain('still on dashboard');
    });

    it('navigate_to does not set registration focus or claim success when the switch is declined', async () => {
        state.setModule.mockImplementation(async () => undefined);
        const result = await (NavigationTools.navigate_to as (a: unknown) => Promise<any>)({ module: 'registration', orgId: 'ascap' });
        expect(result.success).toBe(false);
        expect(state.setRegistrationFocus).not.toHaveBeenCalled();
    });

    it('navigate_to applies the registration focus once the switch completed', async () => {
        const result = await (NavigationTools.navigate_to as (a: unknown) => Promise<any>)({ module: 'registration', orgId: 'ascap' });
        expect(result.success).toBe(true);
        expect(state.setRegistrationFocus).toHaveBeenCalledWith({ orgId: 'ascap', trackId: null });
    });
});
