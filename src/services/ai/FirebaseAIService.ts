import {
    getGenerativeModel,
    getLiveGenerativeModel,
    GenerativeModel,
    LiveGenerativeModel,
    GenerateContentResult,
    GenerateContentStreamResult,
    Content,
    Part,
    Schema,
    Tool
} from 'firebase/ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirebaseAI, remoteConfig, functions } from '@/services/firebase';
import { env } from '@/config/env';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { httpsCallable } from 'firebase/functions';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';
import {
    InlineDataPart,
    FunctionCallPart,
    GenerateContentResponse,
    WrappedResponse,
    StreamChunk,
    GenerateVideoRequest,
    GenerateVideoResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    GenerateSpeechResponse,
    GenerationConfig
} from '@/shared/types/ai.dto';

import { CircuitBreaker } from './utils/CircuitBreaker';
import { BREAKER_CONFIGS } from './config/breaker-configs';
import { STANDARD_SAFETY_SETTINGS } from './config/safety-settings';
import { InputSanitizer } from './utils/InputSanitizer';
import { TokenUsageService } from './billing/TokenUsageService';
import { auth } from '@/services/firebase';
import { aiCache } from './AIResponseCache';
import { generateSecureId } from '@/utils/security';
import { logger } from '@/utils/logger';
import { CachedContextService } from './context/CachedContextService';

// ============================================================================
// App Check Detection & Fallback Mode
// ============================================================================

/**
 * Checks if an error indicates App Check is not properly configured.
 * When this happens, we should fall back to direct Gemini SDK.
 */
function isAppCheckError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
        msg.includes('installations/request-failed') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('permission-denied') ||
        msg.includes('app-check-token') ||
        msg.includes('The caller does not have permission')
    );
}

/**
 * Check if App Check is configured in the environment.
 * If not, we should use direct Gemini SDK from the start.
 */
function isAppCheckConfigured(): boolean {
    return !!(env.appCheckKey || env.appCheckDebugToken);
}

// Default model if remote config fails
const FALLBACK_MODEL = AI_MODELS.TEXT.FAST;

// Interface for BatchEmbedContentsResponse (missing in SDK types)
interface BatchEmbedContentsResponse {
    embeddings: { values: number[] }[];
}

// Interface for GenerativeModel with batching support
interface ExtendedGenerativeModel extends GenerativeModel {
    batchEmbedContents?(request: { requests: { content: Content }[] }): Promise<BatchEmbedContentsResponse>;
    embedContent?(request: { content: Content }): Promise<{ embedding: { values: number[] } }>;
}

// Duplicates removed

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
}

export class FirebaseAIService {
    private model: ExtendedGenerativeModel | null = null;
    private isInitialized = false;

    // Fallback mode: use direct Gemini SDK when App Check is not available
    private useFallbackMode = false;
    private fallbackClient: GoogleGenerativeAI | null = null;

    // Circuit Breakers
    private contentBreaker = new CircuitBreaker(BREAKER_CONFIGS.CONTENT_GENERATION);
    private mediaBreaker = new CircuitBreaker(BREAKER_CONFIGS.MEDIA_GENERATION);
    private auxBreaker = new CircuitBreaker(BREAKER_CONFIGS.AUX_SERVICES);

    constructor() { }

    /**
     * Bootstrap the AI service:
     * 1. Check if App Check is configured - if not, use direct Gemini SDK
     * 2. Fetch Remote Config to get the latest model name.
     * 3. Initialize the GenerativeModel using the pre-configured AI instance.
     */
    async bootstrap(): Promise<void> {
        if (this.isInitialized) return;

        // Check if App Check is configured - if not, use direct Gemini SDK
        if (!isAppCheckConfigured()) {
            console.warn('[FirebaseAIService] App Check not configured, using direct Gemini SDK fallback');
            await this.initializeFallbackMode();
            return;
        }

        try {
            // 1. Get Firebase AI instance (lazy initialized)
            const firebaseAI = getFirebaseAI();
            if (!firebaseAI) {
                console.warn('[FirebaseAIService] Firebase AI not available, using fallback');
                await this.initializeFallbackMode();
                return;
            }

            // 2. Fetch Remote Config (Safe Mode)
            let modelName: string = FALLBACK_MODEL;
            try {
                await fetchAndActivate(remoteConfig);
                modelName = getValue(remoteConfig, 'model_name').asString() || FALLBACK_MODEL;
            } catch (configError: unknown) {
                if (isAppCheckError(configError)) {
                    throw configError;
                }
                console.warn('[FirebaseAIService] Failed to fetch remote config, using default model:', configError);
            }

            // 3. Initialize SDK
            this.model = getGenerativeModel(firebaseAI, {
                model: modelName,
                safetySettings: STANDARD_SAFETY_SETTINGS as any
            });

            if (!this.model) {
                throw new Error('Failed to create generative model instance');
            }

            this.isInitialized = true;
            logger.info('[FirebaseAIService] Initialized with Firebase AI SDK');

        } catch (error) {
            logger.error('[FirebaseAIService] Bootstrap failed, attempting fallback:', error);
            // If we hit an App Check error OR ANY initialization error, fall back to direct Gemini SDK
            try {
                await this.initializeFallbackMode();
            } catch (fallbackError) {
                throw this.handleError(fallbackError);
            }
        }
    }

    /**
     * Initialize fallback mode using direct Gemini SDK (no App Check required).
     * This is used in development or when App Check is not configured.
     */
    private async initializeFallbackMode(): Promise<void> {
        const apiKey = env.VITE_API_KEY || env.apiKey;
        if (!apiKey) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'No API key found. Please set VITE_API_KEY in your .env file.'
            );
        }

        this.fallbackClient = new GoogleGenerativeAI(apiKey);
        this.useFallbackMode = true;
        this.isInitialized = true;
        logger.info('[FirebaseAIService] Initialized with direct Gemini SDK (fallback mode)');
    }

    /**
     * Get the model name, either from remote config or fallback
     */
    private getModelName(modelOverride?: string): string {
        if (modelOverride) return modelOverride;
        return this.model?.model || FALLBACK_MODEL;
    }

    async rawGenerateContent(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal, cachedContent?: string }
    ): Promise<GenerateContentResult> {
        // Wrap in retry logic (internal retries for 503/429/Transient Aborts)
        return this.contentBreaker.execute(async () => {
            return this.withRetry(async () => {
                await this.ensureInitialized();

                // Rate Limit Check
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await TokenUsageService.checkQuota(userId);
                }

                const modelName = this.getModelName(modelOverride);
                // Validate & Sanitize
                const sanitizedPrompt = this.sanitizePrompt(prompt);

                // ============================================================
                // FALLBACK MODE: Use direct Gemini SDK when App Check unavailable
                // ============================================================
                if (this.useFallbackMode && this.fallbackClient) {
                    return this.generateWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools);
                }

                // ============================================================
                // NORMAL MODE: Use Firebase AI SDK with App Check
                // ============================================================

                // 1. Check for Cached Content if systemInstruction is large
                let cachedContent = options?.cachedContent;
                if (!cachedContent && systemInstruction && CachedContextService.shouldCache(systemInstruction)) {
                    const hash = CachedContextService.generateHash(systemInstruction, tools);
                    const existingCache = await CachedContextService.findCache(hash);
                    if (existingCache) {
                        cachedContent = existingCache;
                    }
                }

                const modelOptions: any = {
                    model: modelName,
                    generationConfig: config,
                    systemInstruction,
                    tools,
                    safetySettings: STANDARD_SAFETY_SETTINGS
                };

                // Inject cachedContent if supported/available
                if (cachedContent) {
                    modelOptions.cachedContent = cachedContent;
                }

                const modelCallback = getGenerativeModel(getFirebaseAI()!, modelOptions);

                try {
                    const result = await modelCallback.generateContent(
                        typeof sanitizedPrompt === 'string'
                            ? sanitizedPrompt
                            : { contents: sanitizedPrompt }
                    );

                    // Track Usage
                    if (userId && result.response.usageMetadata) {
                        await TokenUsageService.trackUsage(
                            userId,
                            modelName,
                            result.response.usageMetadata.promptTokenCount || 0,
                            result.response.usageMetadata.candidatesTokenCount || 0
                        );
                    }

                    return result;
                } catch (error) {
                    // If we hit an App Check error during normal mode, switch to fallback
                    if (isAppCheckError(error) && !this.useFallbackMode) {
                        console.warn('[FirebaseAIService] App Check error during generation, switching to fallback mode');
                        await this.initializeFallbackMode();
                        return this.generateWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools);
                    }
                    throw this.handleError(error);
                }
            }, 3, 1000, options?.signal); // Pass signal to withRetry
        });
    }

    /**
     * Generate content using direct Gemini SDK (fallback mode).
     * This bypasses Firebase AI SDK and App Check requirements.
     */
    private async generateWithFallback(
        prompt: string | Content[],
        modelName: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[]
    ): Promise<GenerateContentResult> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }

        try {
            const model = this.fallbackClient.getGenerativeModel({
                model: modelName,
                generationConfig: config as unknown as undefined, // Type mismatch workaround
                systemInstruction: systemInstruction,
                tools: tools as unknown as undefined,
                safetySettings: STANDARD_SAFETY_SETTINGS as any
            });

            const result = await model.generateContent(
                typeof prompt === 'string'
                    ? prompt
                    : { contents: prompt as unknown as Content[] } as unknown as string
            );

            // Convert to Firebase AI SDK format for compatibility
            return {
                response: result.response as unknown as GenerateContentResponse
            } as GenerateContentResult;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * CORE: Raw generate content stream
     */
    async rawGenerateContentStream(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        return this.contentBreaker.execute(async () => {
            return this.withRetry(async () => {
                await this.ensureInitialized();

                // Rate Limit Check
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await TokenUsageService.checkQuota(userId);
                }

                const modelName = this.getModelName(modelOverride);
                const sanitizedPrompt = this.sanitizePrompt(prompt);

                // ============================================================
                // FALLBACK MODE: Use direct Gemini SDK when App Check unavailable
                // ============================================================
                if (this.useFallbackMode && this.fallbackClient) {
                    return this.streamWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools, options);
                }

                // ============================================================
                // NORMAL MODE: Use Firebase AI SDK with App Check
                // ============================================================

                // 1. Check for Cached Content if systemInstruction is large
                let cachedContent: string | undefined;
                if (systemInstruction && CachedContextService.shouldCache(systemInstruction)) {
                    const hash = CachedContextService.generateHash(systemInstruction, tools);
                    const existingCache = await CachedContextService.findCache(hash);
                    if (existingCache) {
                        cachedContent = existingCache;
                    }
                }

                const modelOptions: any = {
                    model: modelName,
                    generationConfig: config,
                    systemInstruction,
                    tools,
                    safetySettings: STANDARD_SAFETY_SETTINGS
                };

                if (cachedContent) {
                    modelOptions.cachedContent = cachedContent;
                }

                const modelCallback = getGenerativeModel(getFirebaseAI()!, modelOptions);

                try {

                    const result: GenerateContentStreamResult = await modelCallback.generateContentStream(
                        typeof sanitizedPrompt === 'string' ? sanitizedPrompt : { contents: sanitizedPrompt },

                        // @ts-expect-error - options param not in typed definition but supported
                        options
                    );

                    // Wrap the final response promise
                    const wrappedResponsePromise = result.response.then(async (aggResult) => {
                        // Track usage
                        if (userId && aggResult.usageMetadata) {
                            try {
                                await TokenUsageService.trackUsage(
                                    userId,
                                    modelName,
                                    aggResult.usageMetadata.promptTokenCount || 0,
                                    aggResult.usageMetadata.candidatesTokenCount || 0
                                );
                            } catch {
                                // Failed to track stream usage (non-critical)
                            }
                        }

                        return {
                            response: aggResult as unknown as GenerateContentResponse,
                            text: () => aggResult.text?.() ?? '',
                            functionCalls: () => {
                                const part = aggResult.candidates?.[0]?.content?.parts?.find((p): p is FunctionCallPart => 'functionCall' in p);
                                return part ? [part.functionCall] : [];
                            },
                            usage: () => aggResult.usageMetadata
                        };
                    });

                    const stream = new ReadableStream<StreamChunk>({
                        async start(controller) {
                            try {
                                for await (const chunk of result.stream) {
                                    controller.enqueue({
                                        text: () => {
                                            try { return chunk.text(); } catch { return ''; }
                                        },
                                        functionCalls: () => {
                                            const part = chunk.candidates?.[0]?.content?.parts?.find((p): p is FunctionCallPart => 'functionCall' in p);
                                            return part ? [part.functionCall] : [];
                                        }
                                    });
                                }
                                controller.close();
                            } catch (streamError) {
                                controller.error(streamError);
                            }
                        }
                    });

                    return { stream, response: wrappedResponsePromise };
                } catch (error) {
                    // If we hit an App Check error during normal mode, switch to fallback
                    if (isAppCheckError(error) && !this.useFallbackMode) {
                        console.warn('[FirebaseAIService] App Check error during streaming, switching to fallback mode');
                        await this.initializeFallbackMode();
                        return this.streamWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools);
                    }
                    throw this.handleError(error);
                }
            }, 3, 1000, options?.signal); // Pass signal to withRetry
        });
    }

    /**
     * Stream content using direct Gemini SDK (fallback mode).
     * This bypasses Firebase AI SDK and App Check requirements.
     */
    private async streamWithFallback(
        prompt: string | Content[],
        modelName: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }

        const model = this.fallbackClient.getGenerativeModel({
            model: modelName,
            generationConfig: config as unknown as undefined,
            systemInstruction: systemInstruction,
            tools: tools as unknown as undefined,
            safetySettings: STANDARD_SAFETY_SETTINGS as any
        });

        const result = await model.generateContentStream(
            typeof prompt === 'string'
                ? prompt
                : { contents: prompt as unknown as Content[] } as unknown as string,
            options
        );

        // Wrap the final response promise
        const wrappedResponsePromise = result.response.then(async (aggResult) => {
            return {
                response: aggResult as unknown as GenerateContentResponse,
                text: () => aggResult.text?.() ?? '',
                functionCalls: () => {
                    const part = aggResult.candidates?.[0]?.content?.parts?.find((p: unknown): p is FunctionCallPart =>
                        typeof p === 'object' && p !== null && 'functionCall' in p
                    );
                    return part ? [part.functionCall] : [];
                },
                usage: () => aggResult.usageMetadata
            };
        });

        const stream = new ReadableStream<StreamChunk>({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        controller.enqueue({
                            text: () => {
                                try { return chunk.text(); } catch { return ''; }
                            },
                            functionCalls: () => {
                                const part = chunk.candidates?.[0]?.content?.parts?.find((p: unknown): p is FunctionCallPart =>
                                    typeof p === 'object' && p !== null && 'functionCall' in p
                                );
                                return part ? [part.functionCall] : [];
                            }
                        });
                    }
                    controller.close();
                } catch (streamError) {
                    controller.error(streamError);
                }
            }
        });

        return { stream, response: wrappedResponsePromise };
    }

    /**
     * CORE: Generate content and return Result Object (Used by AIService)
     */
    async generateContent(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal }
    ): Promise<GenerateContentResult> {
        return this.rawGenerateContent(prompt, modelOverride, config, systemInstruction, tools, options);
    }


    /**
     * CORE: Generate content stream(Used by AIService)
     */
    async generateContentStream(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        return this.rawGenerateContentStream(prompt, modelOverride, config, systemInstruction, tools, options);
    }

    /**
     * HIGH LEVEL: Generate text with optional thinking budget and system instruction.
     */
    async generateText(
        prompt: string | Part[],
        thinkingBudgetOrModel?: number | string,
        systemInstructionOrConfig?: string | Record<string, unknown>
    ): Promise<string> {
        await this.ensureInitialized();
        let model: string | undefined;
        let config: Record<string, unknown> = {};
        let systemInstruction: string | undefined;

        if (typeof thinkingBudgetOrModel === 'number') {
            config.thinkingConfig = { thinkingBudget: thinkingBudgetOrModel };
            systemInstruction = typeof systemInstructionOrConfig === 'string' ? systemInstructionOrConfig : undefined;
        } else if (typeof thinkingBudgetOrModel === 'string') {
            model = thinkingBudgetOrModel;
            if (typeof systemInstructionOrConfig === 'string') {
                systemInstruction = systemInstructionOrConfig;
            } else {
                config = systemInstructionOrConfig || {};
                systemInstruction = (config as any).systemInstruction;
            }
        }

        const modelName = model || this.getModelName();
        const cacheKey = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

        // Semantic Cache Check
        const cached = await aiCache.get(cacheKey, modelName, config);
        if (cached) return cached;

        const result = await this.rawGenerateContent(
            typeof prompt === 'string' ? prompt : [{ role: 'user', parts: prompt }],
            modelName,
            config,
            systemInstruction
        );

        const text = result.response.text();
        await aiCache.set(cacheKey, text, modelName, config);
        return text;
    }

    /**
     * HIGH LEVEL: Generate structured data from a prompt/parts and schema.
     */
    async generateStructuredData<T>(
        prompt: string | Part[],
        schema: Schema,
        thinkingBudget?: number,
        systemInstruction?: string,
        modelOverride?: string
    ): Promise<T> {
        await this.ensureInitialized();
        const config: GenerationConfig = {
            responseMimeType: 'application/json',
            responseSchema: schema
        };
        if (thinkingBudget) {
            config.thinkingConfig = { thinkingBudget };
        }

        const modelName = modelOverride || this.getModelName();
        const cacheKeyString = (typeof prompt === 'string' ? prompt : JSON.stringify(prompt)) + JSON.stringify(schema) + modelName;

        const cached = await aiCache.get(cacheKeyString, modelName, config);
        if (cached) {
            try {
                return JSON.parse(cached) as T;
            } catch (_e) {
                // Ignore parse failure
            }
        }

        const result = await this.rawGenerateContent(
            typeof prompt === 'string' ? prompt : [{ role: 'user', parts: prompt }],
            modelName,
            config,
            systemInstruction
        );

        const text = result.response.text();
        await aiCache.set(cacheKeyString, text, modelName, config);
        return JSON.parse(text) as T;
    }

    /**
     * HIGH LEVEL: Multi-turn chat.
     */
    async chat(
        history: ChatMessage[],
        newMessage: string,
        systemInstruction?: string
    ): Promise<string> {
        await this.ensureInitialized();
        const contents: Content[] = history.map(h => ({
            role: h.role,
            parts: h.parts
        }));
        contents.push({ role: 'user', parts: [{ text: newMessage }] });

        const result = await this.rawGenerateContent(
            contents,
            this.model!.model,
            {},
            systemInstruction
        );

        return result.response.text();
    }

    /**
     * MULTIMODAL: Analyze an image (base64).
     */
    async analyzeImage(
        prompt: string,
        imageBase64: string,
        mimeType: string = 'image/jpeg'
    ): Promise<string> {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imagePart: Part = {
            inlineData: { data: base64Data, mimeType }
        };

        const result = await this.rawGenerateContent([{ role: 'user', parts: [{ text: prompt }, imagePart] }]);
        return result.response.text();
    }

    /**
     * MULTIMODAL: Analyze generic parts (Video, Audio, PDF).
     */
    async analyzeMultimodal(
        prompt: string,
        parts: Part[]
    ): Promise<string> {
        const result = await this.rawGenerateContent([{ role: 'user', parts: [{ text: prompt }, ...parts] }]);
        return result.response.text();
    }

    /**
     * ADVANCED: Grounding with Google Search.
     */
    async generateGroundedContent(prompt: string): Promise<GenerateContentResult> {
        await this.ensureInitialized();
        return this.rawGenerateContent(prompt, this.model!.model, {}, undefined, [{ googleSearch: {} }] as unknown as Tool[]);
    }

    /**
     * ADVANCED: Live API for real-time bi-directional communication.
     * NOTE: Live API is not available in fallback mode (requires Firebase AI SDK with App Check)
     */
    async getLiveModel(systemInstruction?: string): Promise<LiveGenerativeModel> {
        await this.ensureInitialized();

        // Live API is Firebase-specific and not available in fallback mode
        if (this.useFallbackMode) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Live API is not available without App Check configuration. Please configure VITE_FIREBASE_APP_CHECK_KEY.'
            );
        }

        const firebaseAI = getFirebaseAI();
        if (!firebaseAI) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Firebase AI not initialized. Live API requires App Check.'
            );
        }

        return getLiveGenerativeModel(firebaseAI, {
            model: AI_MODELS.TEXT.AGENT,
            systemInstruction
        });
    }

    /**
     * HIGH LEVEL: Generate video using backend proxy (via synchronous polling of Async Job)
     */
    async generateVideo(options: GenerateVideoRequest & { timeoutMs?: number }): Promise<string> {
        return this.mediaBreaker.execute(async () => {
            const { db } = await import('@/services/firebase');
            const { doc, getDoc } = await import('firebase/firestore');

            const triggerVideoJobFn = httpsCallable<GenerateVideoRequest, GenerateVideoResponse>(functions, 'triggerVideoJob');
            const jobId = generateSecureId('job', 9);

            // 1. Trigger the background job
            await this.withRetry(() => triggerVideoJobFn({
                jobId,
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                ...options.config
            }));

            // 2. Poll for completion with dynamic timeout (FIX #7: using shared config)
            const { calculateVideoTimeout, AI_CONFIG } = await import('@/core/config/ai-models');
            const durationSeconds = options.config?.durationSeconds || AI_CONFIG.VIDEO.DEFAULT_DURATION_SECONDS;
            const timeoutMs = options.timeoutMs || calculateVideoTimeout(durationSeconds);
            const pollInterval = 1000;
            const maxAttempts = Math.ceil(timeoutMs / pollInterval);

            let attempts = 0;

            while (attempts < maxAttempts) {
                const jobRef = doc(db, 'videoJobs', jobId);
                const jobSnap = await getDoc(jobRef);

                if (jobSnap.exists()) {
                    const data = jobSnap.data();
                    if (data?.status === 'complete' && data.videoUrl) {
                        return data.videoUrl;
                    }
                    if (data?.status === 'failed') {
                        throw new AppException(
                            AppErrorCode.INTERNAL_ERROR,
                            `Video generation failed: ${data.error || 'Unknown error'}`
                        );
                    }
                }

                await new Promise(r => setTimeout(r, pollInterval));
                attempts++;
            }

            throw new AppException(
                AppErrorCode.TIMEOUT,
                'Video generation timed out'
            );
        });
    }

    /**
     * BATCHING: Embed multiple documents in parallel
     */
    async batchEmbedContents(
        contents: Content[],
        modelOverride?: string
    ): Promise<number[][]> {
        return this.contentBreaker.execute(async () => {
            await this.ensureInitialized();

            const userId = auth.currentUser?.uid;
            if (userId) {
                await TokenUsageService.checkQuota(userId);
            }

            const modelName = modelOverride || 'text-embedding-004';

            // FALLBACK MODE: Use direct Gemini SDK
            if (this.useFallbackMode && this.fallbackClient) {
                const model = this.fallbackClient.getGenerativeModel({ model: modelName });
                const promises = contents.map(async (c) => {
                    const result = await model.embedContent(c as unknown as string);
                    return result.embedding.values;
                });
                return Promise.all(promises);
            }

            // NORMAL MODE: Use Firebase AI SDK
            const firebaseAI = getFirebaseAI();
            if (!firebaseAI) {
                console.warn('[FirebaseAIService] Firebase AI not available for embeddings (batch), switching to fallback');
                await this.initializeFallbackMode();
                return this.batchEmbedContents(contents, modelOverride);
            }

            const modelCallback = getGenerativeModel(firebaseAI, { model: modelName });

            try {
                // If batchEmbedContents is available, use it
                // Otherwise fall back to Promise.all
                const modelExtended = modelCallback as ExtendedGenerativeModel;

                if (typeof modelExtended.batchEmbedContents === 'function') {
                    const requests = contents.map(c => ({ content: c }));
                    const result = await modelExtended.batchEmbedContents({ requests });
                    return result.embeddings.map((e) => e.values);
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
                if (isAppCheckError(error) && !this.useFallbackMode) {
                    console.warn('[FirebaseAIService] App Check error during batch embedding, switching to fallback mode');
                    await this.initializeFallbackMode();
                    return this.batchEmbedContents(contents, modelOverride);
                }
                throw this.handleError(error);
            }
        });
    }

    /**
     * HIGH LEVEL: Generate image using backend proxy
     */
    async generateImage(prompt: string, model: string = 'gemini-3-pro-image-preview', config?: Record<string, unknown>): Promise<string> {
        return this.mediaBreaker.execute(async () => {
            // Lazily import to avoid circular dependencies or initialization issues
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { app } = await import('@/services/firebase');

            // Explicitly use us-west1 where the function is deployed
            const functionsWest1 = getFunctions(app, 'us-west1');

            // Backend expects flat parameters, not nested config objects
            interface GenerateImageBackendPayload {
                prompt: string;
                aspectRatio?: "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
                count?: number;
                images?: { mimeType: string; data: string }[];
            }

            const generateImageFn = httpsCallable<GenerateImageBackendPayload, GenerateImageResponse>(functionsWest1, 'generateImageV3');

            // Map frontend config to backend payload
            const payload: GenerateImageBackendPayload = {
                prompt,
                aspectRatio: (config?.aspectRatio as any) || undefined,
                count: (config?.numberOfImages as number) || (config?.candidateCount as number) || 1,
            };

            const response = await generateImageFn(payload);
            const image = response.data.images?.[0];
            if (!image) throw new Error('No image returned');
            return image.bytesBase64Encoded;
        });
    }

    /**
     * TTS: Generate speech from text using gemini-2.5-pro-tts
     */
    async generateSpeech(
        text: string,
        voice: string = 'Kore',
        modelOverride?: string
    ): Promise<GenerateSpeechResponse> {
        if (!text || text.trim().length === 0) {
            throw new AppException(AppErrorCode.INVALID_ARGUMENT, 'Cannot generate speech for empty text');
        }

        return this.mediaBreaker.execute(async () => {
            await this.ensureInitialized();

            const modelName = modelOverride || AI_MODELS.AUDIO.PRO;

            const config: GenerationConfig = {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice
                        }
                    }
                }
            };

            // FALLBACK MODE: Use direct Gemini SDK
            if (this.useFallbackMode && this.fallbackClient) {
                try {
                    const model = this.fallbackClient.getGenerativeModel({
                        model: modelName,
                        generationConfig: config as unknown as undefined
                    });

                    const result = await model.generateContent(text);
                    const candidates = result.response.candidates;

                    if (!candidates || candidates.length === 0) {
                        throw new Error('No candidates returned from TTS fallback model');
                    }

                    const audioPart = candidates[0].content?.parts?.find(p => p && 'inlineData' in p && p.inlineData?.mimeType.startsWith('audio/'));

                    if (!audioPart || !audioPart.inlineData) {
                        throw new Error('No audio data found in fallback response parts');
                    }

                    return {
                        audio: {
                            inlineData: {
                                mimeType: audioPart.inlineData.mimeType,
                                data: audioPart.inlineData.data
                            }
                        }
                    };
                } catch (error) {
                    throw this.handleError(error);
                }
            }

            // NORMAL MODE: Use Firebase AI SDK
            const firebaseAI = getFirebaseAI();

            // Auto-switch to fallback if Firebase AI is missing
            if (!firebaseAI) {
                console.warn('[FirebaseAIService] Firebase AI not available for speech, switching to fallback');
                await this.initializeFallbackMode();
                return this.generateSpeech(text, voice, modelOverride);
            }

            const modelCallback = getGenerativeModel(firebaseAI, {
                model: modelName,
                generationConfig: config as unknown as Record<string, unknown>
            });

            try {
                const result = await modelCallback.generateContent(text);
                const candidates = result.response.candidates;

                if (!candidates || candidates.length === 0) {
                    throw new Error('No candidates returned from TTS model');
                }

                const audioPart = candidates[0].content?.parts?.find(p => p && 'inlineData' in p && p.inlineData?.mimeType.startsWith('audio/')) as InlineDataPart | undefined;

                if (!audioPart || !audioPart.inlineData) {
                    throw new Error('No audio data found in response parts');
                }

                return {
                    audio: {
                        inlineData: {
                            mimeType: audioPart.inlineData.mimeType,
                            data: audioPart.inlineData.data
                        }
                    }
                };
            } catch (error) {
                // If we hit an App Check error during normal mode, switch to fallback
                if (isAppCheckError(error) && !this.useFallbackMode) {
                    console.warn('[FirebaseAIService] App Check error during speech, switching to fallback mode');
                    await this.initializeFallbackMode();
                    return this.generateSpeech(text, voice, modelOverride);
                }
                throw this.handleError(error);
            }
        });
    }

    /**
     * CORE: Embed content
     */

    async embedContent(options: { model: string, content: Content }): Promise<{ values: number[] }> {
        return this.auxBreaker.execute(async () => {
            await this.ensureInitialized();

            // FALLBACK MODE: Use direct Gemini SDK
            if (this.useFallbackMode && this.fallbackClient) {
                try {
                    const model = this.fallbackClient.getGenerativeModel({
                        model: options.model
                    });
                    const result = await model.embedContent(options.content as unknown as string);
                    return { values: result.embedding.values };
                } catch (error) {
                    throw this.handleError(error);
                }
            }

            // NORMAL MODE: Use Firebase AI SDK
            const firebaseAI = getFirebaseAI();

            // Auto-switch to fallback if Firebase AI is missing
            if (!firebaseAI) {
                console.warn('[FirebaseAIService] Firebase AI not available for embeddings, switching to fallback');
                await this.initializeFallbackMode();
                return this.embedContent(options);
            }

            const modelCallback = getGenerativeModel(firebaseAI, {
                model: options.model
            });

            try {
                interface GenerativeModelWithEmbed {
                    embedContent(request: { content: Content }): Promise<{ embedding: { values: number[] } }>;
                }
                const result = await (modelCallback as unknown as GenerativeModelWithEmbed).embedContent({ content: options.content });
                return { values: result.embedding.values };
            } catch (error) {
                // If we hit an App Check error during normal mode, switch to fallback
                if (isAppCheckError(error) && !this.useFallbackMode) {
                    console.warn('[FirebaseAIService] App Check error during embedding, switching to fallback mode');
                    await this.initializeFallbackMode();
                    return this.embedContent(options);
                }
                throw this.handleError(error);
            }
        });
    }

    /**
     * HIGH LEVEL: Parse JSON from AI response
     */
    public parseJSON<T = unknown>(text: string | undefined): T | Record<string, never> {
        if (!text) return {};
        const clean = text.replace(/```json\n?|```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            return {} as T; // Best effort
        }
    }

    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
        if (!this.model && !this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service not properly initialized');
        }
    }

    private handleError(error: unknown): AppException {
        const msg = error instanceof Error ? error.message : String(error);

        // Handle abort signals explicitly (these are retryable)
        if (msg.includes('aborted') || msg.includes('signal is aborted') || msg.includes('AbortError')) {
            return new AppException(
                AppErrorCode.CANCELLED,
                'AI Request was cancelled or timed out. Please try again.',
                { retryable: true }
            );
        }

        // Handle Firebase Installations API specific errors (missing API config)
        if (msg.includes('Installations') || msg.includes('installations')) {
            return new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Firebase Installations API is disabled or restricted. Please enable it in Google Cloud Console.',
                { originalError: msg }
            );
        }

        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('permission-denied') || lowerMsg.includes('app-check-token')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'AI Verification Failed (App Check)');
        }
        if (msg.includes('Recaptcha')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'Client Verification Failed (ReCaptcha)');
        }

        // Detailed Quota & Rate Limit Mapping
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
            return new AppException(AppErrorCode.QUOTA_EXCEEDED, 'AI Quota Exceeded');
        }
        if (msg.includes('429')) {
            return new AppException(AppErrorCode.RATE_LIMITED, 'AI Rate Limit Exceeded');
        }

        // Service Availability
        if (msg.includes('503') || msg.includes('service unavailable') || msg.includes('overloaded')) {
            return new AppException(AppErrorCode.NETWORK_ERROR, 'AI Service Temporarily Unavailable');
        }

        return new AppException(AppErrorCode.INTERNAL_ERROR, `AI Service Failure: ${msg}`);
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        retries = 3,
        delay = 1000,
        signal?: AbortSignal
    ): Promise<T> {
        try {
            // Check signal before starting
            if (signal?.aborted) {
                throw new Error('Operation cancelled by user');
            }
            return await operation();
        } catch (error: unknown) {
            // If user explicitly cancelled, DO NOT retry
            if (signal?.aborted) {
                throw error;
            }

            const msg = error instanceof Error ? error.message : String(error);
            const lowerMsg = msg.toLowerCase();
            const isRetryable =
                lowerMsg.includes('429') ||
                lowerMsg.includes('503') ||
                lowerMsg.includes('service unavailable') ||
                lowerMsg.includes('temporarily unavailable') ||
                lowerMsg.includes('overloaded') ||
                // Retry abort/network errors (usually transient)
                lowerMsg.includes('aborted') ||
                lowerMsg.includes('fetch failed') ||
                lowerMsg.includes('network error') ||
                (error as { code?: string })?.code === 'resource-exhausted' ||
                (error as { details?: { retryable?: boolean } })?.details?.retryable;

            if (retries > 0 && isRetryable) {
                // Exponential backoff with jitter and 10s cap
                const backoff = Math.min(delay * 2, 10000) + (Math.random() * 200);
                // Wait for backoff, but listen for abort signal
                await new Promise((resolve, reject) => {
                    if (signal?.aborted) {
                        return reject(new Error('Operation cancelled by user during retry backoff'));
                    }
                    const timer = setTimeout(resolve, backoff);
                    if (signal) {
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            reject(new Error('Operation cancelled by user during retry backoff'));
                        }, { once: true });
                    }
                });
                return this.withRetry(operation, retries - 1, backoff, signal);
            }
            throw error;
        }
    }

    private sanitizePrompt(prompt: string | Content[]): string | Content[] {
        if (typeof prompt === 'string') {
            return InputSanitizer.sanitize(prompt);
        }

        if (Array.isArray(prompt)) {
            return prompt.map(content => ({
                role: content.role || 'user',
                parts: content.parts.map((part) => {
                    if ('text' in part && typeof part.text === 'string') {
                        return { ...part, text: InputSanitizer.sanitize(part.text) };
                    }
                    return part;
                })
            })) as Content[];
        }

        return prompt;
    }

    /**
     * Get circuit state for monitoring (internal/admin use)
     */
    public getCircuitStates(): Record<string, string> {
        return {
            content: this.contentBreaker.getState(),
            media: this.mediaBreaker.getState(),
            aux: this.auxBreaker.getState()
        };
    }
}

export const firebaseAI = new FirebaseAIService();
