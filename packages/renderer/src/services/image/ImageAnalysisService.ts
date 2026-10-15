import { logger } from '@/utils/logger';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { withServiceError } from '@/lib/errors';
import { CloudStorageService } from '@/services/CloudStorageService';
import { segmentationContour, detectionBox } from './segmentationGeometry';
import type { Part, Schema } from '@/shared/types/ai.dto';

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
    /** Vision analysis needs a preview, not the full PNG artwork payload. */
    private async prepareAnalysisImage(imageBase64: string): Promise<{ mimeType: string; data: string }> {
        const source = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
        const { dataUri } = await CloudStorageService.compressImage(source, {
            maxWidth: 1024, maxHeight: 1024, quality: 0.8, format: 'jpeg',
        });
        const data = dataUri.split(',')[1];
        if (!data) throw new Error('Could not prepare this image for object analysis.');
        return { mimeType: 'image/jpeg', data };
    }

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
            
            const analysisImage = await this.prepareAnalysisImage(imageBase64);
            
            const schema: Schema = {
                type: 'array',
                nullable: false,
                items: {
                    type: 'object',
                    nullable: false,
                    properties: {
                        label: { type: 'string', description: 'A descriptive label for the object detected', nullable: false },
                        box_2d: {
                            type: 'array', nullable: false,
                            description: '[ymin, xmin, ymax, xmax], each normalized 0-1000 relative to the entire image, including any frame and padding.',
                            items: { type: 'number', nullable: false },
                        }
                    },
                    required: ['label', 'box_2d']
                }
            };
            
            const parts: Part[] = [
                { text: `${prompt} Use the key box_2d for [ymin, xmin, ymax, xmax], normalized to the entire image including its frame and padding.` },
                { inlineData: analysisImage }
            ];
            
            const results = await AutonomousIntelligence.generateStructuredData<Array<{ label: string; box_2d: number[] }>>(
                parts,
                schema,
                undefined,
                undefined,
                INTELLIGENCE_MODELS.TEXT.FAST
            );
            
            logger.info(`Detected ${results?.length || 0} objects.`);
            return (results || []).map(object => ({ label: object.label, box: detectionBox(object.box_2d) }));
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
            
            const analysisImage = await this.prepareAnalysisImage(imageBase64);
            
            const prompt = `Give the segmentation contour for the object labelled "${targetLabel}".
Return JSON with a single "mask" polygon of objects with explicit "x" and "y" properties, normalized to 0-1000 relative to the ENTIRE provided image, including any frame or padding. x is horizontal (left to right); y is vertical (top to bottom). Trace the visible object boundary tightly. Return coordinates, not encoded image bytes or ambiguous coordinate pairs.`;
            const schema: Schema = {
                type: 'object', nullable: false,
                properties: {
                    mask: {
                        type: 'array', nullable: false,
                        description: 'Visible object contour with named horizontal x and vertical y coordinates, 0-1000.',
                        items: {
                            type: 'object', nullable: false,
                            properties: {
                                x: { type: 'number', nullable: false, description: 'Horizontal position from left, 0-1000.' },
                                y: { type: 'number', nullable: false, description: 'Vertical position from top, 0-1000.' },
                            },
                            required: ['x', 'y'],
                        },
                    },
                },
                required: ['mask'],
            };

            const parts: Part[] = [
                { text: prompt },
                { inlineData: analysisImage }
            ];

            const result = await AutonomousIntelligence.generateStructuredData<{ mask: Array<{ x: number; y: number }> }>(
                parts, schema, undefined, undefined, INTELLIGENCE_MODELS.TEXT.FAST
            );
            const source = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
            const image = new Image();
            image.src = source;
            await image.decode();
            const contour = segmentationContour(result?.mask, image.naturalWidth, image.naturalHeight);
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = image.naturalWidth;
            maskCanvas.height = image.naturalHeight;
            const context = maskCanvas.getContext('2d');
            if (!context) throw new Error('Could not render the object selection.');
            context.fillStyle = '#000000';
            context.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            context.fillStyle = '#ffffff';
            context.beginPath();
            contour.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
            context.closePath();
            context.fill();
            return maskCanvas.toDataURL('image/png').split(',')[1]!;

        });
    }
}

export const imageAnalysisService = new ImageAnalysisService();
