import { logger } from '@/utils/logger';
import { Editing } from '@/services/image/EditingService';

const DATA_URI_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

export const EditImageWithAnnotationsTool: any = {
    name: 'edit_image_with_annotations',
    description: 'Edit an existing image using spatial annotations to define regions for specific edits. Used for iterative visual refinement.',
    schema: {
        type: 'object',
        properties: {
            imageId: { type: 'string', description: 'ID of the original image to edit' },
            imageData: { type: 'string', description: 'Base64 data URI for the source image. Required for live editing.' },
            annotations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        color: { type: 'string', enum: ['red', 'blue', 'yellow'] },
                        cx: { type: 'number' },
                        cy: { type: 'number' },
                        r: { type: 'number' }
                    },
                    required: ['color', 'cx', 'cy', 'r']
                }
            },
            colorPrompts: {
                type: 'object',
                properties: {
                    red: { type: 'string' },
                    blue: { type: 'string' },
                    yellow: { type: 'string' }
                }
            }
        },
        required: ['imageId', 'annotations', 'colorPrompts']
    },
    execute: async (args: any, context?: any) => {
        logger.info(`Executing edit_image_with_annotations for image ${args.imageId}`);
        try {
            const imageData = args.imageData || context?.imageData || context?.sourceImage;
            if (!imageData || typeof imageData !== 'string') {
                return {
                    toolError: 'Live image editing requires a source image data URI. No edit was performed.',
                    code: 'SOURCE_IMAGE_REQUIRED',
                    urls: []
                };
            }

            const match = imageData.match(DATA_URI_REGEX);
            if (!match) {
                return {
                    toolError: 'Source image must be an image data URI.',
                    code: 'INVALID_SOURCE_IMAGE',
                    urls: []
                };
            }

            const annotationSummary = args.annotations
                .map((ann: any) => `${ann.color} circle at (${ann.cx}, ${ann.cy}) radius ${ann.r}: ${args.colorPrompts?.[ann.color] || 'apply requested edit'}`)
                .join('\n');
            const prompt = `Apply these spatial annotation edits to the image. Preserve all unmarked regions.\n${annotationSummary}`;

            const result = await Editing.editImage({
                image: { mimeType: match[1]!, data: match[2]! },
                prompt,
                forceHighFidelity: true,
                model: 'pro'
            });

            if (!result?.url) {
                return {
                    toolError: 'Image editing backend returned no image.',
                    code: 'NO_IMAGE_RETURNED',
                    urls: []
                };
            }

            return {
                success: true,
                editedImageId: result.id,
                message: `Applied annotations to image ${args.imageId}`,
                annotations: args.annotations,
                urls: [result.url]
            };
        } catch (error) {
            logger.error('Failed to execute edit_image_with_annotations tool', error);
            const msg = error instanceof Error ? error.message : String(error);
            const isConfigError = msg.includes('failed-precondition') || msg.includes('not configured') || msg.includes('not found') || msg.includes('404');
            
            return {
                toolError: isConfigError ? 'Live image editing is currently unavailable due to missing provider configuration or missing model.' : 'Failed to edit image.',
                details: msg,
                urls: []
            };
        }
    }
};
