
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod Schemas ---

const VerifyOutputSchema = z.object({
    approved: z.boolean(),
    critique: z.string(),
    score: z.number().min(1).max(10)
});

const AnalyzeBrandConsistencySchema = z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
    recommendations: z.array(z.string())
});

const GenerateBrandGuidelinesSchema = z.object({
    voice: z.string(),
    visuals: z.string(),
    dos_and_donts: z.array(z.string())
});

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
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(VerifyOutputSchema.parse(data));
        } catch (error) {
            console.error('BrandTools.verify_output error:', error);
            return JSON.stringify({ approved: false, critique: "AI Generation Failed", score: 0 });
        }
    },

    analyze_brand_consistency: async ({ content, brand_guidelines }: { content: string; brand_guidelines?: string }) => {
        const schema = zodToJsonSchema(AnalyzeBrandConsistencySchema);
        const prompt = `
        You are a Brand Specialist. Analyze the consistency of the following content.
        Content: ${content}
        ${brand_guidelines ? `Brand Guidelines: ${brand_guidelines}` : ''}

        Check for tone, core values alignment, and visual language.
        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(AnalyzeBrandConsistencySchema.parse(data));
        } catch (error) {
            console.error('BrandTools.analyze_brand_consistency error:', error);
            return JSON.stringify({ consistent: false, issues: ["AI Analysis Failed"], recommendations: [] });
        }
    },

    generate_brand_guidelines: async ({ name, values }: { name: string; values: string[] }) => {
        const schema = zodToJsonSchema(GenerateBrandGuidelinesSchema);
        const prompt = `
        Create a structured Brand Guidelines document for a brand named "${name}".
        Core Values: ${values.join(', ')}.

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(GenerateBrandGuidelinesSchema.parse(data));
        } catch (error) {
            console.error('BrandTools.generate_brand_guidelines error:', error);
            return JSON.stringify({ voice: "Error", visuals: "Error", dos_and_donts: [] });
        }
    },

    audit_visual_assets: async ({ assets }: { assets: string[] }) => {
        const schema = zodToJsonSchema(AuditVisualAssetsSchema);
        const prompt = `
        Audit the following list of visual assets for brand compliance (simulated):
        Assets: ${assets.join(', ')}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(AuditVisualAssetsSchema.parse(data));
        } catch (error) {
            console.error('BrandTools.audit_visual_assets error:', error);
            return JSON.stringify({ compliant: false, flagged_assets: [], report: "AI Audit Failed" });
        }
    }
};
