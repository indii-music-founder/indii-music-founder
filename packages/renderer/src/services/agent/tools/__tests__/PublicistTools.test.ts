
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistTools } from '../PublicistTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
// Mock Firebase AI
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
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

describe('PublicistTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('write_press_release returns valid schema', async () => {
        const mockResponse = {
            headline: 'New Release',
            dateline: 'NEW YORK, Jan 2026',
            introduction: 'Intro',
            body_paragraphs: ['Para 1'],
            quotes: [{ speaker: 'Artist', text: 'Stoked' }],
            boilerplate: 'About us',
            contact_info: { name: 'PR', email: 'pr@example.com' },
            pdf: null
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.write_press_release({ topic: 'New Album' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse); // result.data is the ToolFunctionResult.data
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
    });

    it('draft_pitch_email returns valid schema', async () => {
        const mockResponse = {
            subject_line: 'Playlist Pitch',
            hook: 'Hook',
            body: 'Body',
            call_to_action: 'CTA',
            angle: 'Angle',
            target_outlets: ['Spotify Playlist']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.draft_pitch_email({ playlistName: 'RapCaviar', genre: 'Hip Hop', trackTitle: 'Hot Track' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
    });

    it('generate_crisis_response returns valid schema', async () => {
        const mockResponse = {
            severity_assessment: 'MEDIUM',
            strategy: 'Apologize',
            public_statement: 'Sorry',
            internal_talking_points: ['Point 1'],
            actions_to_take: ['Action 1']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.generate_crisis_response({ situation: 'Leak' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
    });

    it('pitch_story returns valid schema', async () => {
        const mockResponse = {
            subject_line: 'Pitch',
            hook: 'Hook',
            body: 'Body',
            call_to_action: 'CTA',
            angle: 'Angle',
            target_outlets: ['Outlet 1']
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await PublicistTools.pitch_story({ story_summary: 'We cool', recipient_type: 'blog' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
    });

    it('handles Autonomous failure gracefully', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValue(new Error("AI Down"));
        const result = await PublicistTools.write_press_release({ topic: 'Fail' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('AI Down');
    });
});
