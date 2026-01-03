
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistTools } from './PublicistTools';
import { AI } from '@/services/ai/AIService';

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
    }
}));

describe('PublicistTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('write_press_release returns valid schema', async () => {
        const mockResponse = {
            headline: "News",
            dateline: "Today",
            introduction: "Intro",
            body_paragraphs: ["Body"],
            quotes: [],
            boilerplate: "Boilerplate",
            contact_info: { name: "Me", email: "me@me.com" }
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await PublicistTools.write_press_release({ topic: 'New Song' });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(AI.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_crisis_response returns valid schema', async () => {
        const mockResponse = {
            severity_assessment: "MEDIUM",
            strategy: "Fix it",
            public_statement: "Sorry",
            internal_talking_points: ["Ops"],
            actions_to_take: ["Fix"]
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await PublicistTools.generate_crisis_response({ situation: 'Leak' });
        expect(JSON.parse(result)).toEqual(mockResponse);
    });

    it('pitch_story returns valid schema', async () => {
        const mockResponse = {
            subject_line: "Hey",
            hook: "Look",
            body: "Content",
            call_to_action: "Call me",
            angle: "Fresh",
            target_outlets: ["CNN"]
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await PublicistTools.pitch_story({ story_summary: 'We won an award' });
        expect(JSON.parse(result)).toEqual(mockResponse);
    });

    it('handles AI failure gracefully', async () => {
        (AI.generateStructuredData as any).mockRejectedValue(new Error("AI Down"));
        const result = await PublicistTools.write_press_release({ topic: 'Fail Test' });
        const parsed = JSON.parse(result);
        expect(parsed.headline).toContain('Fail Test');
    });
});
