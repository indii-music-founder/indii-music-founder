/**
 * AIContext — The shared infrastructure contract for all generator modules.
 *
 * This interface bundles the ~10 dependencies that every generator needs access to.
 * `FirebaseAIService` implements this interface, exposing its private infrastructure
 * to generator modules without making them public to consumers.
 *
 * Generators receive this as their first argument: `(ctx: AIContext, ...args)`.
 * They never modify the context — it's a read-only contract.
 */

import type { GoogleGenAI } from '@google/genai';
import type { GenerativeModel, GenerateContentResult, Content, Part, Tool } from 'firebase/ai';
import type { CircuitBreaker } from './utils/CircuitBreaker';
import type { RateLimiter } from './RateLimiter';
import type {
    GenerationConfig,
    SafetySetting,
    ToolConfig,
    WrappedResponse,
    StreamChunk,
} from '@/shared/types/ai.dto';
import type { AppException } from '@/shared/types/errors';
import type { RemoteAIConfig } from './config/RemoteAIConfig';
import type { ExtendedGenerativeModel } from './types';

export interface AIContext {
    // ── State ──────────────────────────────────────────────────────────
    fallbackClient: GoogleGenAI | null;
    useFallbackMode: boolean;
    defaultConfig: GenerationConfig;
    model: ExtendedGenerativeModel | null;
    remoteConfig: RemoteAIConfig;
    activeRequests: Map<string, Promise<GenerateContentResult>>;

    // ── Circuit Breakers ──────────────────────────────────────────────
    contentBreaker: CircuitBreaker;
    mediaBreaker: CircuitBreaker;
    auxBreaker: CircuitBreaker;

    // ── Rate Limiter ──────────────────────────────────────────────────
    rateLimiter: RateLimiter;

    // ── Infrastructure Methods ────────────────────────────────────────
    ensureInitialized(): Promise<void>;
    initializeFallbackMode(): Promise<void>;
    handleError(error: unknown): AppException;
    sanitizePrompt(prompt: string | Content[]): string | Content[];
    getModelName(override?: string): string;

    withRetry<T>(
        operation: () => Promise<T>,
        retries?: number,
        initialDelay?: number,
        signal?: AbortSignal
    ): Promise<T>;

    // ── Core Generation (stays in main class) ─────────────────────────
    rawGenerateContent(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: {
            signal?: AbortSignal;
            cachedContent?: string;
            safetySettings?: SafetySetting[];
            toolConfig?: ToolConfig;
            thoughtSignature?: string;
            skipCache?: boolean;
            timeout?: number;
        }
    ): Promise<GenerateContentResult>;

    rawGenerateContentStream(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: {
            signal?: AbortSignal;
            safetySettings?: SafetySetting[];
            toolConfig?: ToolConfig;
            thoughtSignature?: string;
            timeout?: number;
        }
    ): Promise<{ stream: ReadableStream<StreamChunk>; response: Promise<WrappedResponse> }>;
}
