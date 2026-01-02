import {
    getAI,
    getGenerativeModel,
    VertexAIBackend,
    GenerativeModel,
    GenerateContentResult,
    Content,
    GenerateContentStreamResult,
    GenerateContentRequest
} from 'firebase/ai';
import { app, remoteConfig } from '@/services/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { AppErrorCode, AppException } from '@/shared/types/errors';

export class FirebaseAIService {
    private model: GenerativeModel | null = null;
    private isInitialized = false;

    constructor() { }

    /**
     * Boostrap the AI service:
     * 1. Fetch Remote Config to get the latest model name.
     * 2. Initialize the Vertex AI SDK with App Check Limited Use Tokens.
     */
    async bootstrap(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 1. Fetch Remote Config (cache for 1 hour in prod, mostly instant in dev/with listener)
            // Note: We use fetchAndActivate to ensure we have value, but in a real app might rely on cached
            await fetchAndActivate(remoteConfig);

            // 2. Get Model Name
            const modelName = getValue(remoteConfig, 'model_name').asString() || 'gemini-1.5-flash';
            const location = getValue(remoteConfig, 'vertex_location').asString() || 'us-central1';

            console.log(`[FirebaseAIService] Initializing with model: ${modelName} in ${location}`);

            // 3. Initialize SDK
            // "useLimitedUseAppCheckTokens: true" is a PRODUCTION CHECKLIST REQUIREMENT
            // It protects against replay attacks by consuming tokens on use.
            const ai = getAI(app, {
                backend: new VertexAIBackend(location),
                useLimitedUseAppCheckTokens: true
            });

            this.model = getGenerativeModel(ai, {
                model: modelName,
                // Default safety settings can be added here
            });

            this.isInitialized = true;

        } catch (error) {
            console.error('[FirebaseAIService] Bootstrap failed:', error);
            // We don't throw here to allow app to load, but generation will fail later
        }
    }

    /**
     * Generate content (single response)
     */
    async generateContent(prompt: string | Content[]): Promise<string> {
        await this.ensureInitialized();
        if (!this.model) throw new Error('AI Model not available');

        try {
            const request: string | GenerateContentRequest = typeof prompt === 'string'
                ? prompt
                : { contents: prompt };

            const result: GenerateContentResult = await this.model.generateContent(request);
            return result.response.text();
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Generate content stream
     */
    async generateContentStream(prompt: string | Content[]): Promise<ReadableStream<string>> {
        await this.ensureInitialized();
        if (!this.model) throw new Error('AI Model not available');

        try {
            const request: string | GenerateContentRequest = typeof prompt === 'string'
                ? prompt
                : { contents: prompt };

            const result: GenerateContentStreamResult = await this.model.generateContentStream(request);

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

    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
    }

    private handleError(error: unknown): AppException {
        console.error('[FirebaseAIService] Generation Error:', error);

        // Map common Firebase AI errors
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
