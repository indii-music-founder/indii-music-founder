import {
    getGenerativeModel,
    getLiveGenerativeModel,
    LiveGenerativeModel,
    GenerateContentResult,
    GenerateContentStreamResult,
    Content,
    Part,
    Schema,
    Tool,
    SafetySetting as FirebaseSafetySetting
} from 'firebase/ai';
import { GoogleGenAI } from '@google/genai';
import { getFirebaseAI, remoteConfig } from '@/services/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { safeJsonParse } from '@/services/utils/json';
import { AI_MODELS, getModelKey } from '@/core/config/ai-models';
import { RemoteAIConfigSchema, DEFAULT_REMOTE_CONFIG, RemoteAIConfig } from './config/RemoteAIConfig';
import {
    FunctionCallPart,
    GenerateContentResponse,
    WrappedResponse,
    StreamChunk,
    GenerateVideoRequest,
    GenerateSpeechResponse,
    GenerateImageOptions,
    EmbedContentOptions,
    GenerationConfig,
    ContentPart,
    SafetySetting,
    ToolConfig,
    GenerateContentOptions,
} from '@/shared/types/ai.dto';

import { CircuitBreaker } from './utils/CircuitBreaker';
import { BREAKER_CONFIGS } from './config/breaker-configs';
import { STANDARD_SAFETY_SETTINGS } from './config/safety-settings';
import { InputSanitizer } from './utils/InputSanitizer';
import { TokenUsageService } from './billing/TokenUsageService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { CachedContextService } from './context/CachedContextService';
import { RateLimiter } from './RateLimiter';
import { secureRandomInt } from '@/utils/crypto-random';

// Extracted sub-modules
import { isAppCheckError, isAppCheckConfigured } from './appcheck';
import {
    initializeFallbackClient,
    generateWithFallback as fallbackGenerate,
    streamWithFallback as fallbackStream,
} from './fallback/FallbackClient';
import { generateVideo as mediaGenerateVideo } from './generators/MediaGenerator';
import {
    generateText as hlGenerateText,
    generateStructuredData as hlGenerateStructuredData,
    chat as hlChat,
    analyzeImage as hlAnalyzeImage,
    analyzeMultimodal as hlAnalyzeMultimodal,
    generateGroundedContent as hlGenerateGroundedContent,
    captionImage as hlCaptionImage,
    analyzeAudio as hlAnalyzeAudio,
    parseJSON as hlParseJSON,
} from './generators/HighLevelAPI';
import { generateImage as imgGenerate } from './generators/ImageGenerator';
import { generateSpeech as speechGenerate } from './generators/SpeechGenerator';
import {
    embedContent as embeddingEmbed,
    batchEmbedContents as embeddingBatchEmbed,
} from './generators/EmbeddingGenerator';
import type { AIContext } from './AIContext';
import type {
    FileDataPart,
    FirebaseModelOptions,
    ExtendedGenerativeModel,
    ChatMessage,
} from './types';

// Re-export ChatMessage for backward compatibility
export type { ChatMessage } from './types';

// Default model if remote config fails
const FALLBACK_MODEL = AI_MODELS.TEXT.FAST;

export class FirebaseAIService implements AIContext {
    public model: ExtendedGenerativeModel | null = null;
    private isInitialized = false;
    public defaultConfig: GenerationConfig = {};

    // Fallback mode: use direct Gemini SDK when App Check is not available
    public fallbackClient: GoogleGenAI | null = null;
    public useFallbackMode = false;
    public activeRequests: Map<string, Promise<GenerateContentResult>> = new Map();

    // Default: 60 RPM (adjust based on quota)
    public rateLimiter: RateLimiter = new RateLimiter(60);

    // Circuit Breakers
    public contentBreaker = new CircuitBreaker(BREAKER_CONFIGS.CONTENT_GENERATION!);
    public mediaBreaker = new CircuitBreaker(BREAKER_CONFIGS.MEDIA_GENERATION!);
    public auxBreaker = new CircuitBreaker(BREAKER_CONFIGS.AUX_SERVICES!);

    // Dynamic Configuration
    public remoteConfig: RemoteAIConfig = DEFAULT_REMOTE_CONFIG;

    /**
     * Permanently switches the service to direct Gemini SDK for the current session.
     * This prevents infinite "AI Verification Failed" loops.
     */
    private async triggerGlobalFallback(): Promise<void> {
        if (!this.useFallbackMode) {
            logger.warn('[FirebaseAIService] Global fallback triggered (App Check non-responsive or failing)');
            await this.initializeFallbackMode();
        }
    }

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
            logger.warn('[FirebaseAIService] App Check not configured, using direct Gemini SDK fallback');
            await this.initializeFallbackMode();
            return;
        }

        try {
            // 1. Get Firebase AI instance (lazy initialized)
            const firebaseAI = getFirebaseAI();
            if (!firebaseAI) {
                logger.warn('[FirebaseAIService] Firebase AI not available, using fallback');
                await this.initializeFallbackMode();
                return;
            }

            // 2. Fetch Remote Config (Safe Mode) - NOW WITH DYNAMIC SCHEMA
            let modelName: string = FALLBACK_MODEL;
            try {
                if (!remoteConfig) {
                    throw new Error('remoteConfig not defined');
                }
                await fetchAndActivate(remoteConfig);

                // Get the old simple string (legacy)
                modelName = getValue(remoteConfig, 'model_name').asString() || FALLBACK_MODEL;

                // Get the new JSON config (modern)
                const jsonString = getValue(remoteConfig, 'ai_system_config').asString();
                if (jsonString) {
                    try {
                        const parsed = safeJsonParse(jsonString);
                        if (parsed) {
                            const validated = RemoteAIConfigSchema.safeParse(parsed);
                            if (validated.success) {
                                this.remoteConfig = validated.data;
                                logger.info('[FirebaseAIService] Loaded dynamic AI config from Remote Config');
                            } else {
                                logger.warn('[FirebaseAIService] Invalid remote config schema:', validated.error);
                            }
                        }
                    } catch (e: unknown) {
                        logger.warn('[FirebaseAIService] Failed to parse ai_system_config JSON:', e);
                    }
                }
            } catch (configError: unknown) {
                if (isAppCheckError(configError)) {
                    throw configError;
                }
                logger.warn('[FirebaseAIService] Failed to fetch remote config, using default model:', configError);
            }

            // 3. Initialize SDK
            this.model = getGenerativeModel(firebaseAI, {
                model: modelName,
                safetySettings: STANDARD_SAFETY_SETTINGS as FirebaseSafetySetting[]
            });

            if (!this.model) {
                throw new Error('Failed to create generative model instance');
            }

            this.isInitialized = true;
            logger.info('[FirebaseAIService] Initialized with Firebase AI SDK');

        } catch (error: unknown) {
            logger.error('[FirebaseAIService] Bootstrap failed, attempting fallback:', error);
            // If we hit an App Check error OR ANY initialization error, fall back to direct Gemini SDK
            try {
                await this.initializeFallbackMode();
            } catch (fallbackError: unknown) {
                throw this.handleError(fallbackError);
            }
        }
    }

    /**
     * Initialize fallback mode using direct Gemini SDK (no App Check required).
     * This is used in development or when App Check is not configured.
     * Delegates to the extracted FallbackClient module.
     */
    public async initializeFallbackMode(): Promise<void> {
        this.fallbackClient = await initializeFallbackClient();
        this.useFallbackMode = true;
        this.isInitialized = true;
    }

    /**
     * Get the model name, either from remote config or fallback
     * Handles DYNAMIC INTERCEPTION/REPLACEMENT of models.
     */
    public getModelName(modelOverride?: string): string {
        // If the user provided a specific override, checking if WE want to override THAT.
        // But usually, an explicit override in code means "I need this specific model".
        // HOWEVER, for "system" defined constants, we might want to swap them too.

        const candidateModel = modelOverride || this.model?.model || FALLBACK_MODEL;

        // Try to reverse-lookup the key (e.g. "gemini-3.1-pro-preview" -> "TEXT_AGENT")
        const configKey = getModelKey(candidateModel);

        if (configKey) {
            // Check if we have a remote override for this key
            const remoteOverride = this.remoteConfig.overrides[configKey];
            if (remoteOverride) {
                // logger.debug(`[FirebaseAIService] Swapping ${configKey}: ${candidateModel} -> ${remoteOverride}`);
                return remoteOverride;
            }
        }

        return candidateModel;
    }

    async rawGenerateContent(
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
    ): Promise<GenerateContentResult> {
        const modelName = this.getModelName(modelOverride);
        const mergedConfig = { ...this.defaultConfig, ...config };

        // SAFETY: Extract non-generation fields that callers may have mixed into config.
        // e.g. onboardingService passes { systemInstruction, tools, ...thinkingConfig } as config.
        // These must NOT end up in generationConfig or the API will reject with 400.
        const configRecord = mergedConfig as Record<string, unknown>;
        if (!systemInstruction && typeof configRecord.systemInstruction === 'string') {
            systemInstruction = configRecord.systemInstruction as string;
        }
        if (!tools && Array.isArray(configRecord.tools)) {
            tools = configRecord.tools as Tool[];
        }
        delete configRecord.systemInstruction;
        delete configRecord.tools;
        delete configRecord.toolConfig;
        delete configRecord.safetySettings;

        // Remove thinkingConfig for models that don't support it (e.g., gemini-2.5-pro)
        const supportsThinking = modelName.includes('gemini-3') || modelName.includes('gemini-2.0-pro-exp');
        if (!supportsThinking) {
            delete configRecord.thinkingConfig;
        }

        // 1. Request Coalescing & Cache Key
        // Create a lean key that avoids stringifying large binary data
        const leanPrompt = Array.isArray(prompt)
            ? prompt.map(p => ({
                ...p,
                parts: p.parts.map(part => {
                    if ('inlineData' in part && part.inlineData) {
                        const { mimeType, data } = part.inlineData;
                        const dataLen = data?.length || 0;
                        const snippet = dataLen > 32
                            ? `${data.substring(0, 16)}...${data.substring(dataLen - 16)}`
                            : data;
                        return { ...part, inlineData: { mimeType, data: `[REDACTED:${mimeType}:${dataLen}:${snippet}]` } };
                    }
                    return part;
                })
            }))
            : typeof prompt === 'string' ? prompt : '[COMPLEX_OBJECT]';

        const cacheKey = JSON.stringify({ leanPrompt, modelName, config: mergedConfig, systemInstruction });

        if (!options?.skipCache && this.activeRequests.has(cacheKey)) {
            // logger.debug(`[FirebaseAIService] Coalescing request for ${modelName}`);
            return this.activeRequests.get(cacheKey)!;
        }

        const executeRequest = async (): Promise<GenerateContentResult> => {
            // Create an internal AbortController for timeout if specified
            const timeoutController = new AbortController();
            let timeoutId: NodeJS.Timeout | number | undefined;

            if (options?.timeout && options.timeout > 0) {
                timeoutId = setTimeout(() => {
                    timeoutController.abort('TIMEOUT');
                }, options.timeout);
            }

            // Combine with user signal if provided
            if (options?.signal) {
                options.signal.addEventListener('abort', () => timeoutController.abort(options.signal?.reason || 'CANCELLED'));
            }

            const internalSignal = timeoutController.signal;

            try {
                // 2. Rate Limiting (Client Side)
                await this.rateLimiter.acquire(30000);

                return this.contentBreaker.execute(async () => {
                    return this.withRetry(async () => {
                        // Check if already aborted
                        if (internalSignal.aborted) {
                            if (internalSignal.reason === 'TIMEOUT') {
                                throw new AppException(AppErrorCode.TIMEOUT, `AI Request timed out after ${options?.timeout}ms`);
                            }
                            throw new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user');
                        }
                        await this.ensureInitialized();

                        // 3. Quota & Rate Limit (Backend)
                        const userId = auth.currentUser?.uid;
                        if (userId) {
                            await TokenUsageService.checkQuota(userId);
                            await TokenUsageService.checkRateLimit(userId);
                        }

                        // 4. Sanitize & Prepare Prompt
                        const sanitizedPrompt = this.sanitizePrompt(prompt);

                        // 5. Inject thoughtSignature if present (Critical for Gemini 3 function calling)
                        if (options?.thoughtSignature && Array.isArray(sanitizedPrompt) && sanitizedPrompt.length > 0) {
                            const lastContent = sanitizedPrompt[sanitizedPrompt.length - 1]!;
                            if (lastContent.parts.length > 0) {
                                const lastPartIdx = lastContent.parts.length - 1;
                                (lastContent.parts[lastPartIdx] as ContentPart).thoughtSignature = options.thoughtSignature;
                            }
                        }

                        // 6. Auto-detect high-fidelity media requirements for audio payloads
                        let hasAudio = false;
                        const contentsToCheck = Array.isArray(sanitizedPrompt)
                            ? sanitizedPrompt
                            : [{ parts: [{ text: sanitizedPrompt as string }] }];

                        for (const c of contentsToCheck as Content[]) {
                            if (c.parts) {
                                for (const p of c.parts) {
                                    if (('inlineData' in p && p.inlineData && p.inlineData.mimeType?.startsWith('audio/')) ||
                                        ('fileData' in p && (p as unknown as FileDataPart).fileData && (p as unknown as FileDataPart).fileData.mimeType?.startsWith('audio/'))) {
                                        hasAudio = true;
                                        break;
                                    }
                                }
                            }
                            if (hasAudio) break;
                        }

                        if (hasAudio && !mergedConfig.mediaResolution) {
                            mergedConfig.mediaResolution = 'MEDIA_RESOLUTION_HIGH';
                        }

                        // 7. Normal vs Fallback Generation
                        const result = await (async () => {
                            // FALLBACK MODE
                            if (this.useFallbackMode && this.fallbackClient) {
                                const fallbackTools = tools ? JSON.parse(JSON.stringify(tools)) : undefined;
                                return this.generateWithFallback(sanitizedPrompt, modelName, mergedConfig, systemInstruction, fallbackTools, options?.safetySettings, options?.toolConfig, { signal: internalSignal });
                            }

                            // NORMAL MODE
                            let cachedContent = options?.cachedContent;
                            if (!cachedContent && systemInstruction && CachedContextService.shouldCache(systemInstruction)) {
                                const hash = CachedContextService.generateHash(systemInstruction, tools);
                                const existingCache = await CachedContextService.findCache(hash);
                                if (existingCache) {
                                    cachedContent = existingCache;
                                }
                            }

                            // Deep clone tools to prevent SDK from freezing the caller's array across iterations
                            let clonedTools: Tool[] | undefined = undefined;
                            if (tools) {
                                try {
                                    clonedTools = JSON.parse(JSON.stringify(tools));
                                } catch (_e) {
                                    clonedTools = tools;
                                }
                            }

                            const modelOptions = {
                                model: modelName,
                                generationConfig: mergedConfig as unknown as Record<string, unknown>,
                                systemInstruction,
                                tools: clonedTools,
                                toolConfig: options?.toolConfig,
                                safetySettings: options?.safetySettings || STANDARD_SAFETY_SETTINGS
                            };

                            if (cachedContent) {
                                (modelOptions as FirebaseModelOptions).cachedContent = cachedContent;
                            }

                            const modelCallback = getGenerativeModel(getFirebaseAI()!, modelOptions as unknown as Parameters<typeof getGenerativeModel>[1]);
                            try {
                                return await (modelCallback as unknown as { generateContent(req: string | { contents: Content[] }, opts?: { signal?: AbortSignal }): Promise<GenerateContentResult> }).generateContent(
                                    typeof sanitizedPrompt === 'string'
                                        ? sanitizedPrompt
                                        : { contents: sanitizedPrompt as Content[] },
                                    { signal: internalSignal }
                                );
                            } catch (error: unknown) {
                                if (isAppCheckError(error) && !this.useFallbackMode) {
                                    await this.triggerGlobalFallback();
                                    return this.generateWithFallback(sanitizedPrompt, modelName, mergedConfig, systemInstruction, tools, options?.safetySettings, options?.toolConfig, { signal: internalSignal });
                                }
                                throw this.handleError(error);
                            }
                        })();

                        // 8. Track Usage
                        if (userId && result?.response?.usageMetadata) {
                            await TokenUsageService.trackUsage(
                                userId,
                                modelName,
                                result.response.usageMetadata.promptTokenCount || 0,
                                result.response.usageMetadata.candidatesTokenCount || 0
                            );
                        }

                        return result;
                    }, 3, 1000, internalSignal);
                });
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        };

        const requestPromise = executeRequest();
        this.activeRequests.set(cacheKey, requestPromise);
        requestPromise.finally(() => {
            if (this.activeRequests.get(cacheKey) === requestPromise) {
                this.activeRequests.delete(cacheKey);
            }
        }).catch(() => { });

        return requestPromise;
    }

    /**
     * Generate content using direct Gemini SDK (fallback mode).
     * This bypasses Firebase AI SDK and App Check requirements.
     * Uses the new @google/genai SDK (GA).
     */
    private async generateWithFallback(
        prompt: string | Content[],
        modelName: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        safetySettings?: SafetySetting[],
        toolConfig?: ToolConfig,
        options?: { signal?: AbortSignal }
    ): Promise<GenerateContentResult> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }
        return fallbackGenerate(
            this.fallbackClient, prompt, modelName, config,
            systemInstruction, tools, safetySettings, toolConfig,
            options, (e) => this.handleError(e)
        );
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
        options?: {
            signal?: AbortSignal;
            safetySettings?: SafetySetting[];
            toolConfig?: ToolConfig;
            thoughtSignature?: string;
            timeout?: number;
        }
    ): Promise<{ stream: ReadableStream<StreamChunk>; response: Promise<WrappedResponse> }> {
        const modelName = this.getModelName(modelOverride);
        const mergedConfig = { ...this.defaultConfig, ...config };

        // SAFETY: Extract non-generation fields that callers may have mixed into config.
        const streamConfigRecord = mergedConfig as Record<string, unknown>;
        if (!systemInstruction && typeof streamConfigRecord.systemInstruction === 'string') {
            systemInstruction = streamConfigRecord.systemInstruction as string;
        }
        if (!tools && Array.isArray(streamConfigRecord.tools)) {
            tools = streamConfigRecord.tools as Tool[];
        }
        delete streamConfigRecord.systemInstruction;
        delete streamConfigRecord.tools;
        delete streamConfigRecord.toolConfig;
        delete streamConfigRecord.safetySettings;

        // Remove thinkingConfig for models that don't support it
        const supportsThinking = modelName.includes('gemini-3') || modelName.includes('gemini-2.0-pro-exp');
        if (!supportsThinking) {
            delete streamConfigRecord.thinkingConfig;
        }

        // Create an internal AbortController for timeout if specified
        const timeoutController = new AbortController();
        let timeoutId: NodeJS.Timeout | number | undefined;

        if (options?.timeout && options.timeout > 0) {
            timeoutId = setTimeout(() => {
                timeoutController.abort('TIMEOUT');
            }, options.timeout);
        }

        // Combine with user signal if provided
        if (options?.signal) {
            options.signal.addEventListener('abort', () => timeoutController.abort(options.signal?.reason || 'CANCELLED'));
        }

        const internalSignal = timeoutController.signal;

        try {
            return this.contentBreaker.execute(async () => {
                return this.withRetry(async () => {
                    if (internalSignal.aborted) {
                        if (internalSignal.reason === 'TIMEOUT') {
                            throw new AppException(AppErrorCode.TIMEOUT, `AI Request timed out after ${options?.timeout}ms`);
                        }
                        throw new AppException(AppErrorCode.CANCELLED, 'AI Request was cancelled by user');
                    }
                    await this.ensureInitialized();

                    // 1. Quota & Rate Limit (Backend)
                    const userId = auth.currentUser?.uid;
                    if (userId) {
                        await TokenUsageService.checkQuota(userId);
                        await TokenUsageService.checkRateLimit(userId);
                    }

                    // 2. Sanitize & Prepare Prompt
                    const sanitizedPrompt = this.sanitizePrompt(prompt);

                    // 3. Inject thoughtSignature if present
                    if (options?.thoughtSignature && Array.isArray(sanitizedPrompt) && sanitizedPrompt.length > 0) {
                        const lastContent = sanitizedPrompt[sanitizedPrompt.length - 1]!;
                        if (lastContent.parts.length > 0) {
                            const lastPartIdx = lastContent.parts.length - 1;
                            (lastContent.parts[lastPartIdx] as ContentPart).thoughtSignature = options.thoughtSignature;
                        }
                    }

                    // 4. Case analysis for Normal vs Fallback
                    if (this.useFallbackMode && this.fallbackClient) {
                        return this.streamWithFallback(sanitizedPrompt, modelName, mergedConfig, systemInstruction, tools, { ...options, signal: internalSignal });
                    }

                    // Normal Mode setup
                    let cachedContent: string | undefined = undefined;
                    if (systemInstruction && CachedContextService.shouldCache(systemInstruction)) {
                        const hash = CachedContextService.generateHash(systemInstruction, tools);
                        const existingCache = await CachedContextService.findCache(hash);
                        if (existingCache) {
                            cachedContent = existingCache;
                        }
                    }

                    const modelOptions: Record<string, unknown> = {
                        model: modelName,
                        generationConfig: mergedConfig,
                        systemInstruction,
                        tools,
                        toolConfig: options?.toolConfig,
                        safetySettings: options?.safetySettings || STANDARD_SAFETY_SETTINGS
                    };

                    if (cachedContent) {
                        modelOptions.cachedContent = cachedContent;
                    }

                    const modelCallback = getGenerativeModel(getFirebaseAI()!, modelOptions as unknown as Parameters<typeof getGenerativeModel>[1]);

                    try {
                        const result: GenerateContentStreamResult = await (modelCallback as unknown as { generateContentStream(req: string | { contents: Content[] }, opts?: { signal?: AbortSignal }): Promise<GenerateContentStreamResult> }).generateContentStream(
                            typeof sanitizedPrompt === 'string' ? sanitizedPrompt : { contents: sanitizedPrompt as Content[] },
                            { signal: internalSignal }
                        );

                        // Accumulate chunks for the final WrappedResponse
                        let finalText = '';
                        const chunks: GenerateContentResponse[] = [];

                        const transformedStream = new ReadableStream<StreamChunk>({
                            async start(controller) {
                                try {
                                    for await (const chunk of result.stream) {
                                        chunks.push(chunk as unknown as GenerateContentResponse);
                                        const part = chunk.candidates?.[0]?.content?.parts?.[0] || chunk;
                                        const partWithText = part as unknown as { text?: string | (() => string) };
                                        const chunkText = typeof partWithText.text === 'function'
                                            ? partWithText.text()
                                            : (partWithText.text || '');
                                        finalText += chunkText;

                                        const firstPart = chunk.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
                                        const thoughtSignature = firstPart && 'thoughtSignature' in firstPart ? (firstPart as ContentPart).thoughtSignature : undefined;

                                        controller.enqueue({
                                            text: () => chunkText,
                                            thoughtSignature,
                                            functionCalls: () => {
                                                const parts = chunk.candidates?.[0]?.content?.parts || [];
                                                return parts
                                                    .filter(p => 'functionCall' in p)
                                                    .map(p => (p as FunctionCallPart).functionCall);
                                            }
                                        });
                                    }
                                    controller.close();
                                } catch (e: unknown) {
                                    controller.error(e);
                                }
                            }
                        });

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
                                } catch (e: unknown) {
                                    logger.warn('[FirebaseAIService] Failed to track usage for stream:', e);
                                }
                            }

                            // Extract thoughtSignature from first chunk if available
                            const firstWithSignature = chunks.find(c => {
                                const part = c.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
                                return part && 'thoughtSignature' in part && (part as ContentPart).thoughtSignature;
                            });
                            const signature = firstWithSignature?.candidates?.[0]?.content?.parts?.[0]?.thoughtSignature;

                            return {
                                response: aggResult as unknown as GenerateContentResponse,
                                text: () => finalText,
                                functionCalls: () => {
                                    const parts = aggResult.candidates?.[0]?.content?.parts || [];
                                    return parts
                                        .filter(p => 'functionCall' in p)
                                        .map(p => (p as FunctionCallPart).functionCall);
                                },
                                usage: () => aggResult.usageMetadata,
                                thoughtSignature: signature
                            };
                        });

                        return { stream: transformedStream, response: wrappedResponsePromise };
                    } catch (error: unknown) {
                        if (isAppCheckError(error) && !this.useFallbackMode) {
                            await this.triggerGlobalFallback();
                            return this.streamWithFallback(sanitizedPrompt, modelName, mergedConfig, systemInstruction, tools, { ...options, signal: internalSignal });
                        }
                        throw this.handleError(error);
                    }
                }, 3, 1000, internalSignal);
            });
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    /**
     * Stream content using direct Gemini SDK (fallback mode).
     * This bypasses Firebase AI SDK and App Check requirements.
     * Uses the new @google/genai SDK (GA).
     */
    private async streamWithFallback(
        prompt: string | Content[],
        modelName: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }
        return fallbackStream(
            this.fallbackClient, prompt, modelName, config,
            systemInstruction, tools, options
        );
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
        options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig, thoughtSignature?: string, timeout?: number }
    ): Promise<GenerateContentResult> {
        // [DEBUG] Log payload for deep diagnosis
        try {
            // Security: Redact PII from logs
            const sanitizedForLog = this.sanitizePrompt(prompt);
            logger.debug('[DEBUG-PAYLOAD] modelName:', modelOverride || this.getModelName());
            logger.debug('[DEBUG-PAYLOAD] prompt:', JSON.stringify(sanitizedForLog).substring(0, 500) + "...");
            logger.debug('[DEBUG-PAYLOAD] config:', JSON.stringify(config));
        } catch (_e: unknown) { /* Ignore logging errors */ }

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
        options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        return this.rawGenerateContentStream(prompt, modelOverride, config, systemInstruction, tools, options);
    }

    /**
     * HIGH LEVEL: Generate text with optional thinking budget and system instruction.
     * @see generators/HighLevelAPI.ts
     */
    async generateText(
        prompt: string | Part[],
        thinkingBudgetOrModelOrConfig?: number | string | Record<string, unknown>,
        systemInstructionOrConfig?: string | Record<string, unknown>
    ): Promise<string> {
        return hlGenerateText(this, prompt, thinkingBudgetOrModelOrConfig, systemInstructionOrConfig);
    }

    /**
     * HIGH LEVEL: Generate structured data from a prompt/parts and schema.
     * @see generators/HighLevelAPI.ts
     */
    async generateStructuredData<T>(
        promptOrOptions: string | Part[] | GenerateContentOptions,
        schemaOrConfig?: Schema | Record<string, unknown>,
        thinkingBudgetOrConfig?: number | Record<string, unknown>,
        systemInstruction?: string,
        modelOverride?: string
    ): Promise<T> {
        return hlGenerateStructuredData<T>(this, promptOrOptions, schemaOrConfig, thinkingBudgetOrConfig, systemInstruction, modelOverride);
    }

    /**
     * HIGH LEVEL: Multi-turn chat.
     * @see generators/HighLevelAPI.ts
     */
    async chat(
        history: ChatMessage[],
        newMessage: string,
        systemInstruction?: string
    ): Promise<string> {
        return hlChat(this, history, newMessage, systemInstruction);
    }

    /**
     * MULTIMODAL: Analyze an image (base64).
     * @see generators/HighLevelAPI.ts
     */
    async analyzeImage(
        prompt: string,
        imageBase64: string,
        mimeType: string = 'image/jpeg'
    ): Promise<string> {
        return hlAnalyzeImage(this, prompt, imageBase64, mimeType);
    }

    /**
     * MULTIMODAL: Analyze generic parts (Video, Audio, PDF).
     * @see generators/HighLevelAPI.ts
     */
    async analyzeMultimodal(
        prompt: string,
        parts: Part[]
    ): Promise<string> {
        return hlAnalyzeMultimodal(this, prompt, parts);
    }

    /**
     * ADVANCED: Grounding with Google Search.
     * @see generators/HighLevelAPI.ts
     */
    async generateGroundedContent(prompt: string, options?: { dynamicThreshold?: number }): Promise<GenerateContentResult> {
        return hlGenerateGroundedContent(this, prompt, options);
    }

    /**
     * MULTIMODAL: Caption an image.
     * @see generators/HighLevelAPI.ts
     */
    async captionImage(image: string | ArrayBuffer, prompt: string = 'Describe this image in detail...'): Promise<string> {
        return hlCaptionImage(this, image, prompt);
    }

    /**
     * HIGH LEVEL: Analyze audio content.
     * @see generators/HighLevelAPI.ts
     */
    async analyzeAudio(audio: string | ArrayBuffer, prompt: string = 'Analyze this audio content in detail...'): Promise<string> {
        return hlAnalyzeAudio(this, audio, prompt);
    }

    /**
     * UTILITY: Parse JSON from AI response, handling markdown code blocks.
     * @see generators/HighLevelAPI.ts
     */
    parseJSON<T = Record<string, unknown>>(text: string | undefined): T | Record<string, never> {
        return hlParseJSON<T>(text);
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
     * HIGH LEVEL: Generate video using @google/genai SDK directly (client-side Veo 3.1).
     * 
     * This bypasses Cloud Functions entirely by calling models.generateVideos()
     * from the @google/genai SDK, then polling the returned operation until done.
     * Matches the pattern used by image generation (direct SDK call, no backend proxy).
     */
    async generateVideo(options: GenerateVideoRequest & { timeoutMs?: number }): Promise<string> {
        return this.mediaBreaker.execute(async () => {
            await this.ensureInitialized();

            // Ensure we have the fallback client (direct @google/genai SDK)
            if (!this.fallbackClient) {
                await this.initializeFallbackMode();
            }

            if (!this.fallbackClient) {
                throw new AppException(
                    AppErrorCode.INTERNAL_ERROR,
                    'Video generation requires the Google GenAI SDK. Please configure VITE_API_KEY.'
                );
            }

            return mediaGenerateVideo(this.fallbackClient, options);
        });
    }

    /**
     * BATCHING: Embed multiple documents in parallel.
     * @see generators/EmbeddingGenerator.ts
     */
    async batchEmbedContents(
        contentsOrStrings: Content[] | string[],
        modelOverride?: string
    ): Promise<number[][]> {
        return embeddingBatchEmbed(this, contentsOrStrings, modelOverride);
    }

    /**
     * HIGH LEVEL: Generate image using Gemini 3 native image generation.
     * @see generators/ImageGenerator.ts
     */
    async generateImage(promptOrOptions: string | GenerateImageOptions, modelOverride?: string, configOverride?: GenerationConfig): Promise<string> {
        return imgGenerate(this, promptOrOptions, modelOverride, configOverride);
    }

    /**
     * TTS: Generate speech from text.
     * @see generators/SpeechGenerator.ts
     */
    async generateSpeech(
        text: string,
        voice: string = 'Kore',
        modelOverride?: string
    ): Promise<GenerateSpeechResponse> {
        return speechGenerate(this, text, voice, modelOverride);
    }

    /**
     * CORE: Embed content.
     * @see generators/EmbeddingGenerator.ts
     */
    async embedContent(options: { model: string; content: Content }): Promise<{ values: number[] }> {
        return embeddingEmbed(this, options);
    }

    public async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
        if (!this.model && !this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service not properly initialized');
        }
    }

    public handleError(error: unknown): AppException {
        if (error instanceof AppException) return error;
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
        if (
            lowerMsg.includes('permission-denied') ||
            lowerMsg.includes('permission_denied') ||
            lowerMsg.includes('app-check-token') ||
            lowerMsg.includes('unauthorized')
        ) {
            if (this.useFallbackMode) {
                return new AppException(
                    AppErrorCode.UNAUTHORIZED,
                    'AI Verification Failed (Fallback API Key Invalid/Restricted). Check VITE_API_KEY permissions.',
                    { retryable: false }
                );
            }
            return new AppException(AppErrorCode.UNAUTHORIZED, 'AI Verification Failed (App Check/Auth)', { retryable: false });
        }
        if (msg.includes('Recaptcha')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'Client Verification Failed (ReCaptcha)');
        }

        // Detailed Quota & Rate Limit Mapping
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
            return new AppException(AppErrorCode.QUOTA_EXCEEDED, 'AI Quota Exceeded');
        }
        if (msg.includes('429') || lowerMsg.includes('rate limit')) {
            return new AppException(AppErrorCode.RATE_LIMITED, 'AI Rate Limit Exceeded', { retryable: true });
        }

        // Service Availability
        if (msg.includes('503') || msg.includes('500') || lowerMsg.includes('service unavailable') || lowerMsg.includes('overloaded') || lowerMsg.includes('internal error')) {
            return new AppException(AppErrorCode.NETWORK_ERROR, 'AI Service Temporarily Unavailable or Internal Error', { retryable: true });
        }

        return new AppException(AppErrorCode.INTERNAL_ERROR, `AI Service Failure: ${msg}`, { retryable: false });
    }

    public async withRetry<T>(
        operation: () => Promise<T>,
        retries = 3,
        initialDelay = 1000,
        signal?: AbortSignal
    ): Promise<T> {
        let lastError: unknown;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (signal?.aborted) {
                    const reason = signal.reason === 'TIMEOUT' ? 'AI Request timed out' : (signal.reason || 'Operation cancelled by user');
                    throw typeof reason === 'string' ? new Error(reason) : reason;
                }
                return await operation();
            } catch (error: unknown) {
                lastError = error;

                if (signal?.aborted) {
                    throw error;
                }

                const appException = this.handleError(error);
                const isRetryable = appException.details?.retryable;

                if (attempt < retries && isRetryable) {
                    // Exponential backoff with jitter
                    const backoff = (initialDelay * Math.pow(2, attempt)) + secureRandomInt(0, 200);
                    const waitTime = Math.min(backoff, 15000); // Absolute cap at 15s

                    logger.warn(`[FirebaseAIService] Transient error, retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt + 1}/${retries})`);

                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, waitTime);
                        if (signal) {
                            signal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(new Error('Operation cancelled by user during retry backoff'));
                            }, { once: true });
                        }
                    });

                    continue;
                }
                throw appException;
            }
        }
        throw this.handleError(lastError);
    }

    public sanitizePrompt(prompt: string | Content[]): string | Content[] {
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

    private static instance: FirebaseAIService;
    public static getInstance(): FirebaseAIService {
        if (!FirebaseAIService.instance) {
            FirebaseAIService.instance = new FirebaseAIService();
        }
        return FirebaseAIService.instance;
    }
}

export const firebaseAI = FirebaseAIService.getInstance();
