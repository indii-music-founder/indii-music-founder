import { logger } from '@/utils/logger';
import { Editing } from '@/services/image/EditingService';

const DATA_URI_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;
const MAX_ANNOTATION_SOURCE_BYTES = 14 * 1024 * 1024;
const MAX_ANNOTATIONS = 50;
const MAX_ANNOTATION_PROMPT_LENGTH = 2_000;
const ANNOTATION_COLORS = ['red', 'blue', 'yellow'] as const;

type AnnotationColor = typeof ANNOTATION_COLORS[number];

interface SpatialAnnotation {
    color: AnnotationColor;
    cx: number;
    cy: number;
    r: number;
}

function bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

async function resolveSourceImage(source: unknown): Promise<{ mimeType: string; data: string }> {
    if (typeof source !== 'string' || !source.trim()) {
        throw new Error('Live image editing requires a source image URL or data URI.');
    }

    const dataUriMatch = source.match(DATA_URI_REGEX);
    if (dataUriMatch) {
        const estimatedBytes = Math.ceil(dataUriMatch[2]!.length * 3 / 4);
        if (estimatedBytes === 0 || estimatedBytes > MAX_ANNOTATION_SOURCE_BYTES) {
            throw new Error('Annotation source image is empty or exceeds the 14 MiB limit.');
        }
        return { mimeType: dataUriMatch[1]!, data: dataUriMatch[2]! };
    }

    let url: URL;
    try {
        url = new URL(source);
    } catch {
        throw new Error('Source image must be an HTTPS URL or image data URI.');
    }
    if (url.protocol !== 'https:') {
        throw new Error('Remote annotation sources must use HTTPS.');
    }

    const response = await fetch(url.toString(), { credentials: 'omit' });
    if (!response.ok) {
        throw new Error(`Unable to load the annotation source image (${response.status}).`);
    }
    const mimeType = (response.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase();
    if (!mimeType.startsWith('image/')) {
        throw new Error('Annotation source URL did not return an image.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ANNOTATION_SOURCE_BYTES) {
        throw new Error('Annotation source image is empty or exceeds the 14 MiB limit.');
    }
    return { mimeType, data: bytesToBase64(bytes) };
}

function validateAnnotations(annotations: unknown, colorPrompts: unknown): SpatialAnnotation[] {
    if (!Array.isArray(annotations) || annotations.length === 0) {
        throw new Error('At least one spatial annotation is required.');
    }
    if (annotations.length > MAX_ANNOTATIONS) {
        throw new Error(`A maximum of ${MAX_ANNOTATIONS} annotations can be applied at once.`);
    }
    if (!colorPrompts || typeof colorPrompts !== 'object' || Array.isArray(colorPrompts)) {
        throw new Error('Annotation edit instructions are required.');
    }

    const prompts = colorPrompts as Record<string, unknown>;
    return annotations.map((annotation, index) => {
        if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
            throw new Error(`Annotation ${index + 1} is invalid.`);
        }
        const candidate = annotation as Record<string, unknown>;
        if (typeof candidate.color !== 'string' || !ANNOTATION_COLORS.includes(candidate.color as AnnotationColor)) {
            throw new Error(`Annotation ${index + 1} must use red, blue, or yellow.`);
        }
        if (
            typeof candidate.cx !== 'number' || !Number.isFinite(candidate.cx) || candidate.cx < 0 ||
            typeof candidate.cy !== 'number' || !Number.isFinite(candidate.cy) || candidate.cy < 0 ||
            typeof candidate.r !== 'number' || !Number.isFinite(candidate.r) || candidate.r <= 0
        ) {
            throw new Error(`Annotation ${index + 1} must have finite, non-negative coordinates and a positive radius.`);
        }

        const prompt = prompts[candidate.color];
        if (typeof prompt !== 'string' || !prompt.trim()) {
            throw new Error(`Add edit instructions for the ${candidate.color} annotation regions.`);
        }
        if (prompt.length > MAX_ANNOTATION_PROMPT_LENGTH) {
            throw new Error(`${candidate.color} annotation instructions exceed ${MAX_ANNOTATION_PROMPT_LENGTH} characters.`);
        }

        return {
            color: candidate.color as AnnotationColor,
            cx: candidate.cx,
            cy: candidate.cy,
            r: candidate.r
        };
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EditImageWithAnnotationsTool: any = {
    name: 'edit_image_with_annotations',
    description: 'Edit an existing image using spatial annotations to define regions for specific edits. Used for iterative visual refinement.',
    schema: {
        type: 'object',
        properties: {
            imageId: { type: 'string', description: 'ID of the original image to edit' },
            imageData: { type: 'string', description: 'Base64 data URI for the source image.' },
            imageUrl: { type: 'string', description: 'HTTPS URL for the source image when a data URI is not available.' },
            maskData: { type: 'string', description: 'PNG data URI containing a black background and white annotated regions.' },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (args: any, context?: any) => {
        logger.info(`Executing edit_image_with_annotations for image ${args.imageId}`);
        try {
            const annotations = validateAnnotations(args.annotations, args.colorPrompts);
            const sourceImage = await resolveSourceImage(
                args.imageData || args.imageUrl || context?.imageData || context?.imageUrl || context?.sourceImage
            );
            if (args.maskData && (typeof args.maskData !== 'string' || !args.maskData.startsWith('data:image/png;base64,'))) {
                throw new Error('Annotation masks must be PNG data URIs.');
            }
            const maskImage = args.maskData ? await resolveSourceImage(args.maskData) : undefined;

            const annotationSummary = annotations
                .map(ann => `${ann.color} circle at (${ann.cx}, ${ann.cy}) radius ${ann.r}: ${args.colorPrompts[ann.color].trim()}`)
                .join('\n');
            const prompt = `Apply these spatial annotation edits to the image. Preserve all unmarked regions.\n${annotationSummary}`;

            const result = await Editing.editImage({
                image: sourceImage,
                mask: maskImage,
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
                annotations,
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
