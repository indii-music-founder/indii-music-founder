import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '../LegalTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Mock response' } }),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn()
    },
    getResponseText: vi.fn().mockImplementation((r) => r?.response?.text ? r.response.text() : (typeof r === 'string' ? r : JSON.stringify(r)))
}));

describe('LegalTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generate_nda returns generated NDA', async () => {
        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    ndaTitle: "Non-Disclosure Agreement",
                    content: "This NDA...",
                    effectiveDate: "2026-04-24"
                })
            }
        } as any);

        const result = await LegalTools.generate_nda!({
            parties: ['Party A', 'Party B'],
            purpose: 'Business Discussion',
            jurisdiction: 'US'
        });
        expect(result.success).toBe(true);
    });

    it('draft_contract generates contract text', async () => {
        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    contractTitle: "Service Agreement",
                    content: "Terms and conditions...",
                    keyTerms: ['Payment', 'Duration']
                })
            }
        } as any);

        const result = await LegalTools.draft_contract!({
            type: 'Service',
            parties: ['Company A', 'Vendor B'],
            terms: '1 year duration'
        });
        expect(result.success).toBe(true);
    });

    /**
     * ISSUE-829: an invalid split total previously returned
     * toolSuccess({ error: ... }) — a real tool error disguised as a
     * successful call. Agent orchestration would treat this as a
     * generated artifact and continue as if a real split sheet existed.
     */
    describe('generate_split_sheet (ISSUE-829)', () => {
        it('returns a real tool error (not success) when percentages total under 100', async () => {
            const result = await LegalTools.generate_split_sheet!({
                trackTitle: 'Test Track',
                contributors: [
                    { name: 'Artist A', role: 'writer', percentage: 40 },
                    { name: 'Artist B', role: 'writer', percentage: 50 },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_SPLIT_TOTAL');
            expect(result.error).toContain('90%');
        });

        it('returns a real tool error when percentages total over 100', async () => {
            const result = await LegalTools.generate_split_sheet!({
                trackTitle: 'Test Track',
                contributors: [
                    { name: 'Artist A', role: 'writer', percentage: 60 },
                    { name: 'Artist B', role: 'writer', percentage: 50 },
                ],
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_SPLIT_TOTAL');
            expect(result.error).toContain('110%');
        });

        it('tolerates floating-point drift from fractional splits that sum to 100', async () => {
            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify({
                        contractTitle: "Split Sheet",
                        content: "Terms...",
                        keyTerms: []
                    })
                }
            } as any);

            const result = await LegalTools.generate_split_sheet!({
                trackTitle: 'Three-Way Split',
                contributors: [
                    { name: 'Artist A', role: 'writer', percentage: 33.33 },
                    { name: 'Artist B', role: 'writer', percentage: 33.33 },
                    { name: 'Artist C', role: 'writer', percentage: 33.34 },
                ],
            });

            expect(result.success).toBe(true);
        });
    });
});
