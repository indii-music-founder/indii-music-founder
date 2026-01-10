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
    GenerationConfig as FirebaseGenerationConfig,
    Tool
} from 'firebase/ai';
import { ai, remoteConfig, functions } from '@/services/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { httpsCallable } from 'firebase/functions';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';
import {
    Candidate,
    TextPart,
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
import { InputSanitizer } from './utils/InputSanitizer';
import { TokenUsageService } from './billing/TokenUsageService';
import { auth } from '@/services/firebase';
import { aiCache } from './AIResponseCache';

// Default model if remote config fails
const FALLBACK_MODEL = AI_MODELS.TEXT.FAST;

// Interface for BatchEmbedContentsResponse (missing in SDK types)
interface BatchEmbedContentsResponse {
    embeddings: { values: number[] }[];
}

// Interface for Google Search Tool support (not yet in official firebase/ai types)
interface GoogleSearchTool {
    googleSearch: Record<string, never>;
}

type AITool = Tool | GoogleSearchTool;

// Interface for GenerativeModel with batching support
interface ExtendedGenerativeModel extends GenerativeModel {
    batchEmbedContents?(request: { requests: { content: Content }[] }): Promise<BatchEmbedContentsResponse>;
    embedContent?(request: { content: Content }): Promise<{ embedding: { values: number[] } }>;
}

// Interface for Aggregated Stream Response (SDK internal type)
interface AggregatedStreamResponse extends GenerateContentResponse {
    text?: () => string;
}

// Duplicates removed

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
}

export class FirebaseAIService {
    private model: ExtendedGenerativeModel | null = null;
    private isInitialized = false;

    // Circuit Breakers
    private contentBreaker = new CircuitBreaker(BREAKER_CONFIGS.CONTENT_GENERATION);
    private mediaBreaker = new CircuitBreaker(BREAKER_CONFIGS.MEDIA_GENERATION);
    private auxBreaker = new CircuitBreaker(BREAKER_CONFIGS.AUX_SERVICES);

    constructor() { }

    /**
     * Bootstrap the AI service:
     * 1. Fetch Remote Config to get the latest model name.
     * 2. Initialize the GenerativeModel using the pre-configured AI instance.
     */
    async bootstrap(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 1. Fetch Remote Config
            await fetchAndActivate(remoteConfig);

            // 2. Get Model Name and Location
            const modelName = getValue(remoteConfig, 'model_name').asString() || FALLBACK_MODEL;

            // 3. Initialize SDK
            // Note: 'ai' is already initialized in @/services/firebase with 
            // VertexAIBackend and useLimitedUseAppCheckTokens: true.
            this.model = getGenerativeModel(ai, {
                model: modelName
            });

            if (!this.model) {
                throw new Error('Failed to create generative model instance');
            }

            this.isInitialized = true;
            // Initialized with model: ${modelName}

        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * CORE: Raw generate content (returns SDK result)
     */
    async rawGenerateContent(
        prompt: string | Content[],
        modelOverride?: string,
        config?: GenerationConfig,
        systemInstruction?: string,
        tools?: Tool[],
        options?: { signal?: AbortSignal }
    ): Promise<GenerateContentResult> {
        return this.contentBreaker.execute(async () => {
            await this.ensureInitialized();

            // Rate Limit Check
            const userId = auth.currentUser?.uid;
            if (userId) {
                await TokenUsageService.checkQuota(userId);
            }

            const modelName = modelOverride || this.model!.model;
            // Validate & Sanitize
            const sanitizedPrompt = this.sanitizePrompt(prompt);

            const modelCallback = getGenerativeModel(ai, {
                model: modelName,
                generationConfig: config,
                systemInstruction,
                tools
            });

            try {
                // @ts-ignore - options param not in typed definition but supported
                const result = await modelCallback.generateContent(
                    typeof sanitizedPrompt === 'string'
                        ? sanitizedPrompt
                        : { contents: sanitizedPrompt } as any,
                    // @ts-ignore - options param not in typed definition but supported by underlying implementation
                    options
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
                throw this.handleError(error);
            }
        });
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
            await this.ensureInitialized();

            // Rate Limit Check
            const userId = auth.currentUser?.uid;
            if (userId) {
                await TokenUsageService.checkQuota(userId);
            }

            const modelName = modelOverride || this.model!.model;
            const sanitizedPrompt = this.sanitizePrompt(prompt);

            const modelCallback = getGenerativeModel(ai, {
                model: modelName,
                generationConfig: config,
                systemInstruction: systemInstruction ? {
                    role: 'system',
                    parts: [{ text: systemInstruction }] as TextPart[]
                } : undefined,
                tools
            });

            try {
                // @ts-ignore - Signal supported in SDK
                const result: GenerateContentStreamResult = await modelCallback.generateContentStream(
                    typeof sanitizedPrompt === 'string' ? sanitizedPrompt : { contents: sanitizedPrompt },
                    // @ts-ignore - options param not in typed definition but supported
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
                        response: aggResult as AggregatedStreamResponse,
                        text: () => aggResult.text?.() ?? '',
                        functionCalls: () => {
                            const part = aggResult.candidates?.[0]?.content?.parts?.find((p): p is FunctionCallPart => 'functionCall' in p);
                            return part ? [part.functionCall] : [];
                        }
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
                throw this.handleError(error);
            }
        });
    }

    /**
     * CORE: Generate content and return Result Object (Used by AIService)
     */
    async generateContent(
        prompt: string | Content[],
        modelOverride?: string,
        config?: any,
        systemInstruction?: string,
        tools?: any[]
    ): Promise<GenerateContentResult> {
        return this.rawGenerateContent(prompt, modelOverride, config, systemInstruction, tools);
    }

    /**
     * CORE: Generate content stream (Used by AIService)
     */
    async generateContentStream(
        prompt: string | Content[],
        modelOverride?: string,
        config?: any,
        systemInstruction?: string,
        tools?: any[],
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
        systemInstructionOrConfig?: string | any
    ): Promise<string> {
        return this.contentBreaker.execute(async () => {
            await this.ensureInitialized();

            let model = this.model!.model;
            let config: any = {};
            let systemInstruction: string | undefined;

            if (typeof thinkingBudgetOrModel === 'number') {
                config.thinkingConfig = { thinkingBudget: thinkingBudgetOrModel };
                systemInstruction = typeof systemInstructionOrConfig === 'string' ? systemInstructionOrConfig : undefined;
            } else if (typeof thinkingBudgetOrModel === 'string') {
                model = thinkingBudgetOrModel;
                config = systemInstructionOrConfig || {};
                systemInstruction = config.systemInstruction;
            } else if (thinkingBudgetOrModel && typeof thinkingBudgetOrModel === 'object') {
                config = thinkingBudgetOrModel;
                model = config.model || model;
                systemInstruction = config.systemInstruction;
            }

            const modelName = model || this.model!.model;

            // CACHE CHECK
            const cacheKey = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
            const cached = await aiCache.get(cacheKey, modelName, config);
            if (cached) return cached;

            const modelCallback = getGenerativeModel(ai, {
                model: model,
                generationConfig: config,
                systemInstruction: systemInstruction || config?.systemInstruction
            });

            const result = await modelCallback.generateContent(
                typeof prompt === 'string' ? prompt : { contents: [{ role: 'user', parts: prompt }] }
            );
            const text = result.response.text();

            // CACHE SET
            await aiCache.set(cacheKey, text, modelName, config);

            return text;
        });
    }

    /**
     * HIGH LEVEL: Generate structured data from a prompt/parts and schema.
     */
    async generateStructuredData<T>(
        prompt: string | Part[],
        schema: Schema,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<T> {
        return this.contentBreaker.execute(async () => {
            await this.ensureInitialized();
            const config: GenerationConfig = {
                responseMimeType: 'application/json',
                responseSchema: schema
            };
            if (thinkingBudget) {
                config.thinkingConfig = { thinkingBudget };
            }

            // CACHE CHECK
            const modelName = this.model!.model;
            // For structured data, prompt + schema is the key
            const cacheKeyString = (typeof prompt === 'string' ? prompt : JSON.stringify(prompt)) + JSON.stringify(schema);
            const cached = await aiCache.get(cacheKeyString, modelName, config);

            if (cached) {
                try {
                    return JSON.parse(cached) as T;
                } catch (e) {
                    // Cached JSON parse failed, regenerating
                }
            }

            const modelCallback = getGenerativeModel(ai, {
                model: modelName,
                generationConfig: config,
                systemInstruction
            });

            const result = await modelCallback.generateContent(
                typeof prompt === 'string' ? prompt : { contents: [{ role: 'user', parts: prompt }] }
            );
            const text = result.response.text();

            // CACHE SET
            await aiCache.set(cacheKeyString, text, modelName, config);

            try {
                return JSON.parse(text) as T;
            } catch (e) {
                throw e;
            }
        });
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

        // Rate Limit Check
        const userId = auth.currentUser?.uid;
        if (userId) {
            await TokenUsageService.checkQuota(userId);
        }

        const modelCallback = getGenerativeModel(ai, {
            model: this.model!.model,
            systemInstruction
        });

        const chatSession = modelCallback.startChat({ history });
        const result = await chatSession.sendMessage(newMessage);

        // Track usage (approximated for chat as explicit tokens aren't always returned in the same structure)
        if (userId && result.response.usageMetadata) {
            try {
                await TokenUsageService.trackUsage(
                    userId,
                    this.model!.model,
                    result.response.usageMetadata.promptTokenCount || 0,
                    result.response.usageMetadata.candidatesTokenCount || 0
                );
            } catch {
                // Ignore tracking errors
            }
        }

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
        await this.ensureInitialized();
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imagePart: Part = {
            inlineData: { data: base64Data, mimeType }
        };

        const result = await this.model!.generateContent([prompt, imagePart]);
        return result.response.text();
    }

    /**
     * MULTIMODAL: Analyze generic parts (Video, Audio, PDF).
     */
    async analyzeMultimodal(
        prompt: string,
        parts: Part[]
    ): Promise<string> {
        await this.ensureInitialized();
        const result = await this.model!.generateContent([prompt, ...parts]);
        return result.response.text();
    }

    /**
     * ADVANCED: Grounding with Google Search.
     */
    async generateGroundedContent(prompt: string): Promise<GenerateContentResult> {
        await this.ensureInitialized();
        const modelWithSearch = getGenerativeModel(ai, {
            model: this.model!.model,
            tools: [{ googleSearch: {} }] as unknown as Tool[]
        });

        return await modelWithSearch.generateContent(prompt);
    }

    /**
     * ADVANCED: Live API for real-time bi-directional communication.
     */
    async getLiveModel(systemInstruction?: string): Promise<LiveGenerativeModel> {
        await this.ensureInitialized();
        return getLiveGenerativeModel(ai, {
            model: AI_MODELS.TEXT.AGENT, // Upgraded reasoning model
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
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 1. Trigger the background job
            await this.withRetry(() => triggerVideoJobFn({
                jobId,
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                ...options.config
            }));

            // 2. Poll for completion with dynamic timeout
            const durationSeconds = options.config?.durationSeconds || 8;
            const calculatedTimeout = Math.max(120000, durationSeconds * 10000);
            const timeoutMs = options.timeoutMs || Math.min(calculatedTimeout, 600000);
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
            const modelCallback = getGenerativeModel(ai, { model: modelName });

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
                    const modelWithEmbed = modelCallback as unknown as { embedContent: (req: any) => Promise<any> };
                    if (typeof modelWithEmbed.embedContent === 'function') {
                        const promises = contents.map(c => modelWithEmbed.embedContent({ content: c }));
                        const results = await Promise.all(promises);
                        return results.map(r => r.embedding.values);
                    }
                    throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Model does not support embedding');
                }
            } catch (error) {
                throw this.handleError(error);
            }
        });
    }

    /**
     * HIGH LEVEL: Generate image using backend proxy
     */
    async generateImage(prompt: string, model: string = 'gemini-3-pro-image-preview', config?: any): Promise<string> {
        return this.mediaBreaker.execute(async () => {
            const generateImageFn = httpsCallable<GenerateImageRequest, GenerateImageResponse>(functions, 'generateImageV3');
            const response = await generateImageFn({ model, prompt, config });
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

            const modelCallback = getGenerativeModel(ai, {
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
            const modelCallback = getGenerativeModel(ai, {
                model: options.model
            });

            interface GenerativeModelWithEmbed {
                embedContent(request: { content: Content }): Promise<{ embedding: { values: number[] } }>;
            }
            const result = await (modelCallback as unknown as GenerativeModelWithEmbed).embedContent({ content: options.content });
            return { values: result.embedding.values };
        });
    }

    /**
     * HIGH LEVEL: Parse JSON from AI response
     */
    parseJSON<T = any>(text: string | undefined): T | Record<string, never> {
        if (!text) return {};
        const clean = text.replace(/```json\n?|```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            return {};
        }
    }

    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
        if (!this.model) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'AI Service not properly initialized');
        }
    }

    private handleError(error: unknown): AppException {

        const msg = error instanceof Error ? error.message : String(error);

        if (msg.includes('permission-denied') || msg.includes('app-check-token')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'AI Verification Failed (App Check)');
        }
        if (msg.includes('Recaptcha')) {
            return new AppException(AppErrorCode.UNAUTHORIZED, 'Client Verification Failed (ReCaptcha)');
        }
        if (msg.includes('429') || msg.includes('quota')) {
            return new AppException(AppErrorCode.NETWORK_ERROR, 'AI Quota Exceeded');
        }

        return new AppException(AppErrorCode.INTERNAL_ERROR, `AI Service Failure: ${msg}`);
    }


    // ... existing handleError ...

    /**
     * CORE: Retry logic
     */
    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            const isRetryable = error?.code === 'resource-exhausted' || error?.message?.includes('429');
            if (retries > 0 && isRetryable) {
                await new Promise(r => setTimeout(r, delay));
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    /**
     * Sanitize prompt content to remove control chars and check for injection
     */
    private sanitizePrompt(prompt: string | Content[]): string | Content[] {
        if (typeof prompt === 'string') {
            if (InputSanitizer.containsInjectionPatterns(prompt)) {
                // Potential Prompt Injection detected
            }
            return InputSanitizer.sanitize(prompt);
        }

        if (Array.isArray(prompt)) {
            return prompt.map(content => ({
                ...content,
                parts: content.parts.map(part => {
                    if (part.text) {
                        const cleanText = InputSanitizer.sanitize(part.text);
                        if (InputSanitizer.containsInjectionPatterns(part.text)) {
                            // Potential Prompt Injection detected in content part
                        }
                        return { ...part, text: cleanText };
                    }
                    return part;
                })
            }));
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
