
import { AI } from '../../services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';

/**
 * Publicist Tools
 * PR generation and crisis management.
 */

// --- Validation Schemas ---

const PressReleaseSchema = z.object({
    headline: z.string(),
    content: z.string(),
    contactInfo: z.string()
});

const CrisisResponseSchema = z.object({
    response: z.string(),
    sentimentAnalysis: z.string(),
    nextSteps: z.array(z.string())
});

const MediaListSchema = z.array(z.object({
    name: z.string(),
    contact: z.string(),
    tags: z.array(z.string())
}));

const PitchStorySchema = z.object({
    outlet: z.string(),
    status: z.string(),
    subjectLine: z.string(),
    emailBody: z.string()
});

// --- Tools Implementation ---

export const PUBLICIST_TOOLS = {
    write_press_release: async (args: { headline: string, company_name: string, key_points: string[], contact_info: string }) => {
        const prompt = `
        You are a Senior Publicist.
        Write a formal press release.

        Headline: ${args.headline}
        Company: ${args.company_name}
        Key Points:
        ${args.key_points.map(p => `- ${p}`).join('\n')}
        Contact Info: ${args.contact_info}

        Format: Standard Press Release format (FOR IMMEDIATE RELEASE).
        Tone: Professional, exciting, newsworthy.

        Output a strict JSON object (no markdown) matching this schema:
        { "headline": string, "content": string, "contactInfo": string }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = PressReleaseSchema.parse(parsed);
            // Return raw text or JSON depending on tool expectation.
            // Typically tools return a string.
            return JSON.stringify(result, null, 2);
        } catch (e) {
            console.error('PUBLICIST_TOOLS.write_press_release error:', e);
            return "Error generating press release.";
        }
    },

    generate_crisis_response: async (args: { issue: string, sentiment: string, platform: string }) => {
        const prompt = `
        You are a Crisis Management Expert.
        Draft a response to a negative situation.
        Issue: ${args.issue}
        Current Sentiment: ${args.sentiment}
        Platform: ${args.platform}

        Goal: De-escalate, show empathy, and provide a solution or next step.
        Tone: Empathetic, professional, calm.

        Output a strict JSON object (no markdown) matching this schema:
        { "response": string, "sentimentAnalysis": string, "nextSteps": string[] }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = CrisisResponseSchema.parse(parsed);
            return JSON.stringify(result, null, 2);
        } catch (e) {
            console.error('PUBLICIST_TOOLS.generate_crisis_response error:', e);
            return "Error generating crisis response.";
        }
    },

    manage_media_list: async (args: { action: 'add' | 'remove' | 'list', contact?: any }) => {
        // Mock implementation
        if (args.action === 'list') {
            const list = [
                { name: "Rolling Stone", contact: "editor@rollingstone.com", tags: ["Music", "Review"] },
                { name: "Pitchfork", contact: "news@pitchfork.com", tags: ["Indie", "News"] },
                { name: "Billboard", contact: "info@billboard.com", tags: ["Industry", "Charts"] }
            ];
            // Validate mock data
            MediaListSchema.parse(list);
            return JSON.stringify(list, null, 2);
        }
        return `Successfully performed '${args.action}' on media list (Mock).`;
    },

    pitch_story: async (args: { outlet: string, angle: string }) => {
        // Mock implementation
        const pitch = {
            outlet: args.outlet,
            status: "drafted",
            subjectLine: `Exclusive: Why [Artist] is the next big thing`,
            emailBody: `Hi Team at ${args.outlet},\n\nI wanted to share a story about... [AI would generate full pitch based on ${args.angle}]`
        };
        // Validate
        PitchStorySchema.parse(pitch);
        return JSON.stringify(pitch, null, 2);
    }
};
