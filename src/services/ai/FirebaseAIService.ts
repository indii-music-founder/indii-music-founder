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
    Tool,
    SafetySetting as FirebaseSafetySetting
} from 'firebase/ai';
import { GoogleGenAI } from '@google/genai';
import { getFirebaseAI, remoteConfig, functions } from '@/services/firebase';
import { env } from '@/config/env';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { httpsCallable } from 'firebase/functions';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_MODELS, APPROVED_MODELS, getModelKey, AI_CONFIG } from '@/core/config/ai-models';
import { RemoteAIConfigSchema, DEFAULT_REMOTE_CONFIG, RemoteAIConfig } from './config/RemoteAIConfig';
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
    GenerateContentOptions,
    GenerateStreamOptions,
    GenerateVideoOptions,
    GenerateImageOptions,
    EmbedContentOptions,
    GenerationConfig,
    ContentPart,
    SafetySetting,
    ToolConfig
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
        msg.includes('The caller does not have permission') ||
        msg.includes('403') ||
        msg.includes('unauthenticated') ||
        msg.toLowerCase().includes('verification failed')
    );
}

/**
 * Check if App Check is configured in the environment.
 * If not, we should use direct Gemini SDK from the start.
 */
function isAppCheckConfigured(): boolean {
    // Force fallback in dev mode unless a debug token is explicitly set
    // This allows localhost to work without App Check emulation
    console.log('[FirebaseAIService] App Check Debug:', {
        DEV: env.DEV,
        debugToken: env.appCheckDebugToken,
        key: env.appCheckKey
    });

    if (env.DEV && !env.appCheckDebugToken) {
        console.warn('[FirebaseAIService] DEV mode detected without Debug Token. Disabling App Check.');
        return false;
    }
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
    parts: (Part | ContentPart)[];
}

export class FirebaseAIService {
    private model: ExtendedGenerativeModel | null = null;
    private isInitialized = false;

    // Fallback mode: use direct Gemini SDK when App Check is not available
    private useFallbackMode = false;
    private fallbackClient: GoogleGenAI | null = null;

    // Circuit Breakers
    private contentBreaker = new CircuitBreaker(BREAKER_CONFIGS.CONTENT_GENERATION);
    private mediaBreaker = new CircuitBreaker(BREAKER_CONFIGS.MEDIA_GENERATION);
    private auxBreaker = new CircuitBreaker(BREAKER_CONFIGS.AUX_SERVICES);

    // Dynamic Configuration
    private remoteConfig: RemoteAIConfig = DEFAULT_REMOTE_CONFIG;

    /**
     * Permanently switches the service to direct Gemini SDK for the current session.
     * This prevents infinite "AI Verification Failed" loops.
     */
    private async triggerGlobalFallback(): Promise<void> {
        if (!this.useFallbackMode) {
            console.warn('[FirebaseAIService] Global fallback triggered (App Check non-responsive or failing)');
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

            // 2. Fetch Remote Config (Safe Mode) - NOW WITH DYNAMIC SCHEMA
            let modelName: string = FALLBACK_MODEL;
            try {
                await fetchAndActivate(remoteConfig);

                // Get the old simple string (legacy)
                modelName = getValue(remoteConfig, 'model_name').asString() || FALLBACK_MODEL;

                // Get the new JSON config (modern)
                const jsonString = getValue(remoteConfig, 'ai_system_config').asString();
                if (jsonString) {
                    try {
                        const parsed = JSON.parse(jsonString);
                        const validated = RemoteAIConfigSchema.safeParse(parsed);
                        if (validated.success) {
                            this.remoteConfig = validated.data;
                            logger.info('[FirebaseAIService] Loaded dynamic AI config from Remote Config');
                        } else {
                            logger.warn('[FirebaseAIService] Invalid remote config schema:', validated.error);
                        }
                    } catch (e) {
                        logger.warn('[FirebaseAIService] Failed to parse ai_system_config JSON:', e);
                    }
                }
            } catch (configError: unknown) {
                if (isAppCheckError(configError)) {
                    throw configError;
                }
                console.warn('[FirebaseAIService] Failed to fetch remote config, using default model:', configError);
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
    public async initializeFallbackMode(): Promise<void> {
        // Try multiple key locations: VITE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY
        // Explicitly check sources to log which one is used
        const keySources = {
            'env.VITE_API_KEY': env.VITE_API_KEY,
            'env.apiKey': env.apiKey,
            'import.meta.env.GOOGLE_API_KEY': (import.meta as any).env?.GOOGLE_API_KEY,
            'import.meta.env.GEMINI_API_KEY': (import.meta as any).env?.GEMINI_API_KEY
        };

        const foundSource = Object.entries(keySources).find(([_, val]) => !!val);
        const apiKey = foundSource ? foundSource[1] : undefined;

        console.log('[FirebaseAIService] Fallback Mode Initialization:', {
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

        this.fallbackClient = new GoogleGenAI({ apiKey });
        this.useFallbackMode = true;
        this.isInitialized = true;
        logger.info('[FirebaseAIService] Initialized with direct Gemini SDK (fallback mode)');
    }

    /**
     * Get the model name, either from remote config or fallback
     * Handles DYNAMIC INTERCEPTION/REPLACEMENT of models.
     */
    private getModelName(modelOverride?: string): string {
        // If the user provided a specific override, checking if WE want to override THAT.
        // But usually, an explicit override in code means "I need this specific model".
        // HOWEVER, for "system" defined constants, we might want to swap them too.

        const candidateModel = modelOverride || this.model?.model || FALLBACK_MODEL;

        // Try to reverse-lookup the key (e.g. "gemini-3-pro-preview" -> "TEXT_AGENT")
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
        options?: { signal?: AbortSignal, cachedContent?: string, safetySettings?: any[], toolConfig?: any }
    ): Promise<GenerateContentResult> {
        // Wrap in retry logic (internal retries for 503/429/Transient Aborts)
        return this.contentBreaker.execute(async () => {
            return this.withRetry(async () => {
                await this.ensureInitialized();

                // Rate Limit Check
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await TokenUsageService.checkQuota(userId);
                    await TokenUsageService.checkRateLimit(userId);
                }

                const modelName = this.getModelName(modelOverride);
                // Validate & Sanitize
                const sanitizedPrompt = this.sanitizePrompt(prompt);

                const result = await (async () => {
                    // ============================================================
                    // FALLBACK MODE: Use direct Gemini SDK when App Check unavailable
                    // ============================================================
                    if (this.useFallbackMode && this.fallbackClient) {
                        return this.generateWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools, options?.safetySettings, options?.toolConfig, { signal: options?.signal });
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
                        toolConfig: options?.toolConfig,
                        safetySettings: options?.safetySettings || STANDARD_SAFETY_SETTINGS
                    };

                    // Inject cachedContent if supported/available
                    if (cachedContent) {
                        modelOptions.cachedContent = cachedContent;
                    }

                    const modelOptionsFinal: any = { ...modelOptions };
                    const modelCallback = getGenerativeModel(getFirebaseAI()!, modelOptionsFinal);

                    try {
                        return await modelCallback.generateContent(
                            typeof sanitizedPrompt === 'string'
                                ? sanitizedPrompt
                                : { contents: sanitizedPrompt }
                        );
                    } catch (error) {
                        // If we hit an App Check error during normal mode, switch to fallback
                        if (isAppCheckError(error) && !this.useFallbackMode) {
                            await this.triggerGlobalFallback();
                            return this.generateWithFallback(sanitizedPrompt, modelName, config, systemInstruction, tools);
                        }
                        throw this.handleError(error);
                    }
                })();

                // Track Usage (Unified for both modes)
                if (userId && result.response.usageMetadata) {
                    await TokenUsageService.trackUsage(
                        userId,
                        modelName,
                        result.response.usageMetadata.promptTokenCount || 0,
                        result.response.usageMetadata.candidatesTokenCount || 0
                    );
                }

                return result;
            }, 3, 1000, options?.signal); // Pass signal to withRetry
        });
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
        safetySettings?: any[],
        toolConfig?: any,
        options?: { signal?: AbortSignal }
    ): Promise<GenerateContentResult> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }

        try {
            // Build contents array for the new SDK format
            const contents = typeof prompt === 'string'
                ? [{ role: 'user' as const, parts: [{ text: prompt }] }]
                : prompt;

            const result = await this.fallbackClient.models.generateContent({
                model: modelName,
                contents: contents as any,
                config: {
                    ...config,
                    systemInstruction,
                    tools: tools as any,
                    toolConfig,
                    safetySettings: (safetySettings || STANDARD_SAFETY_SETTINGS) as any,
                    abortSignal: options?.signal
                } as any,
            });

            // Convert to Firebase AI SDK format for compatibility
            return {
                response: {
                    candidates: result.candidates,
                    usageMetadata: result.usageMetadata,
                    text: () => result.text || ''
                } as unknown as GenerateContentResponse
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
        options?: { signal?: AbortSignal, safetySettings?: any[], toolConfig?: any }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        return this.contentBreaker.execute(async () => {
            return this.withRetry(async () => {
                await this.ensureInitialized();

                // Rate Limit Check
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await TokenUsageService.checkQuota(userId);
                    await TokenUsageService.checkRateLimit(userId);
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
                    toolConfig: options?.toolConfig,
                    safetySettings: options?.safetySettings || STANDARD_SAFETY_SETTINGS
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
                        await this.triggerGlobalFallback();
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
     * Uses the new @google/genai SDK (GA).
     */
    private async streamWithFallback(
        prompt: string | Content[],
        modelName: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal, safetySettings?: any[], toolConfig?: any }
    ): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        if (!this.fallbackClient) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Fallback client not initialized');
        }

        // Build contents array for the new SDK format
        const contents = typeof prompt === 'string'
            ? [{ role: 'user' as const, parts: [{ text: prompt }] }]
            : prompt;

        const result = await this.fallbackClient.models.generateContentStream({
            model: modelName,
            contents: contents as any,
            config: {
                ...config,
                systemInstruction,
                tools: tools as any,
                toolConfig: options?.toolConfig,
                safetySettings: (options?.safetySettings || STANDARD_SAFETY_SETTINGS) as any,
                abortSignal: options?.signal
            } as any,
        });

        // Collect chunks for final response
        const chunks: any[] = [];
        let finalText = '';

        const stream = new ReadableStream<StreamChunk>({
            async start(controller) {
                try {
                    for await (const chunk of result) {
                        chunks.push(chunk);
                        let chunkText = '';
                        try {
                            const c = chunk as any;
                            chunkText = typeof c.text === 'function' ? c.text() : (c.text || '');
                        } catch (e) { console.log('CAUGHT CHUNK ERROR', e); }
                        finalText += chunkText;
                        const firstPart = chunk.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
                        const thoughtSignature = firstPart && 'thoughtSignature' in firstPart ? (firstPart as any).thoughtSignature : undefined;

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
                } catch (streamError) {
                    controller.error(streamError);
                }
            }
        });

        // Build wrapped response from accumulated chunks
        const wrappedResponsePromise = (async () => {
            const lastChunk = chunks[chunks.length - 1];
            // Find the first chunk that had a thoughtSignature
            const firstWithSignature = chunks.find(c => {
                const part = c.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
                return part && 'thoughtSignature' in part && (part as any).thoughtSignature;
            });
            const firstPart = firstWithSignature?.candidates?.[0]?.content?.parts?.[0] as ContentPart | undefined;
            const thoughtSignature = firstPart && 'thoughtSignature' in firstPart ? (firstPart as any).thoughtSignature : undefined;

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

            // Track Usage (Streaming)
            const userId = auth.currentUser?.uid;
            if (userId && lastChunk?.usageMetadata) {
                await TokenUsageService.trackUsage(
                    userId,
                    modelName,
                    lastChunk.usageMetadata.promptTokenCount || 0,
                    lastChunk.usageMetadata.candidatesTokenCount || 0
                );
            }

            return result;
        })();

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
        options?: { signal?: AbortSignal, safetySettings?: SafetySetting[], toolConfig?: ToolConfig }
    ): Promise<GenerateContentResult> {
        // [DEBUG] Log payload for deep diagnosis
        try {
            // Security: Redact PII from logs
            const sanitizedForLog = this.sanitizePrompt(prompt);
            console.log('[DEBUG-PAYLOAD] modelName:', modelOverride || this.getModelName());
            console.log('[DEBUG-PAYLOAD] prompt:', JSON.stringify(sanitizedForLog).substring(0, 500) + "...");
            console.log('[DEBUG-PAYLOAD] config:', JSON.stringify(config));
        } catch (e) { /* Ignore logging errors */ }

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
            config.thinkingConfig = {
                thinkingBudget: thinkingBudgetOrModel,
                budgetTokenCount: thinkingBudgetOrModel,
                includeThoughts: true
            };
            systemInstruction = typeof systemInstructionOrConfig === 'string' ? systemInstructionOrConfig : undefined;
        } else if (typeof thinkingBudgetOrModel === 'string') {
            model = thinkingBudgetOrModel;
            if (typeof systemInstructionOrConfig === 'string') {
                systemInstruction = systemInstructionOrConfig;
            } else {
                config = (systemInstructionOrConfig as Record<string, unknown>) || {};
                systemInstruction = config && typeof config === 'object' && 'systemInstruction' in config ? (config as { systemInstruction: string }).systemInstruction : undefined;
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
        promptOrOptions: string | Part[] | GenerateContentOptions,
        schemaOrConfig?: Schema | Record<string, unknown>,
        thinkingBudget?: number,
        systemInstruction?: string,
        modelOverride?: string
    ): Promise<T> {
        await this.ensureInitialized();

        let prompt: string | Content[];
        let schema: Schema | undefined;
        let config: GenerationConfig = {};
        let finalSystemInstruction = systemInstruction;
        let modelName = modelOverride || this.getModelName();

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
                    budgetTokenCount: thinkingBudget,
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
                return JSON.parse(cached) as T;
            } catch (_e) {
                // Ignore parse failure
            }
        }

        const result = await this.rawGenerateContent(
            prompt,
            modelName,
            config,
            finalSystemInstruction
        );

        const text = result.response.text();
        await aiCache.set(cacheKeyString, text, modelName, config);

        // Use the robust parser
        const cleaned = text.replace(/```json\n ?| ```/g, '').trim();
        return JSON.parse(cleaned) as T;
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
            parts: h.parts as Part[] // Cast to satisfy firebase/ai types while preserving extra fields like thoughtSignature
        }));
        contents.push({ role: 'user', parts: [{ text: newMessage }] });

        const result = await this.rawGenerateContent(
            contents,
            this.model?.model,
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
    async generateGroundedContent(prompt: string, options?: { dynamicThreshold?: number }): Promise<GenerateContentResult> {
        await this.ensureInitialized();
        const tools: Tool[] = [{
            googleSearch: {},
            googleSearchRetrieval: options?.dynamicThreshold ? {
                dynamicRetrievalConfig: {
                    mode: 'MODE_DYNAMIC',
                    dynamicThreshold: options.dynamicThreshold
                }
            } : undefined
        }] as unknown as Tool[];
        return this.rawGenerateContent(prompt, this.model?.model, {}, undefined, tools as any);
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

        return this.contentBreaker.execute(async () => {
            await this.ensureInitialized();

            const userId = auth.currentUser?.uid;
            if (userId) {
                await TokenUsageService.checkQuota(userId);
            }

            const modelName = modelOverride || APPROVED_MODELS.EMBEDDING_DEFAULT;

            // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
            if (this.useFallbackMode && this.fallbackClient) {
                const promises = contents.map(async (c) => {
                    // Extract text from content parts
                    const text = c.parts.map(p => 'text' in p ? p.text : '').join(' ');
                    const result = await this.fallbackClient!.models.embedContent({
                        model: modelName,
                        contents: [{ role: 'user', parts: [{ text }] }] as any
                    });
                    return (result as any).embeddings?.[0]?.values || (result as any).embedding?.values || [];
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
            await this.ensureInitialized();

            // 1. Setup Tools (Enable Google Search for grounding by default, aka "Nano Banana Pro" logic)
            const tools: Tool[] = [{ googleSearch: {} }];

            // 2. Setup Config
            const generationConfig: GenerationConfig = {
                responseModalities: ['IMAGE'], // Specific to Gemini 3 Image
                mediaResolution: AI_CONFIG.IMAGE.DEFAULT.mediaResolution as any,
                imageConfig: {
                    aspectRatio: config?.aspectRatio || '1:1',
                    imageSize: '4K', // "Perfect" quality
                    personGenerationConfig: config?.personGenerationConfig as any
                } as any
            };

            if (config?.numberOfImages) {
                generationConfig.candidateCount = config.numberOfImages as number;
            }

            // 3. Generate
            const result = await this.rawGenerateContent(
                prompt,
                model,
                generationConfig,
                undefined,
                tools
            );

            // 4. Extract Image
            // Gemini 3 returns images as inlineData in the parts
            const candidates = result.response.candidates;
            if (!candidates || candidates.length === 0) throw new Error('No candidates returned');

            const imagePart = candidates[0].content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image/'));

            if (!imagePart || !imagePart.inlineData) {
                // Check if it was blocked or just text returned (e.g. "I cannot generate that")
                const textPart = candidates[0].content?.parts?.find(p => 'text' in p);
                if (textPart && 'text' in textPart) {
                    throw new Error(`Generation blocked or failed: ${textPart.text}`);
                }
                throw new Error('No image data found in response');
            }

            return imagePart.inlineData.data;
        });
    }

    /**
     * TTS: Generate speech from text using gemini-2.5-pro-preview-tts
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

            const modelName = modelOverride || AI_MODELS.AUDIO.TTS;

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

            // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
            if (this.useFallbackMode && this.fallbackClient) {
                try {
                    const result = await this.fallbackClient.models.generateContent({
                        model: modelName,
                        contents: [{ role: 'user', parts: [{ text }] }] as any,
                        config: config as any
                    });

                    const candidates = result.candidates;

                    if (!candidates || candidates.length === 0) {
                        throw new Error('No candidates returned from TTS fallback model');
                    }

                    const audioPart = (candidates[0] as any).content?.parts?.find((p: any) => p && 'inlineData' in p && p.inlineData?.mimeType.startsWith('audio/'));

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

            // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
            if (this.useFallbackMode && this.fallbackClient) {
                try {
                    // Extract text from content parts
                    const text = options.content.parts.map(p => 'text' in p ? p.text : '').join(' ');
                    const result = await this.fallbackClient.models.embedContent({
                        model: options.model,
                        contents: [{ role: 'user', parts: [{ text }] }] as any
                    });
                    return { values: (result as any).embeddings?.[0]?.values || (result as any).embedding?.values || [] };
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
        const clean = text.replace(/```json\n ?| ```/g, '').trim();
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
            if (import.meta.env.DEV) {
                console.error('[FirebaseAIService] Permission Error Detail:', msg);
            }

            if (this.useFallbackMode) {
                return new AppException(
                    AppErrorCode.UNAUTHORIZED,
                    `AI Verification Failed: ${msg}`, // Include raw msg in user-facing error for now to help debug
                    { retryable: false }
                );
            }
            // Sanitize all permission errors to prevent leaking internal details (App Check, Auth status, etc.)
            return new AppException(
                AppErrorCode.UNAUTHORIZED,
                'AI Verification Failed',
                { retryable: false }
            );
        }

        if (msg.includes('Recaptcha')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'Client Verification Failed (ReCaptcha)');
        }

        // Detailed Quota & Rate Limit Mapping
        if (lowerMsg.includes('quota') || lowerMsg.includes('resource-exhausted')) {
            return new AppException(AppErrorCode.QUOTA_EXCEEDED, 'AI Quota Exceeded');
        }
        if (msg.includes('429') || lowerMsg.includes('rate limit')) {
            return new AppException(AppErrorCode.RATE_LIMITED, 'AI Rate Limit Exceeded', { retryable: true });
        }

        // Service Availability
        if (msg.includes('503') || msg.includes('500') || lowerMsg.includes('service unavailable') || lowerMsg.includes('overloaded') || lowerMsg.includes('internal error')) {
            return new AppException(AppErrorCode.NETWORK_ERROR, 'AI Service Temporarily Unavailable or Internal Error', { retryable: true });
        }

        return new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'AI Service Failure',
            { retryable: false, originalError: import.meta.env.DEV ? msg : undefined }
        );
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        retries = 3,
        initialDelay = 1000,
        signal?: AbortSignal
    ): Promise<T> {
        let lastError: unknown;
        let currentDelay = initialDelay;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (signal?.aborted) {
                    throw new Error('Operation cancelled by user');
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
                    // currentDelay = initialDelay * 2^attempt + jitter
                    const backoff = (initialDelay * Math.pow(2, attempt)) + (Math.random() * 200);
                    const waitTime = Math.min(backoff, 15000); // Absolute cap at 15s

                    console.warn(`[FirebaseAIService] Transient error, retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt + 1}/${retries})`);

                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, waitTime);
                        if (signal) {
                            signal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(new Error('Operation cancelled by user during retry backoff'));
                            }, { once: true });
                        }
                    });

                    currentDelay = waitTime;
                    continue;
                }
                throw appException;
            }
        }
        throw this.handleError(lastError);
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
