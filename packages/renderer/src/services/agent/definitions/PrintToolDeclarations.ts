import { PRINT_MEDIA_PRESETS } from '@indii/shared';
import type { FunctionDeclaration } from '../types';

/** Shared schemas used by Creative and the universal tool pool. */
export const PRINT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: 'prepare_print_file',
        description: 'Reuse existing artwork and enlarge its pixels to exact print/DSP dimensions, encode PNG, and embed DPI metadata. Uses on-device AI when enlargement is needed (maximum 4×); it is not metadata-only. Aspect-ratio changes require a crop preview confirmation. Returns separate file creation, gallery saving, and version recording results.',
        parameters: {
            type: 'OBJECT',
            properties: {
                imageUri: { type: 'STRING', description: 'Asset reference (attachment-0 for the current Boardroom attachment, upload-0 for an earlier upload, boardroom-asset-0, brand-asset-0, gallery ID) or image URL/Cloud Storage URI of source artwork.' },
                presetId: { type: 'STRING', enum: PRINT_MEDIA_PRESETS.map(preset => preset.id), description: 'Use cover_art_distributor for a separate 3000 × 3000 PNG at 300 DPI without physical bleed. Choose a physical preset only for that print target.' },
                bleedMode: { type: 'STRING', enum: ['fill', 'extend'], description: 'Bleed mode: fill (crops border for bleed) or extend (mirrors edges outward).' },
                focusX: { type: 'NUMBER', description: 'Normalized focal crop center X (0.0 to 1.0, default 0.5).' },
                focusY: { type: 'NUMBER', description: 'Normalized focal crop center Y (0.0 to 1.0, default 0.5).' },
                generateGuide: { type: 'BOOLEAN', description: 'Whether to produce a preview image with trim and safe-zone lines.' }
            },
            required: ['imageUri', 'presetId']
        }
    },
    {
        name: 'get_print_job_status',
        description: 'Check the status, progress, and download output URIs of a print preparation job.',
        parameters: {
            type: 'OBJECT',
            properties: {
                jobId: { type: 'STRING', description: 'The print job ID returned by prepare_print_file.' }
            },
            required: ['jobId']
        }
    },
];
