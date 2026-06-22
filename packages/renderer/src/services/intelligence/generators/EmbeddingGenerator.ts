/**
 * EmbeddingGenerator — backend-only guard.
 *
 * The renderer must not initialize Firebase AI or call Vertex/Gemini directly.
 * Until a secured embedding Cloud Function exists, embedding requests fail
 * closed instead of reintroducing a browser-side Google API path.
 */

import { auth } from '@/services/firebase';
import type { IntelligenceContext } from '../IntelligenceContext';
import type { Content } from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { TokenUsageService } from '../billing/TokenUsageService';

const EMBEDDING_BACKEND_MESSAGE = 'Embeddings require a secured backend embedding function; browser-side Firebase AI embeddings are disabled.';

export async function embedContent(
    ctx: IntelligenceContext,
    _options: { model: string; content: Content }
): Promise<{ values: number[] }> {
    return ctx.auxBreaker.execute(async () => {
        await ctx.ensureInitialized();
        throw new AppException(AppErrorCode.UNAUTHORIZED, EMBEDDING_BACKEND_MESSAGE, { retryable: false });
    });
}

export async function batchEmbedContents(
    ctx: IntelligenceContext,
    _contentsOrStrings: Content[] | string[],
    _modelOverride?: string
): Promise<number[][]> {
    return ctx.contentBreaker.execute(async () => {
        await ctx.ensureInitialized();

        const userId = auth.currentUser?.uid;
        if (userId) {
            await TokenUsageService.checkQuota(userId);
        }

        throw new AppException(AppErrorCode.UNAUTHORIZED, EMBEDDING_BACKEND_MESSAGE, { retryable: false });
    });
}
