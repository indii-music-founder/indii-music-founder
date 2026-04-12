/**
 * Fallback Client — Direct @google/genai SDK
 *
 * Used when App Check is not configured or fails.
 * Provides generateWithFallback() and streamWithFallback() methods
 * that bypass Firebase AI SDK entirely.
 *
 * Extracted from FirebaseAIService.ts for cleaner separation.
 */

import { GoogleGenAI } from '@google/genai';
import type { Content, Tool } from 'firebase/ai';
import { env } from '@/config/env';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { STANDARD_SAFETY_SETTINGS } from '../config/safety-settings';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';

/**
 * Vertex AI endpoint URLs (projects/.../endpoints/...) cannot be resolved by the
 * Gemini Developer API fallback client. When the primary Firebase AI path is
 * unavailable, fall back to the base agent model so the call succeeds.
 */
function resolveModelForFallback(modelName: string): string {
    if (modelName.startsWith('projects/') && modelName.includes('/endpoints/')) {
        logger.warn(
            '[FallbackClient] Fine-tuned Vertex endpoint cannot be used via Gemini API fallback. ' +
            `Falling back to base model. Endpoint: ${modelName}`
        );
        return AI_MODELS.TEXT.AGENT;
    }
    return modelName;
}
import { auth } from '@/services/firebase';
import { TokenUsageService } from '../billing/TokenUsageService';
import type {
    ImportMetaEnvWithKeys,
    GenAIStreamChunk,
} from '../types';
import type {
    FunctionCallPart,
    GenerateContentResponse,
    StreamChunk,
    WrappedResponse,
    ContentPart,
    SafetySetting,
    ToolConfig,
    GenerationConfig,
} from '@/shared/types/ai.dto';
import type { GenerateContentResult } from 'firebase/ai';

/**
 * Initialize the fallback @google/genai client.
 * Tries multiple key locations to find an API key.
 * Returns the initialized client.
 */
export async function initializeFallbackClient(): Promise<GoogleGenAI> {
    // Try multiple key locations: VITE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY
    // Explicitly check sources to log which one is used
    const keySources = {
        'env.VITE_API_KEY': env.VITE_API_KEY,
        'env.apiKey': env.apiKey,
        'import.meta.env.GOOGLE_API_KEY': (import.meta as unknown as ImportMetaEnvWithKeys).env?.GOOGLE_API_KEY,
        'import.meta.env.GEMINI_API_KEY': (import.meta as unknown as ImportMetaEnvWithKeys).env?.GEMINI_API_KEY
    };

    const foundSource = Object.entries(keySources).find(([_, val]) => !!val);
    const apiKey = foundSource ? foundSource[1] : undefined;

    logger.debug('[FirebaseAIService] Fallback Mode Initialization:', {
        foundKey: !!apiKey,
        source: foundSource ? foundSource[0] : 'NONE',
        keyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'
    });

    if (!apiKey) {
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'No API key found. Please set VITE_API_KEY or GOOGLE_API_KEY in your .env file.'
        );
    }

    const client = new GoogleGenAI({ apiKey });
    logger.info('[FirebaseAIService] Initialized with direct Gemini SDK (fallback mode)');
    return client;
}

/**
 * Generate content using direct Gemini SDK (fallback mode).
 * This bypasses Firebase AI SDK and App Check requirements.
 * Uses the new @google/genai SDK (GA).
 */
export async function generateWithFallback(
    fallbackClient: GoogleGenAI,
    prompt: string | Content[],
    modelName: string,
    config?: GenerationConfig,
    systemInstruction?: string,
    tools?: Tool[],
    safetySettings?: SafetySetting[],
    toolConfig?: ToolConfig,
    options?: { signal?: AbortSignal },
    handleError?: (error: unknown) => AppException
): Promise<GenerateContentResult> {
    try {
        const resolvedModel = resolveModelForFallback(modelName);
        // Build contents array for the new SDK format
        const contents = typeof prompt === 'string'
            ? [{ role: 'user' as const, parts: [{ text: prompt }] }]
            : prompt;

        // Clean config: strip non-generation fields that callers may have mixed in
        const cleanConfig = { ...config };
        delete (cleanConfig as Record<string, unknown>).systemInstruction;
        delete (cleanConfig as Record<string, unknown>).tools;
        delete (cleanConfig as Record<string, unknown>).toolConfig;
        delete (cleanConfig as Record<string, unknown>).safetySettings;

        // Remove thinkingConfig for models that don't support it
        // Only Gemini 3 family supports thinking — gemini-2.0-pro-exp was removed per MODEL_POLICY.md
        const supportsThinking = resolvedModel.includes('gemini-3');
        if (!supportsThinking) {
            delete (cleanConfig as Record<string, unknown>).thinkingConfig;
        }

        // @google/genai SDK: systemInstruction, tools, safetySettings are TOP-LEVEL fields,
        // NOT nested inside config (which maps to generation_config in the API payload).
        const result = await fallbackClient.models.generateContent({
            model: resolvedModel,
            contents: contents as unknown as Record<string, unknown>[],
            config: {
                ...cleanConfig,
                safetySettings: (safetySettings || STANDARD_SAFETY_SETTINGS) as unknown as Record<string, unknown>[],
                tools: tools as unknown as Record<string, unknown>[],
                toolConfig,
                systemInstruction,
                abortSignal: options?.signal
            } as Record<string, unknown>,
        });

        // Convert to Firebase AI SDK format for compatibility
        return {
            response: {
                candidates: result.candidates,
                usageMetadata: result.usageMetadata,
                text: () => result.text || ''
            } as unknown as GenerateContentResponse
        } as GenerateContentResult;
    } catch (error: unknown) {
        if (handleError) {
            throw handleError(error);
        }
        throw error;
    }
}

/**
 * Stream content using direct Gemini SDK (fallback mode).
 * This bypasses Firebase AI SDK and App Check requirements.
 * Uses the new @google/genai SDK (GA).
 */
export async function streamWithFallback(
    fallbackClient: GoogleGenAI,
    prompt: string | Content[],
    modelName: string,
    config?: GenerationConfig,
    systemInstruction?: string,
    tools?: Tool[],
    options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig }
): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
    const resolvedModel = resolveModelForFallback(modelName);
    const userId = auth.currentUser?.uid;

    // Build contents array for the new SDK format
    const contents = typeof prompt === 'string'
        ? [{ role: 'user' as const, parts: [{ text: prompt }] }]
        : prompt;

    // Clean config: strip non-generation fields that callers may have mixed in
    const cleanConfig = { ...config };
    delete (cleanConfig as Record<string, unknown>).systemInstruction;
    delete (cleanConfig as Record<string, unknown>).tools;
    delete (cleanConfig as Record<string, unknown>).toolConfig;
    delete (cleanConfig as Record<string, unknown>).safetySettings;

    // Remove thinkingConfig for models that don't support it
    // Only Gemini 3 family supports thinking — gemini-2.0-pro-exp was removed per MODEL_POLICY.md
    const supportsThinking = resolvedModel.includes('gemini-3');
    if (!supportsThinking) {
        delete (cleanConfig as Record<string, unknown>).thinkingConfig;
    }

    // @google/genai SDK: systemInstruction, tools, safetySettings are TOP-LEVEL fields,
    // NOT nested inside config (which maps to generation_config in the API payload).
    const result = await fallbackClient.models.generateContentStream({
        model: resolvedModel,
        contents: contents as unknown as Record<string, unknown>[],
        config: {
            ...cleanConfig,
            safetySettings: (options?.safetySettings || STANDARD_SAFETY_SETTINGS) as unknown as Record<string, unknown>[],
            tools: tools as unknown as Record<string, unknown>[],
            toolConfig: options?.toolConfig,
            systemInstruction,
            abortSignal: options?.signal
        } as Record<string, unknown>,
    });

    // Collect chunks for final response
    const chunks: GenerateContentResponse[] = [];
    let finalText = '';

    // Create a deferred promise to know when the stream finishes accumulating
    let resolveStreamComplete: () => void;
    let rejectStreamComplete: (err: unknown) => void;
    const streamCompletePromise = new Promise<void>((resolve, reject) => {
        resolveStreamComplete = resolve;
        rejectStreamComplete = reject;
    });

    const stream = new ReadableStream<StreamChunk>({
        async start(controller) {
            try {
                for await (const chunk of result) {
                    chunks.push(chunk as unknown as GenerateContentResponse);
                    let chunkText = '';
                    try {
                        const c = chunk as unknown as GenAIStreamChunk;
                        chunkText = typeof c.text === 'function' ? c.text() : (c.text || '');
                    } catch (e: unknown) { logger.debug('CAUGHT CHUNK ERROR', e); }
                    finalText += chunkText;
                    const firstPart = chunk.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
                    const thoughtSignature = firstPart && 'thoughtSignature' in firstPart ? (firstPart as ContentPart).thoughtSignature : undefined;

                    controller.enqueue({
                        text: () => chunkText,
                        thoughtSignature,
                        functionCalls: () => {
                            const part = chunk.candidates?.[0]?.content?.parts?.find((p: unknown): p is FunctionCallPart =>
                                typeof p === 'object' && p !== null && 'functionCall' in p
                            );
                            return part ? [part.functionCall] : [];
                        }
                    });
                }
                controller.close();
                resolveStreamComplete();
            } catch (streamError: unknown) {
                controller.error(streamError);
                rejectStreamComplete(streamError);
            }
        }
    });

    // Build wrapped response from accumulated chunks
    const wrappedResponsePromise = (async () => {
        await streamCompletePromise;

        const lastChunk = chunks[chunks.length - 1];
        // Find the first chunk that had a thoughtSignature
        const firstWithSignature = chunks.find(c => {
            const part = c.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
            return part && 'thoughtSignature' in part && (part as ContentPart).thoughtSignature;
        });
        const firstPart = firstWithSignature?.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
        const thoughtSignature = firstPart && 'thoughtSignature' in firstPart ? (firstPart as ContentPart).thoughtSignature : undefined;

        // Track usage for fallback mode
        if (userId && lastChunk?.usageMetadata) {
            try {
                await TokenUsageService.trackUsage(
                    userId,
                    modelName,
                    lastChunk.usageMetadata.promptTokenCount || 0,
                    lastChunk.usageMetadata.candidatesTokenCount || 0
                );
            } catch {
                // Failed to track stream usage (non-critical)
            }
        }

        return {
            response: {
                candidates: lastChunk?.candidates || [],
                usageMetadata: lastChunk?.usageMetadata,
                text: () => finalText
            } as unknown as GenerateContentResponse,
            text: () => finalText,
            thoughtSignature,
            functionCalls: () => {
                const part = lastChunk?.candidates?.[0]?.content?.parts?.find((p: unknown): p is FunctionCallPart =>
                    typeof p === 'object' && p !== null && 'functionCall' in p
                );
                return part ? [part.functionCall] : [];
            },
            usage: () => lastChunk?.usageMetadata
        };
    })();

    return {
        stream,
        response: wrappedResponsePromise
    };
}
