import {
    getGenerativeModel,
    GenerativeModel,
    GenerateContentResult,
    GenerateContentStreamResult,
    Content,
    Part,
    Schema,
    GenerationConfig
} from 'firebase/ai';
import { AI_MODELS } from '@/core/config/ai-models';
import { app, ai, remoteConfig } from '@/services/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { AppErrorCode, AppException } from '@/shared/types/errors';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
}

export class FirebaseAIService {
    private model: GenerativeModel | null = null;
    private isInitialized = false;

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
            // We use the central AI_MODELS constant as the absolute fallback
            const modelName = getValue(remoteConfig, 'model_name').asString() || AI_MODELS.TEXT.FAST;
            const location = getValue(remoteConfig, 'vertex_location').asString() || 'us-central1';

            console.log(`[FirebaseAIService] Initializing with model: ${modelName}`);

            // 3. Initialize Generative Model
            // 'ai' instance in @/services/firebase is pre-configured with App Check
            this.model = getGenerativeModel(ai, {
                model: modelName
            });

            this.isInitialized = true;

        } catch (error) {
            console.error('[FirebaseAIService] Bootstrap failed:', error);
        }
    }

    /**
     * CORE: Generate content (single response)
     */
    async generateContent(prompt: string | Content[]): Promise<string> {
        await this.ensureInitialized();
        if (!this.model) throw new Error('AI Model not available');

        try {
            const result: GenerateContentResult = await this.model.generateContent(
                typeof prompt === 'string' ? prompt : { contents: prompt } as any
            );
            return result.response.text();
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * CORE: Generate content stream
     */
    async generateContentStream(prompt: string | Content[]): Promise<ReadableStream<string>> {
        await this.ensureInitialized();
        if (!this.model) throw new Error('AI Model not available');

        try {
            const result: GenerateContentStreamResult = await this.model.generateContentStream(
                typeof prompt === 'string' ? prompt : { contents: prompt } as any
            );

            return new ReadableStream({
                async start(controller) {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(text);
                        }
                    }
                    controller.close();
                }
            });
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * GENERIC: Generate text with specific config
     */
    async generateText(
        prompt: string,
        systemInstruction?: string,
        isThink?: boolean
    ): Promise<string> {
        await this.ensureInitialized();

        const config: GenerationConfig = isThink ? {
            thinkingConfig: { thinkingLevel: 'MEDIUM' }
        } : {};

        const model = getGenerativeModel(ai, {
            model: this.model!.model,
            generationConfig: config,
            systemInstruction
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    /**
     * STRUCTURED: Generate JSON data
     */
    async generateStructuredData<T>(
        prompt: string,
        schema: Schema,
        systemInstruction?: string
    ): Promise<T> {
        await this.ensureInitialized();
        const config: GenerationConfig = {
            responseMimeType: 'application/json',
            responseSchema: schema
        };

        const model = getGenerativeModel(ai, {
            model: this.model!.model,
            generationConfig: config,
            systemInstruction
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            console.error('[FirebaseAIService] JSON Parse Error:', text);
            throw e;
        }
    }

    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
    }

    private handleError(error: unknown): AppException {
        console.error('[FirebaseAIService] AI Error:', error);
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
}

export const firebaseAI = new FirebaseAIService();
