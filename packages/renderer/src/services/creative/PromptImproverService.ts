import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';

/**
 * PromptImproverService
 *
 * Takes a user's rough, rambling prompt and rewrites it into a
 * production-quality image or video generation prompt.
 *
 * The service injects brand context from the user's Brand Kit
 * (colors, mood, style) so the final output is aligned to the
 * artist's aesthetic without requiring manual tag additions.
 *
 * Flow:
 *   1. User types a rough prompt → "me standing in a dark room looking cool"
 *   2. User clicks tags from the Builder to append descriptors.
 *   3. User clicks "✨ Improve Prompt" →
 *        Service takes (rawPrompt + brandKit) → Gemini rewrites it →
 *        Returns a rich, cinematographic prompt ready for generation.
 */
export interface ImprovePromptOptions {
    rawPrompt: string;
    mode: 'image' | 'video';
}

export interface ImprovedPromptResult {
    improved: string;
    reasoning: string;
}

export class PromptImproverService {
    /**
     * Enhance a rough user prompt into a detailed, generation-ready prompt.
     * Uses Gemini 3 Flash for speed — this is a "rewrite" task, not heavy reasoning.
     */
    static async improve(options: ImprovePromptOptions): Promise<ImprovedPromptResult> {
        const { rawPrompt, mode } = options;

        if (!rawPrompt.trim()) {
            throw new Error('Cannot improve an empty prompt.');
        }

        const brandContext = await this.getBrandContext();

        const systemInstruction = mode === 'video'
            ? `You are an expert cinematic video prompt engineer specializing in AI video generation (Veo 3.1).
You understand temporal pacing, camera movement, scene transitions, and how to describe motion for AI models.
Your output prompts produce stunning, production-quality video clips.`
            : `You are an expert visual prompt engineer specializing in AI image generation (Gemini 3 Pro Image).
You understand photographic composition, lighting, lens effects, film stocks, and artistic styles.
Your output prompts produce stunning, gallery-quality images.`;

        const prompt = `
${systemInstruction}

BRAND CONTEXT:
${brandContext}

USER'S RAW PROMPT:
"${rawPrompt}"

TASK:
Rewrite the user's raw prompt into a detailed, vivid, ${mode === 'video' ? 'cinematic video' : 'photographic image'} generation prompt.

RULES:
1. Preserve the user's core intent and subject matter — do not change WHAT they want.
2. Enrich with specific technical details: ${mode === 'video'
                ? 'camera movement, temporal pacing, lighting transitions, scene atmosphere'
                : 'camera model, lens, lighting setup, film stock, composition, depth of field'}.
3. Incorporate the brand context naturally (colors, mood, aesthetic) when available.
4. Keep the final prompt between 50-150 words — concise but richly descriptive.
5. Do NOT include meta-instructions like "generate an image of" — write as a pure visual description.
6. Use comma-separated descriptors for technical specs, then natural language for the scene.

Return a JSON object with:
- "improved": the rewritten prompt (string)
- "reasoning": one sentence explaining what you enhanced (string)
`;

        try {
            const result = await GenAI.generateStructuredData<ImprovedPromptResult>(
                prompt,
                {
                    nullable: false,
                    type: 'object',
                    properties: {
                        improved: {
                            type: 'string',
                            description: 'The rewritten, production-quality prompt'
                        },
                        reasoning: {
                            type: 'string',
                            description: 'Brief explanation of enhancements made'
                        }
                    },
                    required: ['improved', 'reasoning']
                },
                4096 // maxOutputTokens — generous for a rewrite task
            );

            if (!result.improved || result.improved.trim().length === 0) {
                // Fallback: return the original if Gemini returned empty
                return { improved: rawPrompt, reasoning: 'No improvements could be generated.' };
            }

            logger.info('[PromptImprover] Enhanced prompt successfully', {
                originalLength: rawPrompt.length,
                improvedLength: result.improved.length
            });

            return {
                improved: result.improved.trim(),
                reasoning: result.reasoning || 'Enhanced with technical details and brand context.'
            };
        } catch (error: unknown) {
            logger.error('[PromptImprover] Failed to improve prompt:', error);
            throw new Error('Failed to improve prompt. Please try again.');
        }
    }

    /**
     * Pull brand context from the user's profile/Brand Kit.
     * Dynamically imports store to avoid circular dependencies (following CampaignAIService pattern).
     */
    private static async getBrandContext(): Promise<string> {
        try {
            const { useStore } = await import('@/core/store');
            const userProfile = useStore.getState().userProfile;
            const brand = userProfile?.brandKit;

            if (!brand) return 'No brand kit configured. Use general best practices.';

            const parts: string[] = [];

            if (userProfile?.displayName) {
                parts.push(`Artist/Brand: ${userProfile.displayName}`);
            }
            if (brand.brandDescription) {
                parts.push(`Identity: ${brand.brandDescription}`);
            }
            if (brand.aestheticStyle) {
                parts.push(`Visual Style: ${brand.aestheticStyle}`);
            }
            if (brand.releaseDetails?.mood) {
                parts.push(`Mood: ${brand.releaseDetails.mood}`);
            }
            if (brand.releaseDetails?.themes) {
                parts.push(`Themes: ${brand.releaseDetails.themes}`);
            }
            if (brand.releaseDetails?.genre) {
                parts.push(`Genre: ${brand.releaseDetails.genre}`);
            }
            if (brand.colors && brand.colors.length > 0) {
                parts.push(`Color Palette: ${brand.colors.slice(0, 5).join(', ')}`);
            }
            if (brand.negativePrompt) {
                parts.push(`Avoid: ${brand.negativePrompt}`);
            }

            return parts.length > 0
                ? parts.join('\n')
                : 'No brand kit configured. Use general best practices.';
        } catch (_error: unknown) {
            return 'Brand context unavailable.';
        }
    }
}
