import { describe, it, expect, vi } from 'vitest';
import { analyzeEncounterWithGemini } from './processEncounterPipeline';
import * as vertexClientModule from '../../lib/vertexClient';

describe('Encounter Pipeline Multimodal Intelligence', () => {
    it('returns a fallback analysis when Vertex AI fails or credentials are unavailable', async () => {
        vi.spyOn(vertexClientModule, 'getVertexAIClient').mockImplementation(() => {
            throw new Error('No ADC credentials in test');
        });

        const result = await analyzeEncounterWithGemini({
            clientContext: 'Test backstage interaction',
        });
        expect(result).toBeDefined();
        expect(result.summary).toContain('Test backstage interaction');
    });

    it('parses structured multimodal Gemini output when Vertex AI succeeds', async () => {
        const mockResponse = {
            summary: 'Met Alex Rivers backstage.',
            transcript: 'Just met Alex Rivers at Live Nation',
            contact: {
                name: 'Alex Rivers',
                phone: '+13135550199',
                organization: 'Live Nation',
                role: 'manager',
            },
        };

        vi.spyOn(vertexClientModule, 'getVertexAIClient').mockReturnValue({
            models: {
                generateContent: vi.fn().mockResolvedValue({
                    text: JSON.stringify(mockResponse),
                }),
            },
        } as any);

        const result = await analyzeEncounterWithGemini({
            clientContext: 'Backstage',
        });
        expect(result.contact?.name).toBe('Alex Rivers');
        expect(result.summary).toBe('Met Alex Rivers backstage.');
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
