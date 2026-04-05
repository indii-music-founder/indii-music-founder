/**
 * HighLevelAPI — Extracted high-level convenience methods from FirebaseAIService.
 *
 * These methods are thin wrappers over `rawGenerateContent` that handle:
 *   - Prompt preparation & sanitization
 *   - Thinking budget configuration
 *   - Semantic caching
 *   - Response parsing
 *   - Multimodal content assembly
 *
 * Each function takes `AIContext` as its first argument.
 */

import type { Content, Part, Schema, Tool, GenerateContentResult } from 'firebase/ai';
import type { AIContext } from '../AIContext';
import type {
    GenerationConfig,
    GenerateContentOptions,
    FunctionCallPart,
} from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { safeJsonParse } from '@/services/utils/json';
import { PromptSanitizer } from '@/services/security/PromptSanitizer';
import { aiCache } from '../AIResponseCache';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';

/**
 * Generate text with optional thinking budget and system instruction.
 */
export async function generateText(
    ctx: AIContext,
    prompt: string | Part[],
    thinkingBudgetOrModel?: number | string,
    systemInstructionOrConfig?: string | Record<string, unknown>
): Promise<string> {
    await ctx.ensureInitialized();
    let model: string | undefined;
    let config: Record<string, unknown> = {};
    let systemInstruction: string | undefined;

    // Item 250: Sanitize user-provided string prompts before sending to Gemini
    if (typeof prompt === 'string') {
        prompt = PromptSanitizer.sanitizeOrThrow(prompt);
    }

    if (typeof thinkingBudgetOrModel === 'string') {
        model = thinkingBudgetOrModel;
    }

    const modelName = model || ctx.getModelName();
    const cacheKey = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    if (typeof thinkingBudgetOrModel === 'number') {
        config.thinkingConfig = {
            thinkingBudget: thinkingBudgetOrModel,
            includeThoughts: true
        };
        systemInstruction = typeof systemInstructionOrConfig === 'string' ? systemInstructionOrConfig : undefined;
    } else if (typeof thinkingBudgetOrModel === 'string') {
        if (typeof systemInstructionOrConfig === 'string') {
            systemInstruction = systemInstructionOrConfig;
        } else {
            config = (systemInstructionOrConfig as Record<string, unknown>) || {};
            systemInstruction = config && typeof config === 'object' && 'systemInstruction' in config ? (config as { systemInstruction: string }).systemInstruction : undefined;
        }
    }

    // Semantic Cache Check
    const cached = await aiCache.get(cacheKey, modelName, config);
    if (cached) return cached;

    const result = await ctx.rawGenerateContent(
        typeof prompt === 'string' ? prompt : [{ role: 'user', parts: prompt }],
        modelName,
        config,
        systemInstruction
    );

    if (!result?.response) {
        throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service returned an invalid response structure');
    }

    const text = typeof result.response.text === 'function' ? result.response.text() : '';
    await aiCache.set(cacheKey, text, modelName, config);
    return text;
}

/**
 * Generate structured data from a prompt/parts and schema.
 */
export async function generateStructuredData<T>(
    ctx: AIContext,
    promptOrOptions: string | Part[] | GenerateContentOptions,
    schemaOrConfig?: Schema | Record<string, unknown>,
    thinkingBudget?: number,
    systemInstruction?: string,
    modelOverride?: string
): Promise<T> {
    await ctx.ensureInitialized();

    let prompt: string | Content[];
    let schema: Schema | undefined;
    let config: GenerationConfig = {};
    let finalSystemInstruction = systemInstruction;
    let modelName = modelOverride || ctx.getModelName();

    if (typeof promptOrOptions === 'object' && !Array.isArray(promptOrOptions) && 'contents' in promptOrOptions) {
        // Options object pattern
        const options = promptOrOptions as GenerateContentOptions;
        prompt = options.contents as Content[];
        config = options.config || {};
        schema = config.responseSchema as Schema;
        finalSystemInstruction = options.systemInstruction;
        modelName = options.model || modelName;
    } else {
        // Positional arguments pattern
        prompt = typeof promptOrOptions === 'string' ? promptOrOptions : [{ role: 'user', parts: promptOrOptions as Part[] }];
        schema = schemaOrConfig as Schema;
        config = {
            responseMimeType: 'application/json',
            responseSchema: schema
        };
        if (thinkingBudget) {
            config.thinkingConfig = {
                thinkingBudget,
                includeThoughts: true
            };
        }
    }

    // Create a lean cache key that avoids stringifying large binary/base64 data
    const leanPrompt = Array.isArray(prompt)
        ? prompt.map(p => ({
            ...p,
            parts: p.parts.map(part => 'inlineData' in part ? { ...part, inlineData: { ...part.inlineData, data: '[REDACTED_FOR_CACHE_KEY]' } } : part)
        }))
        : typeof prompt === 'string' ? prompt : '[COMPLEX_OBJECT]';

    const cacheKeyString = JSON.stringify(leanPrompt) + JSON.stringify(schema || {}) + modelName;

    const cached = await aiCache.get(cacheKeyString, modelName, config);
    if (cached) {
        try {
            return safeJsonParse(cached) as T;
        } catch (_e: unknown) {
            // Ignore parse failure
        }
    }

    const result = await ctx.rawGenerateContent(
        prompt,
        modelName,
        config,
        finalSystemInstruction
    );

    if (!result?.response) {
        throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service returned an invalid response structure for structured data');
    }

    const text = typeof result.response.text === 'function' ? result.response.text() : '';
    if (!text) {
        throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service returned an empty response for structured data');
    }
    await aiCache.set(cacheKeyString, text, modelName, config);

    // Use the robust parser
    const cleaned = text.replace(/```json\n ?| ```/g, '').trim();
    return safeJsonParse(cleaned) as T;
}

/**
 * Multi-turn chat.
 */
export async function chat(
    ctx: AIContext,
    history: ChatMessage[],
    newMessage: string,
    systemInstruction?: string
): Promise<string> {
    await ctx.ensureInitialized();
    const contents: Content[] = history.map(h => ({
        role: h.role,
        parts: h.parts as Part[] // Cast to satisfy firebase/ai types while preserving extra fields like thoughtSignature
    }));
    contents.push({ role: 'user', parts: [{ text: newMessage }] });

    const result = await ctx.rawGenerateContent(
        contents,
        ctx.model?.model,
        {},
        systemInstruction
    );

    return result.response.text();
}

/**
 * Analyze an image (base64).
 */
export async function analyzeImage(
    ctx: AIContext,
    prompt: string,
    imageBase64: string,
    mimeType: string = 'image/jpeg'
): Promise<string> {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imagePart: Part = {
        inlineData: { data: base64Data, mimeType }
    };

    const result = await ctx.rawGenerateContent([{ role: 'user', parts: [{ text: prompt }, imagePart] }]);
    return result.response.text();
}

/**
 * Analyze generic parts (Video, Audio, PDF).
 */
export async function analyzeMultimodal(
    ctx: AIContext,
    prompt: string,
    parts: Part[]
): Promise<string> {
    const result = await ctx.rawGenerateContent([{ role: 'user', parts: [{ text: prompt }, ...parts] }]);
    return result.response.text();
}

/**
 * Grounding with Google Search.
 */
export async function generateGroundedContent(
    ctx: AIContext,
    prompt: string,
    options?: { dynamicThreshold?: number }
): Promise<GenerateContentResult> {
    await ctx.ensureInitialized();
    const tools: Tool[] = [{
        googleSearch: {},
        googleSearchRetrieval: options?.dynamicThreshold ? {
            dynamicRetrievalConfig: {
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: options.dynamicThreshold
            }
        } : undefined
    }] as unknown as Tool[];
    return ctx.rawGenerateContent(prompt, ctx.model!.model, {}, undefined, tools as unknown as Tool[]);
}

/**
 * Caption an image.
 */
export async function captionImage(
    ctx: AIContext,
    image: string | ArrayBuffer,
    prompt: string = 'Describe this image in detail...'
): Promise<string> {
    const base64 = typeof image === 'string' ? image : Buffer.from(image).toString('base64');
    const content: Content[] = [{
        role: 'user',
        parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: base64 } }
        ]
    }];
    const result = await ctx.rawGenerateContent(content);
    return result.response.text();
}

/**
 * Analyze audio content.
 */
export async function analyzeAudio(
    ctx: AIContext,
    audio: string | ArrayBuffer,
    prompt: string = 'Analyze this audio content in detail...'
): Promise<string> {
    const base64 = typeof audio === 'string' ? audio : Buffer.from(audio).toString('base64');
    const content: Content[] = [{
        role: 'user',
        parts: [
            { text: prompt },
            { inlineData: { mimeType: 'audio/mpeg', data: base64 } }
        ]
    }];
    const result = await ctx.rawGenerateContent(content);
    return result.response.text();
}

/**
 * Parse JSON from AI response, handling markdown code blocks.
 */
export function parseJSON<T = Record<string, unknown>>(text: string | undefined): T | Record<string, never> {
    if (!text) return {};
    try {
        const cleaned = text.replace(/```json\n?|```/g, '').trim();
        return safeJsonParse(cleaned) as T;
    } catch {
        logger.error('[HighLevelAPI] Failed to parse JSON:', text);
        return {} as T;
    }
}
