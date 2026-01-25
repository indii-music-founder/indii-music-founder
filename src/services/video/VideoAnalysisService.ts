
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { firebaseAI } from '../ai/FirebaseAIService';
import {
    SceneDetectionSchema,
    SceneDetection,
    AutoCaptionSchema,
    AutoCaption,
    HighlightReelSchema,
    HighlightReel,
    VideoMetadataSchema,
    VideoMetadata
} from '@/modules/video/schemas/VideoAnalysisSchema';
import { Part } from 'firebase/ai';
import { AI_MODELS } from '@/core/config/ai-models';

export class VideoAnalysisService {
    private static instance: VideoAnalysisService;

    static getInstance(): VideoAnalysisService {
        if (!this.instance) this.instance = new VideoAnalysisService();
        return this.instance;
    }

    /**
     * Detect scenes in a video using AI analysis
     */
    async detectScenes(videoUrl: string): Promise<SceneDetection> {
        return this.analyzeVideo<SceneDetection>(
            videoUrl,
            SceneDetectionSchema,
            'Analyze this video and detect distinct scenes. Identified key visual changes, dominant colors, and objects.'
        );
    }

    /**
     * Generate captions/subtitles for the video
     */
    async generateCaptions(videoUrl: string): Promise<AutoCaption> {
        return this.analyzeVideo<AutoCaption>(
            videoUrl,
            AutoCaptionSchema,
            'Transcribe the audio in this video and generate timed captions. Identify the language.'
        );
    }

    /**
     * Suggest highlights for a promotional clip
     */
    async suggestHighlights(videoUrl: string, targetDuration: number = 60): Promise<HighlightReel> {
        return this.analyzeVideo<HighlightReel>(
            videoUrl,
            HighlightReelSchema,
            `Analyze this video and suggest the best highlights for a ${targetDuration} second promotional clip. Focus on high-energy or significant moments.`
        );
    }

    /**
     * Extract technical and content metadata
     */
    async extractMetadata(videoUrl: string): Promise<VideoMetadata> {
        return this.analyzeVideo<VideoMetadata>(
            videoUrl,
            VideoMetadataSchema,
            'Extract technical metadata (duration, resolution, fps, audio presence) and content metadata (dominant colors, tags) from this video.'
        );
    }

    /**
     * Generic video analysis method
     */
    private async analyzeVideo<T>(
        videoUrl: string,
        zodSchema: z.ZodType<T>,
        instruction: string
    ): Promise<T> {
        const videoPart = this.getVideoPart(videoUrl);
        const schema = this.convertZodToFirebaseSchema(zodSchema);

        const prompt = `${instruction}\n\nReview the video provided.`;

        try {
            // We use generateStructuredData which handles validity checks
            const result = await firebaseAI.generateStructuredData<T>(
                [
                    { text: prompt },
                    videoPart
                ] as Part[], // Cast as Part[] to support potential custom part structures
                schema,
                undefined, // thinking budget
                undefined, // system instruction
                AI_MODELS.TEXT.AGENT // Using Gemini 3 Pro (supports multimodal)
                // Note: AI_MODELS.GEMINI.PRO_1_5 is a placeholder, check actual config.
                // Using valid model KEY or letting service default.
                // But Multimodal usually requires Pro or Flash 1.5+.
                // 'gemini-1.5-pro-preview' or similar via AI_MODELS
            );

            // Double check with Zod
            return zodSchema.parse(result);
        } catch (error) {
            console.error('Video analysis failed:', error);
            throw error;
        }
    }

    /**
     * Create a Part object for the video.
     * Supports gs:// (Google Cloud Storage) URIs for Firebase AI.
     */
    private getVideoPart(videoUrl: string): Part {
        // Assumption: firebase/ai SDK (or the server-side fallback) supports fileData for gs:// URIs
        if (videoUrl.startsWith('gs://')) {
            return {
                // 'fileData' is valid in Vertex/Gemini API but might be missing in firebase/ai typescript defs
                fileData: {
                    mimeType: 'video/mp4', // Defaulting to mp4, could infer from extension
                    fileUri: videoUrl
                }
            };
        }

        // If it's a data URL (inline), usage is standard
        if (videoUrl.startsWith('data:')) {
            const matches = videoUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                return {
                    inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                    }
                };
            }
        }

        // Fallback or external URL - Treating as fileUri if possible, or might fail
        // For external URLs, we usually need to download/upload or pass as fileUri if supported by backend
        return {
            // specific type casting for video response
            fileData: {
                mimeType: 'video/mp4',
                fileUri: videoUrl
            }
        };
    }

    private convertZodToFirebaseSchema(zodSchema: z.ZodType<any>): any {
        // zod-to-json-schema returns a JSON schema usually compatible
        const jsonSchema = zodToJsonSchema(zodSchema, { target: 'openApi3' });
        // Clean up or adjust if necessary (e.g. remove $schema)
        return jsonSchema;
    }
}

export const videoAnalysisService = VideoAnalysisService.getInstance();
