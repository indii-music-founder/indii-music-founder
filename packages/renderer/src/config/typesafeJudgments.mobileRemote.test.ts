import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    enabled: vi.fn(() => true),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (_fns: unknown, name: string) => mocks.httpsCallable(name),
}));

vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: mocks.enabled },
    FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' },
}));

import {
    heuristicMobileRemoteIntent,
    judgeMobileRemoteIntent,
    __resetJudgmentCooldownForTests,
} from '@/config/typesafeJudgments';
import { ExecutionTokenBudget } from '@/services/agent/governance/ExecutionTokenBudget';

describe('TypeSafe Mobile Remote Jev Judgments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetJudgmentCooldownForTests();
        mocks.enabled.mockReturnValue(true);
    });

    describe('heuristicMobileRemoteIntent across all 6 tabs', () => {
        it('routes receipt/expense capture text to Finance in Studio', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'capture',
                text: 'Merch table receipt $180',
            });
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('finance');
            expect(result.actionLabel).toBe('Route to Finance');
            expect(result.source).toBe('deterministic');
        });

        it('routes split sheet and PRO agreement capture text to Legal in Studio', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'capture',
                text: 'Signed split sheet with producer',
            });
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('legal');
            expect(result.actionLabel).toBe('Review with Legal');
        });

        it('routes studio flyer/artwork requests to Creative', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'studio',
                text: 'Make a flyer for tonight in Austin',
                desktopModule: 'creative',
            });
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('creative');
            expect(result.actionLabel).toBe('Open Creative Studio');
        });

        it('recommends Vault to Studio creative handoff when viewing the Vault tab', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'vault',
                text: 'Midnight Demo v3.wav',
            });
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('creative');
            expect(result.actionLabel).toBe('Prep Release in Studio');
        });

        it('routes track/mix mentions on non-vault tabs to Cloud Vault', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'capture',
                text: 'Check final master wav for single',
            });
            expect(result.recommendedTab).toBe('stream');
            expect(result.recommendedDepartment).toBe('distribution');
            expect(result.actionLabel).toBe('Open Cloud Vault');
        });

        it('recommends acting on lead encounter items on the Feed tab', () => {
            const result = heuristicMobileRemoteIntent({
                tab: 'feed',
                text: 'Met tour booking agent backstage',
            });
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('generalist');
            expect(result.actionLabel).toBe('Act on Feed Item');
        });

        it('maps urgent and pitstop queries on Road tab to nearby Places actions', () => {
            const gas = heuristicMobileRemoteIntent({ tab: 'road', text: 'Need gas near me' });
            expect(gas.recommendedTab).toBe('road');
            expect(gas.roadPlacesAction).toBe('gas');

            const food = heuristicMobileRemoteIntent({ tab: 'road', text: 'Find coffee and breakfast' });
            expect(food.roadPlacesAction).toBe('food');

            const restroom = heuristicMobileRemoteIntent({ tab: 'road', text: 'Nearest bathroom please' });
            expect(restroom.roadPlacesAction).toBe('restroom');

            const lodging = heuristicMobileRemoteIntent({ tab: 'road', text: 'Find a hotel stay tonight' });
            expect(lodging.roadPlacesAction).toBe('lodging');

            const emergency = heuristicMobileRemoteIntent({ tab: 'road', text: 'Nearest hospital urgent' });
            expect(emergency.roadPlacesAction).toBe('emergency');
        });

        it('surfaces Wake Studio guidance when Settings shows desktop sleeping vs ready', () => {
            const sleeping = heuristicMobileRemoteIntent({
                tab: 'settings',
                text: 'desktop sleeping',
            });
            expect(sleeping.recommendedTab).toBe('settings');
            expect(sleeping.actionLabel).toBe('Wake Studio First');

            const online = heuristicMobileRemoteIntent({
                tab: 'settings',
                text: 'desktop online',
            });
            expect(online.recommendedTab).toBe('home');
            expect(online.actionLabel).toBe('Cloud Capture Ready');
        });
    });

    describe('judgeMobileRemoteIntent with Jev', () => {
        it('calls typesafeJudge and returns Jev tab & department judgment when confident', async () => {
            const mockJudge = vi.fn().mockResolvedValue({
                data: {
                    answers: {
                        recommended_tab: { choice: 'studio', confidence: 0.94 },
                        recommended_department: { choice: 'marketing', confidence: 0.91 },
                    },
                },
            });
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeMobileRemoteIntent({
                tab: 'feed',
                text: 'Promo contact wants press kit for festival run',
                desktopModule: 'dashboard',
            });

            expect(mockJudge).toHaveBeenCalledTimes(1);
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('marketing');
            expect(result.source).toBe('jev');
        });

        it('skips typesafeJudge for short input and returns deterministic fallback', async () => {
            const result = await judgeMobileRemoteIntent({
                tab: 'capture',
                text: 'ok',
            });
            expect(mocks.httpsCallable).not.toHaveBeenCalled();
            expect(result.source).toBe('deterministic');
        });

        it('falls back to deterministic heuristic on low-confidence or invalid Jev choice', async () => {
            const mockJudge = vi.fn().mockResolvedValue({
                data: {
                    answers: {
                        recommended_tab: { choice: 'invalid_tab', confidence: 0.99 },
                        recommended_department: { choice: 'finance', confidence: 0.2 },
                    },
                },
            });
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeMobileRemoteIntent({
                tab: 'capture',
                text: 'Studio receipt for cables',
            });

            expect(result.source).toBe('deterministic');
            expect(result.recommendedTab).toBe('studio');
            expect(result.recommendedDepartment).toBe('finance');
        });

        it('falls back gracefully when typesafeJudge throws', async () => {
            const mockJudge = vi.fn().mockRejectedValue(new Error('Network unavailable'));
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeMobileRemoteIntent({
                tab: 'road',
                text: 'Need gas before Detroit show',
            });

            expect(result.source).toBe('deterministic');
            expect(result.roadPlacesAction).toBe('gas');
        });

        it('handles malformed nullish callable payloads without throwing', async () => {
            const mockJudge = vi.fn().mockResolvedValue({ data: null });
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeMobileRemoteIntent({
                tab: 'capture',
                text: 'Split sheet draft for vocalist',
            });

            expect(result.source).toBe('deterministic');
            expect(result.recommendedDepartment).toBe('legal');
        });

        it('threads SemanticCallAdmission budget and degrades gracefully when checkpoint fails', async () => {
            const budget = new ExecutionTokenBudget(100);
            const mockJudge = vi.fn();
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeMobileRemoteIntent(
                { tab: 'capture', text: 'Receipt from guitar shop $45' },
                {
                    budget,
                    checkpoint: async () => {
                        throw new Error('Budget checkpoint unavailable');
                    },
                },
            );

            expect(mockJudge).not.toHaveBeenCalled();
            expect(result.source).toBe('deterministic');
            expect(result.recommendedDepartment).toBe('finance');
        });
    });
});
