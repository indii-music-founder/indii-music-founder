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
    GenerationConfig
} from 'firebase/ai';
import { ai, remoteConfig } from '@/services/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { AppErrorCode, AppException } from '@/shared/types/errors';

// Default model if remote config fails
const FALLBACK_MODEL = 'gemini-1.5-flash';

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
            const modelName = getValue(remoteConfig, 'model_name').asString() || FALLBACK_MODEL;

            console.log(`[FirebaseAIService] Initializing with model: ${modelName}`);

            // 3. Initialize SDK
            // Note: 'ai' is already initialized in @/services/firebase with 
            // VertexAIBackend and useLimitedUseAppCheckTokens: true.
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
     * HIGH LEVEL: Generate text with optional thinking budget and system instruction.
     */
    async generateText(
        prompt: string,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<string> {
        await this.ensureInitialized();
        const config: GenerationConfig = thinkingBudget ? { thinkingConfig: { thinkingBudget } } : {};

        const modelCallback = getGenerativeModel(ai, {
            model: this.model!.model,
            generationConfig: config,
            systemInstruction
        });

        const result = await modelCallback.generateContent(prompt);
        return result.response.text();
    }

    /**
     * HIGH LEVEL: Generate structured data from a prompt and schema.
     */
    async generateStructuredData<T>(
        prompt: string,
        schema: Schema,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<T> {
        await this.ensureInitialized();
        const config: GenerationConfig = {
            responseMimeType: 'application/json',
            responseSchema: schema
        };
        if (thinkingBudget) {
            config.thinkingConfig = { thinkingBudget };
        }

        const modelCallback = getGenerativeModel(ai, {
            model: this.model!.model,
            generationConfig: config,
            systemInstruction
        });

        const result = await modelCallback.generateContent(prompt);
        const text = result.response.text();
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            console.error('[FirebaseAIService] JSON parse failed:', text, e);
            throw e;
        }
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
        const modelCallback = getGenerativeModel(ai, {
            model: this.model!.model,
            systemInstruction
        });

        const chatSession = modelCallback.startChat({ history });
        const result = await chatSession.sendMessage(newMessage);
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
            tools: [{ googleSearch: {} } as any]
        });

        return await modelWithSearch.generateContent(prompt);
    }

    /**
     * ADVANCED: Live API for real-time bi-directional communication.
     */
    async getLiveModel(systemInstruction?: string): Promise<LiveGenerativeModel> {
        await this.ensureInitialized();
        return getLiveGenerativeModel(ai, {
            model: 'gemini-2.0-flash-exp', // Live usually needs newest models
            systemInstruction
        });
    }

    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.bootstrap();
        }
    }

    private handleError(error: unknown): AppException {
        console.error('[FirebaseAIService] Generation Error:', error);

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
