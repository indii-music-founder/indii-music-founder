import { logger } from '@/utils/logger';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';
import { updateBrandColorByName } from '@/services/brand/updateBrandColor';

/** Typed Electron IPC bridge for brand tools */
interface ElectronBrandBridge {
    analyzeConsistency: (assetPath: string, brandKit: Record<string, unknown>) => Promise<{
        success: boolean;
        error?: string;
        report: {
            consistent: boolean;
            consistency_score: number;
            findings?: Array<{ category: string; status: string; feedback: string }>;
            recommendations?: string[];
            summary?: string;
        };
    }>;
}

interface ElectronWindowAPI {
    electronAPI?: {
        brand?: ElectronBrandBridge;
    };
}

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

const AnalyzeBrandSentimentSchema = z.object({
    sentiment_score: z.number().min(0).max(100),
    dominant_emotion: z.string(),
    key_themes: z.array(z.string()),
    public_perception_summary: z.string()
});

const GenerateBrandKitSchema = z.object({
    name: z.string(),
    colors: z.array(z.string()),
    typography: z.array(z.string()),
    voice_description: z.string(),
    logo_concept: z.string()
});

// --- Tools Implementation ---

export const BrandTools = {
    verify_output: wrapTool('verify_output', async ({ goal, content }: { goal: string; content: string }) => {
        const schema = zodToJsonSchema(VerifyOutputSchema);
        const prompt = `
        You are a strict Brand Manager. Verify if the following content meets the goal.
        Goal: ${goal}
        Content: ${content}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof VerifyOutputSchema>>(prompt, schema as Record<string, unknown>);
        const validated = VerifyOutputSchema.parse(data);
        return {
            ...validated,
            message: validated.approved
                ? "Content approved by brand manager."
                : `Content rejected: ${validated.critique}`
        };
    }),

    analyze_brand_consistency: wrapTool('analyze_brand_consistency', async (args: {
        content?: string;
        assetPath?: string;
        brandKit?: Record<string, unknown>;
        brand_guidelines?: string;
    }) => {
        // 1. If an asset is provided, we use the Vision tool via Electron IPC
        const electronWin = window as unknown as ElectronWindowAPI;
        if (args.assetPath && electronWin.electronAPI?.brand) {
            logger.debug(`[BrandTools] Triggering vision analysis for: ${args.assetPath}`);
            const response = await electronWin.electronAPI.brand.analyzeConsistency(
                args.assetPath,
                (args.brandKit || { guidelines: args.brand_guidelines || "Follow artist's visual DNA" }) as Record<string, unknown>
            );

            if (!response.success) {
                throw new Error(response.error || 'Vision analysis failed');
            }

            const report = response.report;
            return {
                consistent: report.consistent,
                score: report.consistency_score,
                issues: report.findings
                    ?.filter((f) => f.status !== 'PASS')
                    ?.map((f) => `${f.category}: ${f.feedback}`) || [],
                recommendations: report.recommendations || [],
                summary: report.summary,
                message: report.consistent
                    ? `Brand Audit PASSED (Score: ${report.consistency_score}/100)`
                    : `Brand Audit FAILED (Score: ${report.consistency_score}/100)`
            };
        }

        // 2. Fallback to Text-only analysis (Tone/Voice)
        const schema = zodToJsonSchema(AnalyzeBrandConsistencySchema);
        const prompt = `
        You are a Brand Specialist. Analyze the consistency of the following content.
        Content: ${args.content || 'No content provided'}
        ${args.brand_guidelines ? `Brand Guidelines: ${args.brand_guidelines}` : ''}

        Check for tone, core values alignment, and visual language.
        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof AnalyzeBrandConsistencySchema>>(prompt, schema as Record<string, unknown>);
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

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof GenerateBrandGuidelinesSchema>>(prompt, schema as Record<string, unknown>);
        const validated = GenerateBrandGuidelinesSchema.parse(data);
        return {
            ...validated,
            message: `Brand guidelines generated for ${name}.`
        };
    }),

    audit_visual_assets: wrapTool('audit_visual_assets', async ({ assets }: { assets: string[] }) => {
        const electronWin = window as unknown as ElectronWindowAPI;
        if (!electronWin.electronAPI?.brand) {
            return toolError(
                `Visual brand audit requires the Electron brand analysis bridge. No assets were audited: ${assets.join(', ')}`,
                'BRAND_BRIDGE_UNAVAILABLE'
            );
        }

        const reports = await Promise.all(assets.map(async (assetPath) => {
            const response = await electronWin.electronAPI!.brand!.analyzeConsistency(assetPath, {});
            if (!response.success) {
                throw new Error(response.error || `Brand audit failed for ${assetPath}`);
            }
            return { assetPath, report: response.report };
        }));

        const flagged_assets = reports
            .filter(({ report }) => !report.consistent)
            .map(({ assetPath }) => assetPath);
        const validated = AuditVisualAssetsSchema.parse({
            compliant: flagged_assets.length === 0,
            flagged_assets,
            report: JSON.stringify(reports.map(({ assetPath, report }) => ({
                assetPath,
                score: report.consistency_score,
                summary: report.summary,
            })))
        });

        return {
            ...validated,
            message: validated.compliant
                ? "All assets are compliant."
                : `Flagged ${validated.flagged_assets.length} non-compliant assets.`
        };
    }),

    save_brand_kit: wrapTool('save_brand_kit', async (args: { name: string; values: string[]; colors?: string[]; typography?: string[] }) => {
        try {
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { doc, setDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));

            const uid = auth.currentUser?.uid;
            if (!uid) {
                throw new Error("User must be authenticated to save a brand kit.");
            }

            const brandKitRef = doc(db, 'users', uid, 'brandKit', 'current');

            await setDoc(brandKitRef, {
                ...args,
                updatedAt: serverTimestamp()
            }, { merge: true });

            return toolSuccess({
                config: args
            }, `Successfully saved the brand kit for "${args.name}" to Firestore.`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[BrandTools] Save brand kit failed:', error);
            return toolError(`Failed to save brand kit: ${error.message}`);
        }
    }),

    load_brand_kit: wrapTool('load_brand_kit', async () => {
        try {
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { doc, getDoc } = await importWithRetry(() => import('firebase/firestore'));

            const uid = auth.currentUser?.uid;
            if (!uid) {
                throw new Error("User must be authenticated to load a brand kit.");
            }

            const snap = await getDoc(doc(db, 'users', uid, 'brandKit', 'current'));
            if (!snap.exists()) {
                return toolSuccess({ exists: false }, `No brand kit found for the current user. Please create one.`);
            }

            return toolSuccess({
                exists: true,
                config: snap.data()
            }, `Successfully loaded the current brand kit.`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[BrandTools] Load brand kit failed:', error);
            return toolError(`Failed to load brand kit: ${error.message}`);
        }
    }),

    analyze_brand_sentiment: wrapTool('analyze_brand_sentiment', async (args: { text: string; context?: string }) => {
        const schema = zodToJsonSchema(AnalyzeBrandSentimentSchema);
        const prompt = `
        Analyze the brand sentiment of the following text.
        Context: ${args.context || 'General public discussion'}
        Text: ${args.text}
        
        Evaluate the overall sentiment score (0-100), dominant emotion, key themes, and provide a summary of public perception.
        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof AnalyzeBrandSentimentSchema>>(prompt, schema as Record<string, unknown>);
        const validated = AnalyzeBrandSentimentSchema.parse(data);
        return {
            ...validated,
            message: `Sentiment analyzed. Score: ${validated.sentiment_score}/100. Dominant emotion: ${validated.dominant_emotion}`
        };
    }),

    update_brand_color: wrapTool('update_brand_color', async (args: { from: string; to: string }) => {
        const result = await updateBrandColorByName(args.from, args.to);
        if (!result.success) {
            return toolError(result.message, 'COLOR_NOT_FOUND', { availableColors: result.availableColors });
        }
        return toolSuccess(
            { matchedColor: result.matchedColor, newColor: result.newColor },
            result.message
        );
    }),

    generate_brand_kit: wrapTool('generate_brand_kit', async (args: { description: string; core_values: string[] }) => {
        const schema = zodToJsonSchema(GenerateBrandKitSchema);
        const prompt = `
        Generate a comprehensive brand kit based on the following description and core values.
        Description: ${args.description}
        Core Values: ${args.core_values.join(', ')}
        
        Include suggested color hex codes, typography/font pairings, a description of the brand voice, and a logo concept.
        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof GenerateBrandKitSchema>>(prompt, schema as Record<string, unknown>);
        const validated = GenerateBrandKitSchema.parse(data);
        return {
            ...validated,
            message: `Brand kit generated for described brand.`
        };
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    verify_output,
    analyze_brand_consistency,
    generate_brand_guidelines,
    audit_visual_assets,
    save_brand_kit,
    load_brand_kit,
    analyze_brand_sentiment,
    generate_brand_kit,
    update_brand_color
} = BrandTools;
