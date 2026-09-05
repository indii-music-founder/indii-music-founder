import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '../LegalTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { LegalService } from '@/services/legal/LegalService';

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
    getResponseText: vi.fn().mockImplementation((r) => {
        if (r?.response?.text) return r.response.text();
        if (typeof r === 'string') return r;
        return JSON.stringify(r);
    })
}));

vi.mock('@/services/legal/LegalService', () => ({
    LegalService: {
        saveContract: vi.fn().mockResolvedValue('contract_mock_id_123')
    }
}));

describe('LegalTools - contract_generator_and_review_tool', () => {
    const tool = LegalTools.contract_generator_and_review_tool;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Generation Mode', () => {
        it('successfully generates and auto-persists an enforceable contract draft', async () => {
            const mockContractMarkdown = `
# PRODUCER AGREEMENT
## 1. PREAMBLE
This Agreement is entered into by and between Artist Alpha and Producer Beatmaker.
## 4. AUDIT RIGHTS
Artist shall have the annual right to audit books and records.
## 6. REVERSION OF RIGHTS
Unexploited rights shall revert to Artist after 2 years.
            `.trim();

            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => mockContractMarkdown
                }
            } as any);

            const result = await tool({
                mode: 'generate',
                generation: {
                    contractType: 'producer_agreement',
                    parties: [
                        { name: 'Artist Alpha', role: 'Artist' },
                        { name: 'Producer Beatmaker', role: 'Producer' }
                    ],
                    governingLaw: 'California',
                    termLength: '2 years',
                    compensationTerms: '$1,500 advance plus 20% net royalties',
                    auditRights: true,
                    reversionClause: true
                }
            });

            expect(result.success).toBe(true);
            expect(result.data.mode).toBe('generate');
            expect(result.data.contractId).toBe('contract_mock_id_123');
            expect(result.data.contractType).toBe('producer_agreement');
            expect(result.data.content).toBe(mockContractMarkdown);
            expect(result.data.safeguards.auditRightsIncluded).toBe(true);
            expect(result.data.safeguards.reversionClauseIncluded).toBe(true);
            expect(result.data.safeguards.governingLaw).toBe('California');

            expect(LegalService.saveContract).toHaveBeenCalledWith(expect.objectContaining({
                type: 'producer_agreement',
                parties: ['Artist Alpha', 'Producer Beatmaker'],
                content: mockContractMarkdown
            }));
        });

        it('rejects generation if generation config or parties are missing', async () => {
            const missingConfigResult = await tool({
                mode: 'generate'
            });
            expect(missingConfigResult.success).toBe(false);
            expect(missingConfigResult.metadata?.errorCode).toBe('MISSING_GENERATION_CONFIG');

            const missingPartiesResult = await tool({
                mode: 'generate',
                generation: {
                    contractType: 'nda',
                    parties: []
                }
            });
            expect(missingPartiesResult.success).toBe(false);
            expect(missingPartiesResult.metadata?.errorCode).toBe('NO_PARTIES_PROVIDED');
        });
    });

    describe('Review Mode', () => {
        it('audits contract text and returns structured legal enforceability analysis', async () => {
            const mockReviewJson = {
                enforceabilityScore: 65,
                riskTier: 'HIGH',
                summary: 'The contract contains an overly broad perpetual grant of rights without any reversion mechanism.',
                clausesIdentified: ['Grant of Rights', 'Compensation', 'Indemnity'],
                redFlags: [
                    {
                        clause: 'Clause 3 (Perpetual Assignment)',
                        severity: 'HIGH',
                        explanation: 'Creator transfers all master recordings in perpetuity with no reversion if unexploited.',
                        suggestedAmendment: 'Limit term to 3 years with automatic reversion if commercially unreleased.'
                    }
                ],
                safeguardChecklist: {
                    hasAuditRights: false,
                    hasReversionClause: false,
                    hasMutualIndemnity: true,
                    hasReasonableTerm: false
                },
                overallVerdict: 'High risk for independent artist. Revisions mandatory before signing.'
            };

            vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify(mockReviewJson)
                }
            } as any);

            const result = await tool({
                mode: 'review',
                review: {
                    contractTitle: 'Exclusive Recording Agreement Draft',
                    contractText: 'Artist hereby assigns all masters in perpetuity throughout the universe without limitation...',
                    focusAreas: ['rights_reversion', 'audit_rights']
                }
            });

            expect(result.success).toBe(true);
            expect(result.data.mode).toBe('review');
            expect(result.data.review.enforceabilityScore).toBe(65);
            expect(result.data.review.riskTier).toBe('HIGH');
            expect(result.data.review.redFlags).toHaveLength(1);
            expect(result.data.review.safeguardChecklist.hasAuditRights).toBe(false);
            expect(result.data.review.safeguardChecklist.hasReversionClause).toBe(false);
        });

        it('rejects review mode if contractText is missing or empty', async () => {
            const result = await tool({
                mode: 'review',
                review: {
                    contractText: '   '
                }
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('MISSING_CONTRACT_TEXT');
        });
    });

    describe('Mode Validation', () => {
        it('rejects invalid mode', async () => {
            const result = await tool({
                mode: 'invalid_mode' as any
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_MODE');
        });
    });
});
