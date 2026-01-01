
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';

// --- Validation Schemas ---
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod Schemas ---

const VerifyOutputSchema = z.object({
    approved: z.boolean(),
    critique: z.string(),
    score: z.number().min(1).max(10)
});

const BrandConsistencySchema = z.object({
const AnalyzeBrandConsistencySchema = z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
    recommendations: z.array(z.string())
});

const BrandGuidelinesSchema = z.object({
const GenerateBrandGuidelinesSchema = z.object({
    voice: z.string(),
    visuals: z.string(),
    dos_and_donts: z.array(z.string())
});

const AuditAssetsSchema = z.object({
const AuditVisualAssetsSchema = z.object({
    compliant: z.boolean(),
    flagged_assets: z.array(z.string()),
    report: z.string()
});

// --- Tools Implementation ---

export const BrandTools = {
    verify_output: async ({ goal, content }: { goal: string; content: string }) => {
        const schema = zodToJsonSchema(VerifyOutputSchema);
        const prompt = `
        You are a strict Brand Manager. Verify if the following content meets the goal.
        Goal: ${goal}
        Content: ${content}

        Output a strict JSON object (no markdown) matching this schema:
        { "approved": boolean, "critique": string, "score": number (1-10) }
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            // Handle potential markdown code blocks
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return VerifyOutputSchema.parse(parsed);
        } catch (error) {
            console.error('BrandTools.verify_output error:', error);
            // Fallback safe response
            return { approved: false, critique: "AI Generation Failed", score: 0 };
        }
        Output a JSON object exactly matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;
        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        const json = AI.parseJSON(result.text());
        return VerifyOutputSchema.parse(json);
    },

    analyze_brand_consistency: async ({ content, brand_guidelines }: { content: string; brand_guidelines?: string }) => {
        const schema = zodToJsonSchema(AnalyzeBrandConsistencySchema);
        const prompt = `
        You are a Brand Specialist. Analyze the consistency of the following content.
        Content: ${content}
        ${brand_guidelines ? `Brand Guidelines: ${brand_guidelines}` : ''}

        Check for tone, core values alignment, and visual language (if described).
        Output a strict JSON object (no markdown) matching this schema:
        { "consistent": boolean, "issues": string[], "recommendations": string[] }
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT_AGENT.model,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return BrandConsistencySchema.parse(parsed);
        } catch (error) {
            console.error('BrandTools.analyze_brand_consistency error:', error);
            return { consistent: false, issues: ["AI Analysis Failed"], recommendations: [] };
        }
        Check for tone, core values alignment, and visual language.
        Output a JSON object exactly matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;
        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        const json = AI.parseJSON(result.text());
        return AnalyzeBrandConsistencySchema.parse(json);
    },

    generate_brand_guidelines: async ({ name, values }: { name: string; values: string[] }) => {
         const schema = zodToJsonSchema(GenerateBrandGuidelinesSchema);
         const prompt = `
         Create a structured Brand Guidelines document for a brand named "${name}".
         Core Values: ${values.join(', ')}.

         Output a strict JSON object (no markdown) matching this schema:
         { "voice": string, "visuals": string, "dos_and_donts": string[] }
         `;

        try {
             const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return BrandGuidelinesSchema.parse(parsed);
        } catch (error) {
            console.error('BrandTools.generate_brand_guidelines error:', error);
            return { voice: "Error", visuals: "Error", dos_and_donts: [] };
        }
         Output a JSON object exactly matching this schema:
         ${JSON.stringify(schema, null, 2)}
         `;
         const result = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        const json = AI.parseJSON(result.text());
        return GenerateBrandGuidelinesSchema.parse(json);
    },

    audit_visual_assets: async ({ assets }: { assets: string[] }) => {
        const schema = zodToJsonSchema(AuditVisualAssetsSchema);
        const prompt = `
        Audit the following list of visual assets for brand compliance (simulated):
        Assets: ${assets.join(', ')}

        Output a strict JSON object (no markdown) matching this schema:
        { "compliant": boolean, "flagged_assets": string[], "report": string }
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return AuditAssetsSchema.parse(parsed);
        } catch (error) {
            console.error('BrandTools.audit_visual_assets error:', error);
            return { compliant: false, flagged_assets: [], report: "AI Audit Failed" };
        }
        Output a JSON object exactly matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;
        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        const json = AI.parseJSON(result.text());
        return AuditVisualAssetsSchema.parse(json);
    }
};
