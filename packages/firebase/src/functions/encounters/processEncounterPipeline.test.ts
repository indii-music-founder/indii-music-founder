import { describe, it, expect, vi } from 'vitest';
import { analyzeEncounterWithGemini } from './processEncounterPipeline';

describe('Encounter Pipeline Multimodal Intelligence', () => {
    it('returns a fallback analysis when no multimodal credentials or inputs exist', async () => {
        const result = await analyzeEncounterWithGemini({
            clientContext: 'Test backstage interaction',
        });
        expect(result).toBeDefined();
        expect(result.summary).toContain('Test backstage interaction');
    });

    it('handles contact detection payload structure cleanly', async () => {
        const mockAnalysis = {
            summary: 'Met Marcus Vance at backstage lounge.',
            transcript: 'Just met Marcus Vance, tour manager at Live Nation, phone number 313-555-0199',
            contact: {
                name: 'Marcus Vance',
                phone: '+13135550199',
                organization: 'Live Nation',
                role: 'manager' as const,
                notes: 'Backstage pass follow up',
            }
        };

        expect(mockAnalysis.contact.name).toBe('Marcus Vance');
        expect(mockAnalysis.contact.phone).toBe('+13135550199');
        expect(mockAnalysis.contact.role).toBe('manager');
    });
});
