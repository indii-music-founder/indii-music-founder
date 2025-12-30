import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export const BrandTools = {
    analyze_brand_consistency: async (args: { content: string, brand_guidelines?: string }) => {
        const prompt = `
        You are a Brand Manager. Analyze the following content for consistency with the brand guidelines.

        Content to Analyze:
        ${args.content}

        ${args.brand_guidelines ? `Brand Guidelines:\n${args.brand_guidelines}` : 'Use general best practices for brand consistency if no specific guidelines provided.'}

        Provide a score (0-100) and specific feedback on Tone, Visuals (if described), and Messaging.
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to analyze brand consistency.";
        } catch (e) {
            return "Error analyzing brand consistency.";
        }
    },

    generate_brand_guidelines: async (args: { assets_description: string, tone_keywords: string[], mission_statement: string }) => {
        const prompt = `
        You are a Creative Director. Create a structured Brand Guidelines document (Brand Bible).

        Assets Description: ${args.assets_description}
        Tone Keywords: ${args.tone_keywords.join(', ')}
        Mission Statement: ${args.mission_statement}

        Output Structure:
        1. Brand Story
        2. Mission & Vision
        3. Tone of Voice
        4. Color Palette Suggestions (Hex codes)
        5. Typography Rules
        6. Do's and Don'ts
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate brand guidelines.";
        } catch (e) {
            return "Error generating brand guidelines.";
        }
    },

    audit_visual_assets: async (args: { asset_urls: string[], brand_colors?: string[] }) => {
        // Note: In a real implementation, this would use Vision capabilities to analyze images at the URLs.
        // For now, we simulate the logic or use text descriptions if provided, or ask the user to describe them.
        // Assuming we might pass descriptions if URLs aren't processable directly here without a Vision Tool helper.

        const prompt = `
        You are a Visual Auditor.
        Assets provided: ${args.asset_urls.join(', ')}
        Brand Colors: ${args.brand_colors?.join(', ') || 'Not specified'}

        (Note: If you cannot see the images, provide a checklist of what to look for during a manual audit based on standard design principles).

        Create a Visual Audit Report checking for:
        1. Color Compliance
        2. Logo Usage
        3. Image Style Consistency
        `;
         try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to audit visual assets.";
        } catch (e) {
            return "Error auditing visual assets.";
        }
    }
};
