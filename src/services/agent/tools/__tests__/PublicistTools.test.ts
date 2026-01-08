
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistTools } from '../PublicistTools';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { functions } from '@/services/firebase';

// Mock Firebase AI
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn(),
    }
}));

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
            contact_info: { name: 'PR', email: 'pr@example.com' }
        };
        (firebaseAI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await PublicistTools.write_press_release({ topic: 'New Album' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse); // result.data is the ToolFunctionResult.data
        expect(firebaseAI.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_social_post calls database', async () => {
        const mockCampaign = { id: 'camp-1', platforms: ['twitter'] };
        // ...
    });

    it('generate_crisis_response returns valid schema', async () => {
        const mockResponse = {
            severity_assessment: 'MEDIUM',
            strategy: 'Apologize',
            public_statement: 'Sorry',
            internal_talking_points: ['Point 1'],
            actions_to_take: ['Action 1']
        };
        (firebaseAI.generateStructuredData as any).mockResolvedValue(mockResponse);

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
        (firebaseAI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await PublicistTools.pitch_story({ story_summary: 'We cool', outlet_type: 'blog' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
    });

    it('handles AI failure gracefully', async () => {
        (firebaseAI.generateStructuredData as any).mockRejectedValue(new Error("AI Down"));
        const result = await PublicistTools.write_press_release({ topic: 'Fail' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('AI Down');
    });
});
