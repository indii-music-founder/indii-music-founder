import { GenAI } from '@/services/ai/GenAI';
import { logger } from '@/utils/logger';
import { AI_MODELS } from '@/core/config/ai-models';
import { db, auth } from '@/services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { JSONSchemaObject } from '@/services/agent/instruments/InstrumentTypes';

// ============================================================================
// Constants & Tunable Thresholds
// ============================================================================

/**
 * Image tool names that trigger the visual autorater post-completion.
 * Add new image-producing tools here as they are introduced.
 */
export const IMAGE_TOOL_NAMES = [
    'generate_image',
    'edit_image_with_annotations',
    'batch_edit_images',
    'edit_image',
] as const;

/**
 * Pass thresholds — tunable at the top of the file per acceptance criteria 3.3.
 * An image passes only when ALL conditions are met.
 */
export const VISUAL_THRESHOLDS = {
    /** Minimum subject match score (0–10) */
    SUBJECT_MATCH_MIN: 8,
    /** Minimum scene match score (0–10) */
    SCENE_MATCH_MIN: 8,
    /** If the LLM judge marks overallPass as false, the image fails regardless of scores */
    REQUIRE_OVERALL_PASS: true,
} as const;

/**
 * Maximum number of self-correction attempts per image before surfacing manual review.
 * Prevents runaway loops.
 */
export const MAX_CORRECTION_ATTEMPTS = 2;

// ============================================================================
// Types
// ============================================================================

/**
 * Structured evaluation score returned by the LLM judge.
 */
export interface VisualEvaluationScore {
    /** How well the generated subject matches the brief (0–10) */
    subjectMatch: number;
    /** How well the scene/setting matches the brief (0–10) */
    sceneMatch: number;
    /** How well the mood/atmosphere matches the brief (0–10) */
    moodMatch: number;
    /** Adherence to technical specifications: resolution, aspect ratio, style (0–10) */
    technicalAdherence: number;
    /** LLM judge overall pass verdict */
    overallPass: boolean;
    /** Human-readable description of identified gaps */
    gapsFound: string;
    /** Corrective prompt to send back to the producing agent if the image fails */
    correctivePrompt: string;
}

/**
 * Input payload for the autorater evaluation method.
 */
export interface VisualEvaluationInput {
    /** Base64-encoded image bytes (or a data URL) */
    imageBytes: string;
    /** The user's original natural-language prompt that produced the image */
    originalBrief: string;
    /** ID of the agent that produced the image */
    agentId: string;
    /** Trace ID for observability and audit linking */
    traceId: string;
    /** Unique identifier for the original image (used to track retry count) */
    originalImageId: string;
    /** MIME type of the image (defaults to 'image/png') */
    mimeType?: string;
}

/**
 * Result of a full autorater evaluation cycle (including potential retries).
 */
export interface AutoraterResult {
    /** Whether the image passed evaluation */
    passed: boolean;
    /** The evaluation score from the last evaluation */
    score: VisualEvaluationScore | null;
    /** Number of correction attempts made */
    attemptsUsed: number;
    /** If the image failed after all attempts, this message is surfaced */
    manualReviewMessage?: string;
}

// ============================================================================
// VisualOutputAutorater
// ============================================================================

/**
 * LLM-as-judge service that evaluates generated images against the user's
 * original brief. If the score falls below threshold, it dispatches a
 * corrective prompt back to the producing agent. Hard-capped at
 * MAX_CORRECTION_ATTEMPTS retries per image.
 *
 * Mirrors the `MultiTurnAutorater` pattern (same directory).
 *
 * @see MultiTurnAutorater for the text-based autorater this is modeled after.
 */
export class VisualOutputAutorater {
    /**
     * Tracks correction attempts per originalImageId.
     * Keyed by originalImageId → number of corrections dispatched so far.
     * This map lives in-memory for the lifetime of the renderer process.
     * Each new page load / HMR refresh resets it, which is acceptable because
     * the cap is a safety net, not a persistent limit.
     */
    private static correctionAttempts = new Map<string, number>();

    // ────────────────────────────────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Evaluates a generated image against the user's original brief.
     * Returns a structured score with 0–10 ratings on four dimensions.
     *
     * Calls Gemini Flash with a structured-output schema.
     */
    static async evaluateImage(input: VisualEvaluationInput): Promise<VisualEvaluationScore | null> {
        try {
            const prompt = this.buildEvaluationPrompt(input.originalBrief);

            const schema: JSONSchemaObject = {
                type: 'object',
                properties: {
                    subjectMatch: { type: 'number', description: 'How well the generated subject matches the brief (0–10).' },
                    sceneMatch: { type: 'number', description: 'How well the scene/setting matches the brief (0–10).' },
                    moodMatch: { type: 'number', description: 'How well the mood/atmosphere matches the brief (0–10).' },
                    technicalAdherence: { type: 'number', description: 'Adherence to technical specifications like resolution, aspect ratio, and style (0–10).' },
                    overallPass: { type: 'boolean', description: 'Whether the image meets the minimum quality bar for the brief.' },
                    gapsFound: { type: 'string', description: 'Human-readable description of any gaps between the brief and the generated image.' },
                    correctivePrompt: { type: 'string', description: 'A corrective prompt to regenerate the image if it fails. Should be specific and actionable, referencing exact gaps.' },
                },
                required: ['subjectMatch', 'sceneMatch', 'moodMatch', 'technicalAdherence', 'overallPass', 'gapsFound', 'correctivePrompt'],
            };

            const result = await GenAI.generateStructuredData<VisualEvaluationScore>(
                prompt,
                schema as unknown as Record<string, unknown>,
                undefined,
                undefined,
                AI_MODELS.TEXT.FAST,
            );

            if (!result) {
                logger.warn(`[VisualOutputAutorater] Empty evaluation for trace ${input.traceId}`);
                return null;
            }

            return result;
        } catch (error) {
            logger.error(`[VisualOutputAutorater] Evaluation error for trace ${input.traceId}:`, error);
            return null;
        }
    }

    /**
     * Determines whether a score meets the pass thresholds.
     */
    static doesPass(score: VisualEvaluationScore): boolean {
        if (VISUAL_THRESHOLDS.REQUIRE_OVERALL_PASS && !score.overallPass) {
            return false;
        }
        if (score.subjectMatch < VISUAL_THRESHOLDS.SUBJECT_MATCH_MIN) {
            return false;
        }
        if (score.sceneMatch < VISUAL_THRESHOLDS.SCENE_MATCH_MIN) {
            return false;
        }
        return true;
    }

    /**
     * Checks whether the correction attempt cap has been reached for a given image.
     */
    static hasReachedCap(originalImageId: string): boolean {
        const attempts = this.correctionAttempts.get(originalImageId) || 0;
        return attempts >= MAX_CORRECTION_ATTEMPTS;
    }

    /**
     * Records a correction attempt for a given image.
     * Returns the new attempt count.
     */
    static recordAttempt(originalImageId: string): number {
        const current = this.correctionAttempts.get(originalImageId) || 0;
        const next = current + 1;
        this.correctionAttempts.set(originalImageId, next);
        return next;
    }

    /**
     * Returns the current correction attempt count for a given image.
     */
    static getAttemptCount(originalImageId: string): number {
        return this.correctionAttempts.get(originalImageId) || 0;
    }

    /**
     * Resets the correction attempt counter for a given image.
     * Useful for testing or when the user explicitly re-triggers generation.
     */
    static resetAttempts(originalImageId: string): void {
        this.correctionAttempts.delete(originalImageId);
    }

    /**
     * Clears all correction attempt tracking.
     * Primarily for testing.
     */
    static clearAllAttempts(): void {
        this.correctionAttempts.clear();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Audit Logging (Firestore)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Logs an autorater decision to Firestore for the Security Dashboard audit pane.
     * Path: `users/{uid}/visualVerifications/{traceId}`
     *
     * Fire-and-forget — never blocks the main flow.
     */
    static async logAuditRecord(
        input: VisualEvaluationInput,
        score: VisualEvaluationScore | null,
        passed: boolean,
        attemptNumber: number,
    ): Promise<void> {
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) {
                logger.warn('[VisualOutputAutorater] Cannot log audit: no authenticated user');
                return;
            }

            const auditRef = collection(db, 'users', uid, 'visualVerifications');
            await addDoc(auditRef, {
                traceId: input.traceId,
                agentId: input.agentId,
                originalImageId: input.originalImageId,
                originalBrief: input.originalBrief,
                passed,
                attemptNumber,
                score: score ? {
                    subjectMatch: score.subjectMatch,
                    sceneMatch: score.sceneMatch,
                    moodMatch: score.moodMatch,
                    technicalAdherence: score.technicalAdherence,
                    overallPass: score.overallPass,
                    gapsFound: score.gapsFound,
                } : null,
                correctivePrompt: score?.correctivePrompt || null,
                metadata: {
                    evaluatedAt: new Date().toISOString(),
                    autoraterModel: AI_MODELS.TEXT.FAST,
                    version: '1.0.0',
                },
                createdAt: serverTimestamp(),
            });

            logger.info(
                `[VisualOutputAutorater] Audit logged: trace=${input.traceId}, ` +
                `passed=${passed}, attempt=${attemptNumber}, ` +
                `subject=${score?.subjectMatch ?? 'N/A'}, scene=${score?.sceneMatch ?? 'N/A'}`
            );
        } catch (error) {
            // Audit is best-effort — never block the main flow
            logger.error('[VisualOutputAutorater] Audit log failed:', error);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Checks whether a tool name is an image-producing tool that should trigger
     * the visual autorater.
     */
    static isImageTool(toolName: string): boolean {
        return (IMAGE_TOOL_NAMES as readonly string[]).includes(toolName);
    }

    /**
     * Builds the evaluation prompt sent to Gemini Flash.
     * The image is provided as inline data alongside this text prompt.
     */
    private static buildEvaluationPrompt(originalBrief: string): string {
        return `
You are an expert Visual Quality Autorater for a creative AI platform. Your job is to evaluate whether a generated image faithfully matches the user's original brief.

ORIGINAL BRIEF:
"${originalBrief}"

Evaluate the generated image against the brief on four dimensions (score each 0–10):

1. **Subject Match** — Does the image contain the correct subject(s) described in the brief? (e.g., if the brief says "red car", is there a red car?)
2. **Scene Match** — Does the scene/setting match? (e.g., "on a beach" → is there a beach?)
3. **Mood Match** — Does the mood/atmosphere match? (e.g., "cinematic", "vibrant", "dark moody")
4. **Technical Adherence** — Does it match technical specs if mentioned? (e.g., aspect ratio, style, resolution, color palette)

Rules:
- Be strict. A "red car on a beach" that shows a blue motorcycle in a forest should score very low on subject and scene.
- overallPass should be true ONLY if the image is a reasonable visual interpretation of the brief.
- If the image fails, write a specific, actionable correctivePrompt that can be appended to the original brief to fix the gaps.
- gapsFound should be a concise list of what went wrong.

Return your evaluation as structured JSON matching the requested schema.
`.trim();
    }
}
