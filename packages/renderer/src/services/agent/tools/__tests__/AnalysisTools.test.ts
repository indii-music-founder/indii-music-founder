import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisTools } from '../AnalysisTools';

const mockGenerateContent = vi.fn();
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
    },
    getResponseText: (response: any) => response?.text ?? '',
}));

vi.mock('../fine-tuned-models', () => ({
    getFineTunedModel: vi.fn(() => 'projects/123/locations/us/endpoints/456'),
}));

vi.mock('@/services/creator-protection', () => ({
    creatorProtectionHarnessService: {
        reviewAIVoiceLikenessClauseWithJev: vi.fn().mockImplementation(async (text: string) => {
            const flags: string[] = [];
            if (text.includes('voice model')) {
                flags.push('Flag: AI voice clone unauthorized');
            }
            return {
                flags,
                verdict: flags.length > 0 ? 'REJECT' : 'APPROVE',
                confidence: 0.95,
            };
        }),
    },
}));

describe('AnalysisTools.analyze_contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('successfully analyzes contract via AutonomousIntelligence and reviews voice/likeness clauses without Cloud Functions', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify({
                score: 85,
                summary: 'Standard non-exclusive license agreement.',
                risks: ['Broad indemnification clause'],
            }),
        });

        const contractText = 'Artist grants license for master recording including rights to create voice model synthetic speech.';
        const result = await AnalysisTools.analyze_contract({
            file_data: contractText,
            mime_type: 'text/plain',
        });

        expect(result.success).toBe(true);
        expect(result.data.score).toBe(85);
        expect(result.data.summary).toBe('Standard non-exclusive license agreement.');
        expect(result.data.risks).toContain('Broad indemnification clause');
        expect(result.data.risks).toContain('Flag: AI voice clone unauthorized');
        expect(result.data.aiClauseReview.verdict).toBe('REJECT');
    });

    it('falls back gracefully to standard baseline when AutonomousIntelligence generation encounters non-JSON output', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: 'I cannot parse this contract into pure JSON.',
        });

        const contractText = 'Simple artist agreement without exploitative terms.';
        const result = await AnalysisTools.analyze_contract({
            file_data: contractText,
            mime_type: 'text/plain',
        });

        expect(result.success).toBe(true);
        expect(result.data.score).toBe(70);
        expect(result.data.summary).toContain('heuristic guidelines');
        expect(result.data.aiClauseReview.verdict).toBe('APPROVE');
    });
});
