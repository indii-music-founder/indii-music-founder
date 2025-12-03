import { AI } from '../../services/ai/AIService';

export const SOCIAL_TOOLS = {
    write_social_copy: async (args: { platform: string, topic: string, tone: string }) => {
        const prompt = `
        You are a Senior Copywriter.
        Write a social media post for ${args.platform}.
        Topic: ${args.topic}
        Tone: ${args.tone}

        Include hashtags and emojis.
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate copy.";
        } catch (e) {
            return "Error generating copy.";
        }
    },

    generate_social_identity: async (args: { brand_name: string, platform: string, industry: string }) => {
        const prompt = `
        You are a Social Media Manager.
        Generate 5 creative handle/username ideas and 3 bio options for a new ${args.platform} account.
        Brand Name: ${args.brand_name}
        Industry: ${args.industry}

        OUTPUT JSON:
        {
            "handles": ["@handle1", "@handle2", ...],
            "bios": ["Bio option 1...", "Bio option 2...", ...]
        }
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || JSON.stringify({ handles: [], bios: [] });
        } catch (e) {
            return JSON.stringify({ handles: ["@error_generating"], bios: ["Could not generate bio."] });
        }
    }
};
