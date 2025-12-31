import { AI } from '../../services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

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
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate press release.";
        } catch (e) {
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
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate crisis response.";
        } catch (e) {
            return "Error generating crisis response.";
        }
    },

    manage_media_list: async (args: { action: 'add' | 'remove' | 'list', contact?: any }) => {
        // Mock implementation
        if (args.action === 'list') {
            return JSON.stringify([
                { name: "Rolling Stone", contact: "editor@rollingstone.com", tags: ["Music", "Review"] },
                { name: "Pitchfork", contact: "news@pitchfork.com", tags: ["Indie", "News"] },
                { name: "Billboard", contact: "info@billboard.com", tags: ["Industry", "Charts"] }
            ], null, 2);
        }
        return `Successfully performed '${args.action}' on media list (Mock).`;
    },

    pitch_story: async (args: { outlet: string, angle: string }) => {
        // Mock implementation
        return JSON.stringify({
            outlet: args.outlet,
            status: "drafted",
            subjectLine: `Exclusive: Why [Artist] is the next big thing`,
            emailBody: `Hi Team at ${args.outlet},\n\nI wanted to share a story about... [AI would generate full pitch based on ${args.angle}]`
        }, null, 2);
    }
};
