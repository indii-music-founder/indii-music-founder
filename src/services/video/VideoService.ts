import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export interface VideoGenerationOptions {
    prompt: string;
    image?: { mimeType: string; data: string }; // Base64 data
    mask?: { mimeType: string; data: string }; // Base64 data
    anchors?: { mimeType: string; data: string }[];
    resolution?: '720p' | '1080p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    durationSeconds?: number;
}

export class VideoService {

    async generateMotionBrush(image: { mimeType: string; data: string }, mask: { mimeType: string; data: string }): Promise<string | null> {
        try {
            // Step 1: Plan Motion
            const analysisRes = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: {
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { inlineData: { mimeType: 'image/png', data: mask.data } },
                        { text: "Describe masked area motion prompt. JSON: {video_prompt}" }
                    ]
                },
                config: { responseMimeType: 'application/json', ...AI_CONFIG.THINKING.HIGH }
            });
            const plan = AI.parseJSON(analysisRes.text);

            // Step 2: Generate Video
            const uri = await AI.generateVideo({
                model: AI_MODELS.VIDEO.GENERATION,
                prompt: plan.video_prompt || "Animate",
                image: { imageBytes: image.data, mimeType: image.mimeType },
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
            });

            return uri || null;
        } catch (e) {
            console.error("Motion Brush Error:", e);
            throw e;
        }
    }

    async generateVideo(options: VideoGenerationOptions): Promise<string | null> {
        try {
            let model = AI_MODELS.VIDEO.GENERATION; // Default to generation model
            let config: any = {
                numberOfVideos: 1,
                resolution: options.resolution || '720p',
                aspectRatio: options.aspectRatio || '16:9'
            };

            if (options.anchors && options.anchors.length > 0) {
                model = AI_MODELS.VIDEO.GENERATION;
                // Note: The AI Service needs to support referenceImages in config if we pass them here
                // Assuming AI.generateVideo handles this structure or we need to update AI Service types
                config.referenceImages = options.anchors.map(img => ({
                    image: { imageBytes: img.data, mimeType: img.mimeType },
                    referenceType: 'ASSET'
                }));
            }

            const inputImage = options.image ? { imageBytes: options.image.data, mimeType: options.image.mimeType } : undefined;

            const uri = await AI.generateVideo({
                model,
                prompt: options.prompt,
                image: inputImage,
                config
            });

            return uri || null;
        } catch (e) {
            console.error("Video Generation Error:", e);
            throw e;
        }
    }

    async generateKeyframeTransition(startImage: { mimeType: string; data: string }, endImage: { mimeType: string; data: string }, prompt: string): Promise<string | null> {
        try {
            const uri = await AI.generateVideo({
                model: AI_MODELS.VIDEO.GENERATION,
                prompt: prompt || "Transition",
                image: { imageBytes: startImage.data, mimeType: startImage.mimeType },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '16:9',
                    lastFrame: { imageBytes: endImage.data, mimeType: endImage.mimeType }
                }
            });
            return uri || null;
        } catch (e) {
            console.error("Keyframe Transition Error:", e);
            throw e;
        }
    }

    // Helper to fetch the video blob from the URI (which might be a signed URL or API endpoint)
    async fetchVideoBlob(uri: string): Promise<string> {
        // In legacy code: const res = await fetch(`${uri}&key=${process.env.API_KEY}`);
        // We need to handle the API key injection if it's not already in the URI
        const apiKey = import.meta.env.VITE_API_KEY;
        const fetchUrl = uri.includes('key=') ? uri : `${uri}&key=${apiKey}`;

        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
}

export const Video = new VideoService();
