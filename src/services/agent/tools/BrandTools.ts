import { logger } from '@/utils/logger';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

        const data = await firebaseAI.generateStructuredData<z.infer<typeof VerifyOutputSchema>>(prompt, schema as Record<string, unknown>);
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

        const data = await firebaseAI.generateStructuredData<z.infer<typeof AnalyzeBrandConsistencySchema>>(prompt, schema as Record<string, unknown>);
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

        const data = await firebaseAI.generateStructuredData<z.infer<typeof GenerateBrandGuidelinesSchema>>(prompt, schema as Record<string, unknown>);
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

        const data = await firebaseAI.generateStructuredData<z.infer<typeof AuditVisualAssetsSchema>>(prompt, schema as Record<string, unknown>);
        const validated = AuditVisualAssetsSchema.parse(data);
        return {
            ...validated,
            message: validated.compliant
                ? "All assets are compliant."
                : `Flagged ${validated.flagged_assets.length} non-compliant assets.`
        };
    }),

    save_brand_kit: wrapTool('save_brand_kit', async (args: { name: string; values: string[]; colors?: string[]; typography?: string[] }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

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
        } catch (e) {
            const error = e as Error;
            logger.error('[BrandTools] Save brand kit failed:', error);
            return toolError(`Failed to save brand kit: ${error.message}`);
        }
    }),

    load_brand_kit: wrapTool('load_brand_kit', async () => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { doc, getDoc } = await import('firebase/firestore');

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
        } catch (e) {
            const error = e as Error;
            logger.error('[BrandTools] Load brand kit failed:', error);
            return toolError(`Failed to load brand kit: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    verify_output,
    analyze_brand_consistency,
    generate_brand_guidelines,
    audit_visual_assets,
    save_brand_kit,
    load_brand_kit
} = BrandTools;
