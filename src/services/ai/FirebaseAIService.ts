import {
    getGenerativeModel,
    getLiveGenerativeModel,
    Schema,
    FunctionDeclarationsTool,
    Part,
    GenerationConfig,
    ThinkingConfig,
    InferenceMode,
    Tool,
    GenerateContentResult,
    ChatSession,
    LiveGenerativeModel,
    RequestOptions
} from 'firebase/ai';
import { ai } from '../firebase';

// Default models
const DEFAULT_MODEL = 'gemini-1.5-flash';

export interface Message {
    role: 'user' | 'model';
    parts: Part[];
}

export class FirebaseAIService {

    /**
     * Generate text from a prompt.
     */
    async generateText(
        prompt: string,
        modelName: string = DEFAULT_MODEL,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<string> {
        const generationConfig: GenerationConfig = {};
        if (thinkingBudget) {
            generationConfig.thinkingConfig = { thinkingBudget };
        }

        const modelCallback = getGenerativeModel(ai, {
            model: modelName,
            generationConfig,
            systemInstruction
        });

        const result = await modelCallback.generateContent(prompt);
        return result.response.text();
    }

    /**
     * Generate structured data from a prompt and schema.
     */
    async generateStructuredData<T>(
        prompt: string,
        schema: Schema,
        modelName: string = DEFAULT_MODEL,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<T> {
        const generationConfig: GenerationConfig = {
            responseMimeType: 'application/json',
            responseSchema: schema
        };
        if (thinkingBudget) {
            generationConfig.thinkingConfig = { thinkingBudget };
        }

        const modelCallback = getGenerativeModel(ai, {
            model: modelName,
            generationConfig,
            systemInstruction
        });

        const result = await modelCallback.generateContent(prompt);
        const text = result.response.text();
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            console.error('Failed to parse (or empty) JSON response:', text, e);
            throw e;
        }
    }

    /**
     * Start a chat session or send a message to an existing one.
     * Note: This helper creates a new session for simplicity in this method.
     * For persistent chat, you'd typically keep the `ChatSession` instance.
     */
    async chat(
        history: Message[],
        newMessage: string,
        modelName: string = DEFAULT_MODEL,
        thinkingBudget?: number,
        systemInstruction?: string
    ): Promise<string> {
        const generationConfig: GenerationConfig = {};
        if (thinkingBudget) {
            generationConfig.thinkingConfig = { thinkingBudget };
        }

        const modelCallback = getGenerativeModel(ai, {
            model: modelName,
            generationConfig,
            systemInstruction
        });

        const chatSession = modelCallback.startChat({
            history: history
        });

        const result = await chatSession.sendMessage(newMessage);
        return result.response.text();
    }

    /**
     * Analyze an image (base64).
     */
    async analyzeImage(
        prompt: string,
        imageBase64: string,
        modelName: string = DEFAULT_MODEL
    ): Promise<string> {
        const modelCallback = getGenerativeModel(ai, { model: modelName });

        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const imagePart: Part = {
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg' // Adjust or detect if needed, keeping simple for now
            }
        };

        const result = await modelCallback.generateContent([prompt, imagePart]);
        return result.response.text();
    }

    /**
     * Analyze a generic file (Video, Audio, PDF) that has been converted to a GenerativePart.
     */
    async analyzeMultimodal(
        prompt: string,
        parts: Part[],
        modelName: string = DEFAULT_MODEL
    ): Promise<string> {
        const modelCallback = getGenerativeModel(ai, { model: modelName });
        const result = await modelCallback.generateContent([prompt, ...parts]);
        return result.response.text();
    }

    /**
     * Generate text with Google Search grounding.
     */
    async generateGroundedText(
        prompt: string,
        modelName: string = DEFAULT_MODEL
    ): Promise<GenerateContentResult> {
        // Correct usage of Tool for web:
        // tools: [{ googleSearch: {} }] as per docs
        const tools: Tool[] = [{ googleSearch: {} }];

        const modelCallback = getGenerativeModel(ai, {
            model: modelName,
            tools: tools
        });

        return await modelCallback.generateContent(prompt);
    }

    /**
     * Call function with defined tools.
     */
    async callFunction(
        prompt: string,
        tools: FunctionDeclarationsTool[],
        modelName: string = DEFAULT_MODEL
    ): Promise<GenerateContentResult> {
        const modelCallback = getGenerativeModel(ai, {
            model: modelName,
            tools: tools
        });

        return await modelCallback.generateContent(prompt);
    }

    /**
     * Get a LiveGenerativeModel for streaming.
     */
    getLiveModel(
        modelName: string = 'gemini-2.0-flash-exp',
        systemInstruction?: string
    ): LiveGenerativeModel {
        return getLiveGenerativeModel(ai, {
            model: modelName,
            systemInstruction
        });
    }

}

export const firebaseAIService = new FirebaseAIService();
