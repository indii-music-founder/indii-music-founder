import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenwriterTools } from './ScreenwriterTools';
import { ProducerTools } from './ProducerTools';
import { LegalTools } from './LegalTools';
import { AI } from '@/services/ai/AIService';

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn()
    }
}));

describe('Standard Grammar Tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Screenwriter Agent', () => {
        it('format_screenplay requests JSON and parses it', async () => {
            const mockJson = JSON.stringify({
                title: "Test Scene",
                elements: [{ type: "slugline", text: "INT. TEST - DAY" }]
            });
            const mockResponse = { text: () => mockJson };
            (AI.generateContent as any).mockResolvedValue(mockResponse);

            const result = await ScreenwriterTools.format_screenplay({ text: 'John is at his desk.' });

            expect(AI.generateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: expect.objectContaining({
                    parts: expect.arrayContaining([{ text: expect.stringContaining('Convert this text to screenplay JSON') }])
                })
            }));
            const parsed = JSON.parse(result);
            expect(parsed.title).toBe("Test Scene");
        });
    });

    describe('Producer Agent', () => {
        it('create_call_sheet requests JSON and parses it', async () => {
            const mockJson = JSON.stringify({
                production: "Test Production",
                callTime: "08:00 AM",
                cast: []
            });
            const mockResponse = { text: () => mockJson };
            (AI.generateContent as any).mockResolvedValue(mockResponse);

            const result = await ProducerTools.create_call_sheet({
                date: '2025-10-27',
                location: 'Studio A',
                cast: ['Actor 1']
            });

            expect(AI.generateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: expect.objectContaining({
                    parts: expect.arrayContaining([{ text: expect.stringContaining('Create a call sheet JSON') }])
                })
            }));

            const parsed = JSON.parse(result);
            expect(parsed.production).toBe("Test Production");
        });
    });

    describe('Legal Agent', () => {
        it('draft_contract includes mandatory header', async () => {
            const mockResponse = { text: () => '# LEGAL AGREEMENT\n\nThis agreement...' };
            (AI.generateContent as any).mockResolvedValue(mockResponse);

            const result = await LegalTools.draft_contract({
                type: 'NDA',
                parties: ['Alice', 'Bob'],
                terms: 'Secrecy'
            });

            expect(AI.generateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: expect.objectContaining({
                    parts: expect.arrayContaining([{ text: expect.stringContaining('Draft a NDA between Alice and Bob') }])
                })
            }));
            expect(result).toContain('# LEGAL AGREEMENT');
        });
    });
});
