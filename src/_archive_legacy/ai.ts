
import { GoogleGenAI, VideoGenerationReferenceType } from '@google/genai';
import { ensureApiKey, shouldRetryAuth, cleanJSON } from './utils';

declare var process: { env: { API_KEY: string } };

class AIService {
    private getClient() {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    private async retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (e: any) {
                const status = e.status || e.code;
                const msg = (e.message || e.toString()).toLowerCase();
                
                // Check for Rate Limit (429)
                if (status === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
                    if (i === retries - 1) throw e;
                    const waitTime = delay * Math.pow(2, i); // Exponential backoff: 2s, 4s, 8s
                    console.warn(`⚠️ Rate limit hit (429). Retrying in ${waitTime}ms...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    continue;
                }

                // Check for Auth (403/404)
                if (shouldRetryAuth(e)) {
                    if (i === retries - 1) throw e;
                    console.warn("⚠️ Auth error detected, refreshing key and retrying...");
                    await ensureApiKey(true);
                    continue;
                }

                throw e;
            }
        }
        throw new Error("Operation failed after retries");
    }

    /**
     * Generic wrapper for content generation (Text, Image, JSON) with auto-retry
     */
    async generateContent(options: {
        model: string;
        contents: any;
        config?: any;
        systemInstruction?: string;
    }) {
        return this.retryOperation(async () => {
            await ensureApiKey();
            const ai = this.getClient();
            
            // Construct config object
            const config = options.config || {};
            if (options.systemInstruction) config.systemInstruction = options.systemInstruction;

            return await ai.models.generateContent({
                model: options.model,
                contents: options.contents,
                config: config
            });
        });
    }

    /**
     * Wrapper for Video Generation with auto-retry
     */
    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string, mimeType: string };
        config?: any;
    }) {
        return this.retryOperation(async () => {
            await ensureApiKey();
            const ai = this.getClient();
            
            const operation = await ai.models.generateVideos({
                model: options.model,
                prompt: options.prompt,
                image: options.image,
                config: options.config
            });

            // Polling Loop
            // Note: If polling itself 429s, the outer retry loop might catch it, 
            // but strictly speaking the operation creation is what we want to retry most.
            // Once operation is created, we just poll.
            let op = operation;
            while (!op.done) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    op = await ai.operations.getVideosOperation({ operation: op });
                } catch(pollErr: any) {
                    // If polling 429s, wait a bit and try polling again, don't restart generation
                    if (pollErr.status === 429) {
                        await new Promise(r => setTimeout(r, 5000));
                        continue; 
                    }
                    throw pollErr;
                }
            }
            
            return op.response?.generatedVideos?.[0]?.video?.uri;
        });
    }

    /**
     * Helper to parse JSON safely from AI response
     */
    parseJSON(text: string | undefined) {
        return JSON.parse(cleanJSON(text || '{}'));
    }
}

export const AI = new AIService();
export { VideoGenerationReferenceType };
