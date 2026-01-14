import { AI } from '../../services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { Schema, SchemaType } from 'firebase/ai';

export interface SocialIdentity {
    handles: string[];
    bios: string[];
}

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
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate copy.";
        } catch (e) {
            return "Error generating copy.";
        }
    },

    generate_social_identity: async (args: { brand_name: string, platform: string, industry: string }): Promise<SocialIdentity> => {
        const prompt = `
        You are a Social Media Manager.
        Generate 5 creative handle/username ideas and 3 bio options for a new ${args.platform} account.
        Brand Name: ${args.brand_name}
        Industry: ${args.industry}
        `;

        const schema: Schema = {
            type: SchemaType.OBJECT,
            nullable: false,
            properties: {
                handles: {
                    type: SchemaType.ARRAY,
                    nullable: false,
                    items: { type: SchemaType.STRING, nullable: false },
                    description: "List of 5 creative handle/username ideas"
                },
                bios: {
                    type: SchemaType.ARRAY,
                    nullable: false,
                    items: { type: SchemaType.STRING, nullable: false },
                    description: "List of 3 bio options"
                }
            },
            required: ["handles", "bios"]
        };

        try {
            return await AI.generateStructuredData<SocialIdentity>(
                prompt,
                schema,
                undefined, // thinkingBudget
                undefined, // systemInstruction
            );
        } catch (e) {
            console.error("Failed to generate social identity", e);
            throw e; // Let the component handle the error
        }
    }
};
