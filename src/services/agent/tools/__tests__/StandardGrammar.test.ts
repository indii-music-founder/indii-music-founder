
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenwriterTools } from '../ScreenwriterTools';
import { ProducerTools } from '../ProducerTools';
import { LegalTools } from '../LegalTools';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

// Mock Firebase AI
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn()
    }
}));

// Mock AI Models
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: {
            AGENT: 'gemini-pro',
            FAST: 'gemini-flash'
        }
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
            const mockResponse = { response: { text: () => mockJson } };
            vi.mocked(firebaseAI.generateContent).mockResolvedValue(mockResponse as any);

            const result = await ScreenwriterTools.format_screenplay({ text: 'John is at his desk.' });

            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.stringContaining('Convert this text to screenplay JSON'),
                'gemini-pro',
                undefined,
                expect.stringContaining('You are a professional screenwriter')
            );

            expect(result.success).toBe(true);
            const parsed = result.data;
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
            const mockResponse = { response: { text: () => mockJson } };
            vi.mocked(firebaseAI.generateContent).mockResolvedValue(mockResponse as any);

            const result = await ProducerTools.create_call_sheet({
                date: '2025-10-27',
                location: 'Studio A',
                cast: ['Actor 1']
            });

            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.stringContaining('Create a call sheet JSON'),
                'gemini-pro',
                undefined,
                expect.stringContaining('You are a Unit Production Manager')
            );

            expect(result.success).toBe(true);
            const parsed = result.data;
            expect(parsed.production).toBe("Test Production");
        });
    });

    describe('Legal Agent', () => {
        it('draft_contract includes mandatory header', async () => {
            const mockContent = '# LEGAL AGREEMENT\n\nThis agreement...';
            const mockResponse = { response: { text: () => mockContent } };
            vi.mocked(firebaseAI.generateContent).mockResolvedValue(mockResponse as any);

            const result = await LegalTools.draft_contract({
                type: 'NDA',
                parties: ['Alice', 'Bob'],
                terms: 'Secrecy'
            });

            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.stringContaining('Draft a NDA between Alice and Bob'),
                'gemini-pro',
                undefined,
                expect.stringContaining('You are a senior entertainment lawyer')
            );
            expect(result.success).toBe(true);
            expect(result.data.content).toContain('# LEGAL AGREEMENT');
        });
    });
});
