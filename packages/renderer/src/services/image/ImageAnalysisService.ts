import { logger } from '@/utils/logger';
import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { withServiceError } from '@/lib/errors';
import type { Part, Schema } from 'firebase/ai';

export interface Box2D {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
}

export interface DetectedObject {
    label: string;
    box: Box2D;
}

export interface ImageAnalysisResult {
    objects: DetectedObject[];
}

export class ImageAnalysisService {
    /**
     * Detect objects in an image using Gemini's vision capabilities.
     * Returns a list of objects with labels and normalized box_2d coordinates [0..1000].
     * 
     * @param imageBase64 The base64 encoded image Data URI
     * @param prompt Optional context for the detection (e.g. "Find all instruments")
     */
    async detectObjects(imageBase64: string, prompt: string = 'Detect all prominent objects in the image. For each object, provide its label and bounding box coordinates (normalized 0-1000).'): Promise<DetectedObject[]> {
        return withServiceError('ImageAnalysisService', 'detectObjects', async () => {
            logger.info('Analyzing image for object detection...');
            
            const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
            
            const schema: Schema = {
                type: 'array',
                nullable: false,
                items: {
                    type: 'object',
                    nullable: false,
                    properties: {
                        label: { type: 'string', description: 'A descriptive label for the object detected', nullable: false },
                        box: {
                            type: 'object',
                            description: 'Bounding box coordinates normalized from 0 to 1000',
                            nullable: false,
                            properties: {
                                ymin: { type: 'number', nullable: false },
                                xmin: { type: 'number', nullable: false },
                                ymax: { type: 'number', nullable: false },
                                xmax: { type: 'number', nullable: false }
                            },
                            required: ['ymin', 'xmin', 'ymax', 'xmax']
                        }
                    },
                    required: ['label', 'box']
                }
            };
            
            const parts: Part[] = [
                { text: prompt },
                { inlineData: { mimeType, data: cleanBase64 } }
            ];
            
            const results = await firebaseAI.generateStructuredData<DetectedObject[]>(
                parts,
                schema,
                undefined,
                undefined,
                AI_MODELS.TEXT.FAST
            );
            
            logger.info(`Detected ${results?.length || 0} objects.`);
            return results || [];
        });
    }

    /**
     * Extract a base64 PNG segmentation mask for a target object using Gemini.
     * 
     * @param imageBase64 The base64 encoded image Data URI
     * @param targetLabel The object label to segment (e.g., "The red car")
     */
    async extractSegmentationMask(imageBase64: string, targetLabel: string): Promise<string> {
        return withServiceError('ImageAnalysisService', 'extractSegmentationMask', async () => {
            logger.info(`Extracting segmentation mask for label: ${targetLabel}`);
            
            const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';
            
            // We use thinkingBudget: 0 for fast base64 extractions if that is a valid parameter format in the config.
            // The prompt directly instructs the model to return a pure base64 representation of the mask.
            const prompt = `You are a computer vision model. Generate a pixel-accurate segmentation mask for "${targetLabel}" in the provided image.
Return ONLY valid JSON containing a single field "maskBase64" which is a base64-encoded PNG image of the mask (white for the object, black for the background).`;

            const schema: Schema = {
                type: 'object',
                nullable: false,
                properties: {
                    maskBase64: { 
                        type: 'string', 
                        description: 'A pure base64-encoded PNG string (without data URI prefix) containing the binary mask',
                        nullable: false
                    }
                },
                required: ['maskBase64']
            };
            
            const parts: Part[] = [
                { text: prompt },
                { inlineData: { mimeType, data: cleanBase64 } }
            ];

            const result = await firebaseAI.generateStructuredData<{ maskBase64: string }>(
                parts,
                schema,
                { thinkingBudget: 0, includeThoughts: false }, // config with thinking budget
                undefined, // system instructions
                AI_MODELS.TEXT.FAST
            );

            if (!result || !result.maskBase64) {
                throw new Error('Failed to extract a valid segmentation mask from the AI response.');
            }

            return result.maskBase64;
        });
    }
}

export const imageAnalysisService = new ImageAnalysisService();
