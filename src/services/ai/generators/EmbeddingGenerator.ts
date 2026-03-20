/**
 * EmbeddingGenerator — Extracted embedding logic from FirebaseAIService.
 *
 * Handles text embeddings using both Firebase AI SDK (normal mode)
 * and direct @google/genai SDK (fallback mode). Supports single
 * and batch embedding operations.
 */

import { getGenerativeModel } from 'firebase/ai';
import type { Content } from 'firebase/ai';
import { getFirebaseAI } from '@/services/firebase';
import { auth } from '@/services/firebase';
import type { AIContext } from '../AIContext';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_CONFIG, APPROVED_MODELS } from '@/core/config/ai-models';
import { isAppCheckError } from '../appcheck';
import { TokenUsageService } from '../billing/TokenUsageService';
import { logger } from '@/utils/logger';
import type { GenAIEmbedResult, ExtendedGenerativeModel } from '../types';

/**
 * Embed a single content object and return the embedding values.
 */
export async function embedContent(
    ctx: AIContext,
    options: { model: string; content: Content }
): Promise<{ values: number[] }> {
    return ctx.auxBreaker.execute(async () => {
        await ctx.ensureInitialized();

        // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
        if (ctx.useFallbackMode && ctx.fallbackClient) {
            try {
                // Extract text from content parts
                const text = options.content.parts.map(p => 'text' in p ? p.text : '').join(' ');
                const result = await ctx.fallbackClient.models.embedContent({
                    model: options.model,
                    contents: [{ role: 'user', parts: [{ text }] }] as unknown as Record<string, unknown>[],
                    config: { outputDimensionality: AI_CONFIG.EMBEDDING.DIMENSIONS }
                });
                const embedResult = result as unknown as GenAIEmbedResult;
                return { values: embedResult.embeddings?.[0]?.values || embedResult.embedding?.values || [] };
            } catch (error) {
                throw ctx.handleError(error);
            }
        }

        // NORMAL MODE: Use Firebase AI SDK
        const firebaseAI = getFirebaseAI();

        // Auto-switch to fallback if Firebase AI is missing
        if (!firebaseAI) {
            logger.warn('[EmbeddingGenerator] Firebase AI not available for embeddings, switching to fallback');
            await ctx.initializeFallbackMode();
            return embedContent(ctx, options);
        }

        const modelCallback = getGenerativeModel(firebaseAI, {
            model: options.model
        });

        try {
            interface GenerativeModelWithEmbed {
                embedContent(request: { content: Content }): Promise<{ embedding: { values: number[] } }>;
            }
            const modelWithEmbed = modelCallback as unknown as GenerativeModelWithEmbed;

            // Defensive check: Firebase SDK model may not expose embedContent
            if (typeof modelWithEmbed.embedContent !== 'function') {
                logger.warn('[EmbeddingGenerator] Firebase SDK model lacks embedContent, switching to fallback');
                await ctx.initializeFallbackMode();
                return embedContent(ctx, options);
            }

            const result = await modelWithEmbed.embedContent({ content: options.content });
            return { values: result.embedding.values };
        } catch (error) {
            // If we hit an App Check error during normal mode, switch to fallback
            if (isAppCheckError(error) && !ctx.useFallbackMode) {
                logger.warn('[EmbeddingGenerator] App Check error during embedding, switching to fallback mode');
                await ctx.initializeFallbackMode();
                return embedContent(ctx, options);
            }
            throw ctx.handleError(error);
        }
    });
}

/**
 * Embed multiple documents in parallel (batch embedding).
 */
export async function batchEmbedContents(
    ctx: AIContext,
    contentsOrStrings: Content[] | string[],
    modelOverride?: string
): Promise<number[][]> {
    // Normalize input to Content[]
    const contents: Content[] = contentsOrStrings.map(item => {
        if (typeof item === 'string') {
            return { role: 'user', parts: [{ text: item }] };
        }
        return item;
    });

    return ctx.contentBreaker.execute(async () => {
        await ctx.ensureInitialized();

        const userId = auth.currentUser?.uid;
        if (userId) {
            await TokenUsageService.checkQuota(userId);
        }

        const modelName = modelOverride || APPROVED_MODELS.EMBEDDING_DEFAULT;

        // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
        if (ctx.useFallbackMode && ctx.fallbackClient) {
            const promises = contents.map(async (c) => {
                // Extract text from content parts
                const text = c.parts.map(p => 'text' in p ? p.text : '').join(' ');
                const result = await ctx.fallbackClient!.models.embedContent({
                    model: modelName,
                    contents: [{ role: 'user', parts: [{ text }] }] as unknown as Record<string, unknown>[],
                    config: { outputDimensionality: AI_CONFIG.EMBEDDING.DIMENSIONS }
                });
                const embedResult = result as unknown as GenAIEmbedResult;
                return embedResult.embeddings?.[0]?.values || embedResult.embedding?.values || [];
            });
            return Promise.all(promises);
        }

        // NORMAL MODE: Use Firebase AI SDK
        const firebaseAI = getFirebaseAI();
        if (!firebaseAI) {
            logger.warn('[EmbeddingGenerator] Firebase AI not available for embeddings (batch), switching to fallback');
            await ctx.initializeFallbackMode();
            return batchEmbedContents(ctx, contents, modelOverride);
        }

        const modelCallback = getGenerativeModel(firebaseAI, { model: modelName });

        try {
            // If batchEmbedContents is available, use it
            // Otherwise fall back to Promise.all
            const modelExtended = modelCallback as ExtendedGenerativeModel;

            if (typeof modelExtended.batchEmbedContents === 'function') {
                const requests = contents.map(c => ({ content: c }));
                const result = await modelExtended.batchEmbedContents({ requests });
                return result.embeddings.map((e: { values: number[] }) => e.values);
            } else {
                // Polyfill: Run in parallel
                const modelWithEmbed = modelCallback as unknown as { embedContent: (req: unknown) => Promise<{ embedding: { values: number[] } }> };
                if (typeof modelWithEmbed.embedContent === 'function') {
                    const promises = contents.map(c => modelWithEmbed.embedContent({ content: c }));
                    const results = await Promise.all(promises);
                    return results.map(r => r.embedding.values);
                }
                throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Model does not support embedding');
            }
        } catch (error) {
            // If we hit an App Check error during normal mode, switch to fallback
            if (isAppCheckError(error) && !ctx.useFallbackMode) {
                logger.warn('[EmbeddingGenerator] App Check error during batch embedding, switching to fallback mode');
                await ctx.initializeFallbackMode();
                return batchEmbedContents(ctx, contents, modelOverride);
            }
            throw ctx.handleError(error);
        }
    });
}
