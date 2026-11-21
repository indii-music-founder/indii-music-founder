import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
    currentModule: 'dashboard',
    conversationMode: 'direct',
    openBoardroomModulePreview: vi.fn(),
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
        state.conversationMode = 'direct';
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

    it('opens an assigned mission module inside the Boardroom', async () => {
        state.conversationMode = 'boardroom';
        const result = await NavigationTools.switch_module({ module: 'creative' }, {
            boardroomExecution: { requestId: 'mission', stepId: 'step', ownerAgentId: 'creative' },
        });
        expect(result.success).toBe(true);
        expect(state.openBoardroomModulePreview).toHaveBeenCalledWith('creative');
        expect(state.setModule).not.toHaveBeenCalled();
    });

    it('refuses a delayed mission action once the artist leaves the Boardroom', async () => {
        const result = await NavigationTools.switch_module({ module: 'creative' }, {
            boardroomExecution: { requestId: 'mission', stepId: 'step', ownerAgentId: 'creative' },
        });
        expect(result.metadata?.errorCode).toBe('BOARDROOM_MISSION_INACTIVE');
        expect(state.openBoardroomModulePreview).not.toHaveBeenCalled();
        expect(state.setModule).not.toHaveBeenCalled();
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
