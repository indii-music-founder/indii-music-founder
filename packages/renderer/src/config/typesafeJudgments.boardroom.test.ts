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
    heuristicBoardroomWebpageSemantics,
    judgeBoardroomWebpageSemantics,
    heuristicBoardroomWorkspaceRecommendation,
    judgeBoardroomWorkspaceRecommendation,
    __resetJudgmentCooldownForTests,
} from './typesafeJudgments';

describe('TypeSafe Boardroom Jev Judgments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetJudgmentCooldownForTests();
        mocks.enabled.mockReturnValue(true);
    });

    describe('heuristicBoardroomWebpageSemantics', () => {
        it('classifies Spotify for Artists as DSP and distribution', () => {
            const result = heuristicBoardroomWebpageSemantics('https://artists.spotify.com/c/roster', 'Spotify for Artists');
            expect(result.category).toBe('dsp');
            expect(result.recommendedDepartment).toBe('distribution');
            expect(result.relevanceScore).toBeGreaterThanOrEqual(0.9);
            expect(result.source).toBe('deterministic');
        });

        it('classifies ASCAP & The MLC as pro_rights and publishing', () => {
            const ascap = heuristicBoardroomWebpageSemantics('https://www.ascap.com/repertory', 'ASCAP Repertory');
            expect(ascap.category).toBe('pro_rights');
            expect(ascap.recommendedDepartment).toBe('publishing');

            const mlc = heuristicBoardroomWebpageSemantics('https://portal.themlc.com', 'The MLC Portal');
            expect(mlc.category).toBe('pro_rights');
            expect(mlc.recommendedDepartment).toBe('publishing');
        });

        it('classifies Copyright Office as legal_compliance and legal', () => {
            const copyright = heuristicBoardroomWebpageSemantics('https://www.copyright.gov/registration/', 'Copyright Registration');
            expect(copyright.category).toBe('legal_compliance');
            expect(copyright.recommendedDepartment).toBe('legal');
        });

        it('classifies Instagram and TikTok as marketing_social and social', () => {
            const ig = heuristicBoardroomWebpageSemantics('https://instagram.com/artist', 'Instagram profile');
            expect(ig.category).toBe('marketing_social');
            expect(ig.recommendedDepartment).toBe('social');
        });

        it('classifies DistroKid as distribution', () => {
            const dist = heuristicBoardroomWebpageSemantics('https://distrokid.com/dashboard', 'DistroKid');
            expect(dist.category).toBe('distribution');
            expect(dist.recommendedDepartment).toBe('distribution');
        });

        it('falls back to general_research for unknown domains', () => {
            const general = heuristicBoardroomWebpageSemantics('https://example.com/article', 'Random Article');
            expect(general.category).toBe('general_research');
            expect(general.recommendedDepartment).toBe('marketing');
            expect(general.source).toBe('deterministic');
        });
    });

    describe('judgeBoardroomWebpageSemantics with Jev', () => {
        it('calls typesafeJudge and extracts Jev System One semantic decisions', async () => {
            const mockJudge = vi.fn().mockResolvedValue({
                data: {
                    answers: {
                        industry_category: { choice: 'pro_rights', confidence: 0.96 },
                        recommended_department: { choice: 'publishing', confidence: 0.94 },
                        relevance: 0.98,
                    },
                },
            });
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const result = await judgeBoardroomWebpageSemantics(
                'https://custom-licensing-portal.com',
                'Custom Music Licensing Portal',
                'Mechanical royalty collection and catalog clearance'
            );

            expect(mockJudge).toHaveBeenCalledTimes(1);
            expect(result.category).toBe('pro_rights');
            expect(result.recommendedDepartment).toBe('publishing');
            expect(result.relevanceScore).toBe(0.98);
            expect(result.source).toBe('jev');
        });

        it('falls back cleanly to heuristic if typesafeJudge throws', async () => {
            mocks.httpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('Network error')));

            const result = await judgeBoardroomWebpageSemantics('https://artists.spotify.com');
            expect(result.category).toBe('dsp');
            expect(result.recommendedDepartment).toBe('distribution');
            expect(result.source).toBe('deterministic');
        });
    });

    describe('heuristicBoardroomWorkspaceRecommendation', () => {
        it('recommends workbench and legal when discussing contracts or splits', () => {
            const rec = heuristicBoardroomWorkspaceRecommendation([
                { role: 'user', text: 'We need to finalize the producer split sheet and copyright assignment before signing.' },
            ]);
            expect(rec.recommendedTab).toBe('workbench');
            expect(rec.recommendedModule).toBe('legal');
        });

        it('recommends module and creative when discussing visual artwork', () => {
            const rec = heuristicBoardroomWorkspaceRecommendation([
                { role: 'user', text: 'Let us generate the single cover art and 3D visual teaser.' },
            ]);
            expect(rec.recommendedTab).toBe('module');
            expect(rec.recommendedModule).toBe('creative');
        });

        it('recommends module and finance when discussing royalties or budget', () => {
            const rec = heuristicBoardroomWorkspaceRecommendation([
                { role: 'user', text: 'Can we review our tour budget and digital streaming royalty payout?' },
            ]);
            expect(rec.recommendedTab).toBe('module');
            expect(rec.recommendedModule).toBe('finance');
        });
    });

    describe('judgeBoardroomWorkspaceRecommendation with Jev', () => {
        it('calls typesafeJudge and maps Jev System One recommendation', async () => {
            const mockJudge = vi.fn().mockResolvedValue({
                data: {
                    answers: {
                        recommended_tab: { choice: 'workbench', confidence: 0.92 },
                        recommended_module: { choice: 'legal', confidence: 0.95 },
                    },
                },
            });
            mocks.httpsCallable.mockReturnValue(mockJudge);

            const rec = await judgeBoardroomWorkspaceRecommendation([
                { role: 'user', text: 'Review the master sync licensing agreement' },
            ]);

            expect(mockJudge).toHaveBeenCalledTimes(1);
            expect(rec.recommendedTab).toBe('workbench');
            expect(rec.recommendedModule).toBe('legal');
            expect(rec.source).toBe('jev');
        });

        it('falls back to heuristic if Jev fails', async () => {
            mocks.httpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('Jev timeout')));

            const rec = await judgeBoardroomWorkspaceRecommendation([
                { role: 'user', text: 'Need a new cover art canvas' },
            ]);

            expect(rec.recommendedTab).toBe('module');
            expect(rec.recommendedModule).toBe('creative');
            expect(rec.source).toBe('deterministic');
        });
    });
});
