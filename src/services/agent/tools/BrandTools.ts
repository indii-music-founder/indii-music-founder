import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

export const BrandTools: Record<string, AnyToolFunction> = {
    verify_output: wrapTool('verify_output', async ({ goal, content }: { goal: string; content: string }) => {
        const schema = zodToJsonSchema(VerifyOutputSchema);
        const prompt = `
        You are a strict Brand Manager. Verify if the following content meets the goal.
        Goal: ${goal}
        Content: ${content}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = VerifyOutputSchema.parse(data);
        return {
            ...validated,
            message: validated.approved
                ? "Content approved by brand manager."
                : `Content rejected: ${validated.critique}`
        };
    }),

    analyze_brand_consistency: wrapTool('analyze_brand_consistency', async ({ content, brand_guidelines }: { content: string; brand_guidelines?: string }) => {
        const schema = zodToJsonSchema(AnalyzeBrandConsistencySchema);
        const prompt = `
        You are a Brand Specialist. Analyze the consistency of the following content.
        Content: ${content}
        ${brand_guidelines ? `Brand Guidelines: ${brand_guidelines}` : ''}

        Check for tone, core values alignment, and visual language.
        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = AnalyzeBrandConsistencySchema.parse(data);
        return {
            ...validated,
            message: validated.consistent
                ? "Content is brand consistent."
                : `Found ${validated.issues.length} consistency issues.`
        };
    }),

    generate_brand_guidelines: wrapTool('generate_brand_guidelines', async ({ name, values }: { name: string; values: string[] }) => {
        const schema = zodToJsonSchema(GenerateBrandGuidelinesSchema);
        const prompt = `
        Create a structured Brand Guidelines document for a brand named "${name}".
        Core Values: ${values.join(', ')}.

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = GenerateBrandGuidelinesSchema.parse(data);
        return {
            ...validated,
            message: `Brand guidelines generated for ${name}.`
        };
    }),

    audit_visual_assets: wrapTool('audit_visual_assets', async ({ assets }: { assets: string[] }) => {
        const schema = zodToJsonSchema(AuditVisualAssetsSchema);
        const prompt = `
        Audit the following list of visual assets for brand compliance (simulated):
        Assets: ${assets.join(', ')}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await firebaseAI.generateStructuredData<any>(prompt, schema as any);
        const validated = AuditVisualAssetsSchema.parse(data);
        return {
            ...validated,
            message: validated.compliant
                ? "All assets are compliant."
                : `Flagged ${validated.flagged_assets.length} non-compliant assets.`
        };
    })
};
