import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { DirectorTools } from '../tools/DirectorTools';
import { CanvasTools } from '../tools/CanvasTools';
import systemPrompt from '@agents/creative/prompt.md?raw';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';
import { McpTools } from '../tools/McpTools';
import { StorageTools } from '../tools/StorageTools';
import { VideoProjectTools } from '../tools/VideoProjectTools';
import { VideoTools } from '../tools/VideoTools';
import { EditorTools } from '../tools/EditorTools';

const creativeRetrievalConfig = {
    canvases: {
        path: 'canvases',
        requiresUserIdFilter: true,
        description: 'Active design canvases, moodboards, and visual workspaces.',
        defaultLimit: 5
    },
    storyboards: {
        path: 'storyboards',
        requiresUserIdFilter: true,
        description: 'Multi-shot sequence plans and video storyboards.',
        defaultLimit: 5
    },
    concept_art: {
        path: 'concept_art',
        requiresUserIdFilter: true,
        description: 'Generated concept art, high-res assets, and reference images.',
        defaultLimit: 10
    }
};

const creativeRetrievalTools = buildDomainRetrievalTools('Creative', creativeRetrievalConfig);
const creativeRetrievalDeclarations = buildDomainRetrievalDeclarations('Creative', creativeRetrievalConfig);


/**
 * Creative Agent — Visual Identity & Asset Generation Specialist
... (omitting documentation comment for brevity but it will be preserved if I use targetContent)
 */
export const CreativeAgent: AgentConfig = {
    id: 'creative',
    name: 'Creative Director',
    description: 'Specializes in high-end visual design, brand identity, and asset generation.',
    color: '#00f2fe',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            ...creativeRetrievalTools,
            list_stored_assets: StorageTools.list_files,
            search_stored_assets: StorageTools.search_files,
            generate_image: DirectorTools.generate_image,
            batch_edit_images: DirectorTools.batch_edit_images,
            run_showroom_mockup: DirectorTools.run_showroom_mockup,
            generate_high_res_asset: DirectorTools.generate_high_res_asset,
            render_cinematic_grid: DirectorTools.render_cinematic_grid,
            extract_grid_frame: DirectorTools.extract_grid_frame,
            add_character_reference: DirectorTools.add_character_reference,
            analyze_audio: DirectorTools.analyze_audio,
            canvas_push: DirectorTools.canvas_push,
            generate_moodboard: DirectorTools.generate_moodboard,
            analyze_visual_trends: DirectorTools.analyze_visual_trends,
            queue_video_render: VideoProjectTools.queue_video_render,
            queue_release_canvas_render: McpTools.queue_release_canvas_render,
            audit_asset_resolutions: McpTools.audit_asset_resolutions,
            fuse_likeness: DirectorTools.fuse_likeness,
            render_typography: DirectorTools.render_typography,
            generate_mockup: DirectorTools.generate_mockup,
            render_distribution_bundle: DirectorTools.render_distribution_bundle,
            canvas_open_image: CanvasTools.canvas_open_image,
            canvas_add_layer: CanvasTools.canvas_add_layer,
            canvas_set_adjustments: CanvasTools.canvas_set_adjustments,
            canvas_export: CanvasTools.canvas_export,
            animate_still: VideoTools.animate_still,
            export_platform_assets: DirectorTools.export_platform_assets,
            scan_brand_compliance: DirectorTools.scan_brand_compliance,
            record_asset_version: DirectorTools.record_asset_version,
            promote_asset_version: DirectorTools.promote_asset_version,
            set_asset_rights: DirectorTools.set_asset_rights,
            video_list_renderable_assets: EditorTools.video_list_renderable_assets,
            video_plan_sequence: EditorTools.video_plan_sequence,
            video_plan_chain: EditorTools.video_plan_chain,
            video_render_stitch: EditorTools.video_render_stitch,
            video_render_chain: EditorTools.video_render_chain,
            video_get_render_status: EditorTools.video_get_render_status,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: [
        'generate_image',
        'list_stored_assets',
        'search_stored_assets',
        'batch_edit_images',
        'run_showroom_mockup',
        'generate_high_res_asset',
        'render_cinematic_grid',
        'extract_grid_frame',
        'add_character_reference',
        'analyze_audio',
        'canvas_push',
        'generate_moodboard',
        'analyze_visual_trends',
        'list_domain_records',
        'queue_video_render',
        'queue_release_canvas_render',
        'audit_asset_resolutions',
        'fuse_likeness',
        'render_typography',
        'generate_mockup',
        'render_distribution_bundle',
        'canvas_open_image',
        'canvas_add_layer',
        'canvas_set_adjustments',
        'canvas_export',
        'animate_still',
        'export_platform_assets',
        'scan_brand_compliance',
        'record_asset_version',
        'promote_asset_version',
        'set_asset_rights',
        'video_list_renderable_assets',
        'video_plan_sequence',
        'video_plan_chain',
        'video_render_stitch',
        'video_render_chain',
        'video_get_render_status'
    ],
    tools: [{
        functionDeclarations: [
            ...creativeRetrievalDeclarations,
            {
                name: 'list_stored_assets',
                description: 'List the user’s saved gallery images, brand assets, reference images, and recent uploads. Use before claiming that an existing asset is unavailable.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        source: { type: 'STRING', enum: ['gallery', 'brand_assets', 'reference_images', 'uploads', 'all'], description: 'Asset source to list.' },
                        limit: { type: 'NUMBER', description: 'Maximum number of assets to return.' },
                        type: { type: 'STRING', description: 'Optional media type filter, such as image or video.' }
                    },
                    required: []
                }
            },
            {
                name: 'search_stored_assets',
                description: 'Search the user’s saved gallery images, brand assets, reference images, and recent uploads by text.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'Search words to match against prompts, type, or source.' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'generate_image',
                description: 'Generate Intelligence images using text prompts with support for aspect ratios, reference images, and brand guidelines. Images are automatically saved to history.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Visual description of the image to generate (minimum 10 characters).' },
                        aspectRatio: { type: 'STRING', description: 'Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2.' },
                        count: { type: 'NUMBER', description: 'Number of images to generate (1-4).' },
                        negativePrompt: { type: 'STRING', description: 'Things to avoid in the generated image.' },
                        resolution: { type: 'STRING', description: 'Resolution tier: 4K, 2K, HD.' },
                        style: { type: 'STRING', description: 'Optional artistic style directive.' },
                        quality: { type: 'STRING', description: 'Optional generation quality setting.' },
                        seed: { type: 'STRING', description: 'Random seed for reproducible generation.' },
                        referenceImageIndex: { type: 'NUMBER', description: 'Index of a reference image from the Brand Kit.' },
                        referenceAssetIndex: { type: 'NUMBER', description: 'Index of a brand asset (logo) from the Brand Kit.' },
                        uploadedImageIndex: { type: 'NUMBER', description: 'Index of a recent upload to use as reference.' }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'batch_edit_images',
                description: 'Edit multiple uploaded images with a text instruction.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Text instruction for how to edit the images.' },
                        imageIndices: { type: 'ARRAY', description: 'Specific image indices to edit (edits all if not specified).', items: { type: 'NUMBER' } }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'run_showroom_mockup',
                description: 'Generate photorealistic product mockups for showcases (vinyl, CD, t-shirt, poster).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        productType: { type: 'STRING', description: 'Type of product (e.g., vinyl record, CD, t-shirt, poster).' },
                        scenePrompt: { type: 'STRING', description: 'Scene description including lighting, background, and staging.' }
                    },
                    required: ['productType', 'scenePrompt']
                }
            },
            {
                name: 'generate_high_res_asset',
                description: 'Generate print-quality visual assets at high resolution for physical media (CD jacket, vinyl sleeve, poster, merch).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Description of the high-resolution asset to generate.' },
                        templateType: { 
                            type: 'STRING', 
                            enum: ['cd_front', 'cd_back', 'vinyl_jacket', 'poster', 'merch', 'booklet', 'social', 'jacket', 'vinyl', 'cover'],
                            description: 'Physical format type: cd_front, cd_back, vinyl_jacket, poster, merch, booklet, social, jacket, vinyl, cover.' 
                        },
                        style: { type: 'STRING', description: 'Optional artistic style directive (e.g., "minimalist noir", "retro synthwave").' }
                    },
                    required: ['prompt', 'templateType']
                }
            },
            {
                name: 'render_cinematic_grid',
                description: 'Create a 2x2 cinematic shot grid (Wide, Medium, Close-up, Low Angle) for visual storytelling and shot composition planning.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Scene description for the cinematic grid (e.g., "lone figure walking through neon-lit alley").' },
                        sourceImageIds: { type: 'ARRAY', description: 'Optional list of source image IDs to use as references for the grid.', items: { type: 'STRING' } }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'extract_grid_frame',
                description: 'Extract a single frame from a previously generated 2x2 cinematic grid for standalone use or further editing.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        gridIndex: { type: 'NUMBER', description: 'Panel index: 0 (top-left / Wide), 1 (top-right / Medium), 2 (bottom-left / Close-up), 3 (bottom-right / Low Angle).' },
                        imageId: { type: 'STRING', description: 'Optional ID of a specific grid image. If omitted, uses the most recent cinematic grid.' }
                    },
                    required: ['gridIndex']
                }
            },
            {
                name: 'add_character_reference',
                description: 'Set a character reference image for maintaining visual consistency across multiple image generations.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        image: { type: 'STRING', description: 'Base64 data URI of the character reference image (data:image/png;base64,...).' }
                    },
                    required: ['image']
                }
            },
            {
                name: 'analyze_audio',
                description: 'Perform "Audio-to-Visual" analysis to extract BPM, key, mood, and energy from an uploaded track to guide artistic direction.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        uploadedAudioIndex: { type: 'NUMBER', description: 'Optional index of a recently uploaded audio file.' }
                    },
                    required: []
                }
            },
            {
                name: 'canvas_push',
                description: 'Push a visual asset or moodboard directly to the Agent Canvas for A2UI interaction and further design refinement.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetId: { type: 'STRING', description: 'ID of the asset to push to the canvas.' },
                        label: { type: 'STRING', description: 'Optional label for the canvas element.' }
                    },
                    required: ['assetId']
                }
            },
            {
                name: 'generate_moodboard',
                description: 'Generate a visual moodboard comprising color palettes, textures, and aesthetic inspiration for a given theme.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        theme: { type: 'STRING', description: 'The core theme, concept, or genre for the moodboard.' },
                        style: { type: 'STRING', description: 'Optional specific visual style (e.g., "cyberpunk", "minimalist").' }
                    },
                    required: ['theme']
                }
            },
            {
                name: 'analyze_visual_trends',
                description: 'Structure a visual and aesthetic trends discussion from general knowledge for a specific industry or music genre (not live data).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        industry_or_genre: { type: 'STRING', description: 'The industry or music genre to analyze (e.g., "electronic music", "streetwear").' }
                    },
                    required: ['industry_or_genre']
                }
            },
            {
                name: "queue_video_render",
                description: "Render the active video-editor project through indii's local planner. The planner automatically uses FFmpeg for direct media or HyperFrames for composed timelines, then updates the editor preview and project history.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectId: { type: "STRING", description: "Optional safety check: render only if this is the active video project." },
                        outputName: { type: "STRING", description: "Optional MP4 filename. The desktop app chooses its managed video export folder." }
                    },
                    required: []
                }
            },
            {
                name: "queue_release_canvas_render",
                description: "Render the specialized 3-8 second release canvas made from owned cover art and canonical audio. Use queue_video_render for the active editor timeline.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        releaseId: { type: "STRING" },
                        canvasType: { type: "STRING", enum: ["Spotify", "TikTok", "Instagram"] },
                        animationSpec: { type: "OBJECT" }
                    },
                    required: ["releaseId", "canvasType"]
                }
            },
            {
                name: "audit_asset_resolutions",
                description: "Audit visual asset resolutions against DSP constraints using the remote MCP backend.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        assetUrls: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["assetUrls"]
                }
            },
            {
                name: 'video_list_renderable_assets',
                description: "List the user's finished video assets with duration, aspect ratio, and download URLs. Use before planning sequences.",
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        aspectRatio: { type: 'STRING', enum: ['16:9', '9:16'], description: 'Filter by aspect ratio.' },
                        minDurationSeconds: { type: 'NUMBER', description: 'Filter by minimum duration in seconds.' }
                    }
                }
            },
            {
                name: 'video_plan_sequence',
                description: 'Plan a beat-snapped video timeline sequence from existing finished assets without rendering or spending credits.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of at least 2 asset IDs in desired order.' },
                        bpm: { type: 'NUMBER', description: 'Music BPM for beat snapping (default 120).' },
                        beatSnapped: { type: 'BOOLEAN', description: 'Whether to snap cuts to nearest beat (default true).' },
                        aspectRatio: { type: 'STRING', enum: ['16:9', '9:16'], description: 'Aspect ratio of sequence.' },
                        transitionDurationSeconds: { type: 'NUMBER', description: 'Transition overlap in seconds (default 1.0).' }
                    },
                    required: ['assetIds']
                }
            },
            {
                name: 'video_plan_chain',
                description: 'Plan a sequential beat-snapped video chain from existing assets.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of at least 2 asset IDs.' },
                        bpm: { type: 'NUMBER', description: 'Music BPM for beat snapping (default 120).' },
                        aspectRatio: { type: 'STRING', enum: ['16:9', '9:16'], description: 'Aspect ratio.' }
                    },
                    required: ['assetIds']
                }
            },
            {
                name: 'video_render_stitch',
                description: 'Submit a billable multi-segment video stitch render for an approved sequence plan. Requires explicit user approval and server cost reservation.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        planId: { type: 'STRING', description: 'Plan ID returned from video_plan_sequence.' },
                        assetIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optional asset IDs if planId is omitted.' },
                        projectId: { type: 'STRING', description: 'Associated project ID.' },
                        aspectRatio: { type: 'STRING', enum: ['16:9', '9:16'], description: 'Target aspect ratio.' }
                    }
                }
            },
            {
                name: 'video_render_chain',
                description: 'Submit a billable sequential video chain render. Requires explicit user approval and server cost reservation.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        planId: { type: 'STRING', description: 'Plan ID from video_plan_chain.' },
                        assetIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Asset IDs if planId omitted.' }
                    }
                }
            },
            {
                name: 'video_get_render_status',
                description: 'Check the real-time status of a video render job (queued, rendering, succeeded, failed) and retrieve the final video URL.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        renderId: { type: 'STRING', description: 'Render ID returned by video_render_stitch.' }
                    },
                    required: ['renderId']
                }
            },
            {
                name: 'generate_mockup',
                description: 'Generate photorealistic merchandise/media mockups (vinyl, CD, cassette, tee, hoodie, poster) using locked prompt templates enforcing 1:1 artwork fidelity.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        productType: { type: 'STRING', description: 'Product type (tee, hoodie, vinyl, cd, cassette, poster).' },
                        artworkUrl: { type: 'STRING', description: 'Artwork URL or base64 data URI.' },
                        artworkIndex: { type: 'NUMBER', description: 'Optional index of generated image.' },
                        scene: { type: 'STRING', enum: ['studio', 'lifestyle', 'flat'], description: 'Staging scene.' },
                        aspectRatio: { type: 'STRING', description: 'Aspect ratio (e.g. 1:1, 4:5).' }
                    }
                }
            },
            {
                name: 'render_distribution_bundle',
                description: 'Direct distribution packaging enforcing DSP/print specs (DPI, bleed math, sRGB color space, file caps) with SHA-256 verifiable delivery manifests.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        masterUrl: { type: 'STRING', description: 'Data URI or hosted image URL of the master artwork.' },
                        masterIndex: { type: 'NUMBER', description: 'Index of the master image in generatedHistory.' },
                        profileIds: {
                            type: 'ARRAY',
                            items: { type: 'STRING' },
                            description: 'Target delivery profile IDs (e.g. spotify-cover, apple-itunes-cover, print-12in-sleeve-300dpi, cd-jewel-300dpi).'
                        },
                        trackId: { type: 'STRING', description: 'Track/Release ID for manifest association.' },
                        overrideReason: { type: 'STRING', description: 'Explicit reason if overriding brand compliance gate.' }
                    }
                }
            },
            {
                name: 'fuse_likeness',
                description: 'Fuse verified user likeness onto generated subjects with cosine similarity scoring on 128-d face embeddings and best-of-N retry loop. Arbitrary external/gallery URLs rejected.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetImageIndex: { type: 'NUMBER', description: 'Index of generated subject image to fuse onto.' },
                        headshotId: { type: 'STRING', description: 'Verified Likeness ID from My Likeness or Brand Kit headshot. Arbitrary external URLs or gallery images are strictly rejected.' },
                        maxAttempts: { type: 'NUMBER', description: 'Maximum retry attempts (default 3).' }
                    },
                    required: ['targetImageIndex']
                }
            },
            {
                name: 'render_typography',
                description: 'Renders uploaded .ttf/.otf fonts as true vector glyphs via opentype.js with exact pair kerning and tracking, bypassing generative text artifacts.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        text: { type: 'STRING', description: 'Text string/wordmark to render.' },
                        fontId: { type: 'STRING', description: 'Optional uploaded font ID. If omitted, uses Brand Kit default font.' },
                        fontSize: { type: 'NUMBER', description: 'Font size in points (default 48).' },
                        x: { type: 'NUMBER', description: 'Horizontal coordinate.' },
                        y: { type: 'NUMBER', description: 'Vertical coordinate.' },
                        letterSpacing: { type: 'NUMBER', description: 'Tracking/letter spacing in font units.' },
                        fill: { type: 'STRING', description: 'CSS color or hex fill (default #ffffff).' }
                    },
                    required: ['text']
                }
            },
            {
                name: 'canvas_open_image',
                description: 'Open a gallery image into the non-destructive layer editor (returns docId).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        imageIndex: { type: 'NUMBER', description: 'Index of the gallery image.' }
                    },
                    required: ['imageIndex']
                }
            },
            {
                name: 'canvas_add_layer',
                description: 'Add a raster layer from a gallery item to the open layer doc.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        docId: { type: 'STRING', description: 'Target document ID.' },
                        imageIndex: { type: 'NUMBER', description: 'Index of the gallery image to add.' }
                    },
                    required: ['docId', 'imageIndex']
                }
            },
            {
                name: 'canvas_set_adjustments',
                description: 'Merge a non-destructive adjustment patch over the neutral stack for a raster layer.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        docId: { type: 'STRING', description: 'Document ID.' },
                        layerId: { type: 'STRING', description: 'Layer ID.' },
                        adjustments: { type: 'OBJECT', description: 'Adjustment parameters (brightness, contrast, saturation, hue, temperature, exposure, blur, vignette).' }
                    },
                    required: ['docId', 'layerId', 'adjustments']
                }
            },
            {
                name: 'canvas_export',
                description: 'Export the open layer doc as a raster PNG/JPEG history item + URL.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        docId: { type: 'STRING', description: 'Document ID.' },
                        format: { type: 'STRING', enum: ['png', 'jpeg'], description: 'Export format.' },
                        scale: { type: 'NUMBER', description: 'Export scale factor.' }
                    }
                }
            },
            {
                name: 'animate_still',
                description: 'Render a deterministic camera move (dolly/pan/tilt/ken-burns) over a still image via Remotion with subpixel easing and overscan bounds.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        imageUrl: { type: 'STRING', description: 'Data URI or hosted still image.' },
                        preset: { type: 'STRING', enum: ['dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'ken-burns'], description: 'Camera move preset.' },
                        intensity: { type: 'NUMBER', description: '0..1 move intensity (default 0.35).' },
                        durationSec: { type: 'NUMBER', description: 'Duration in seconds (default 4).' },
                        resolution: { type: 'STRING', enum: ['9:16', '16:9', '4:5'], description: 'Output resolution (default 9:16).' }
                    },
                    required: ['imageUrl']
                }
            },
            {
                name: 'export_platform_assets',
                description: 'Single-command multi-platform batch export (Spotify 3000x3000, 9:16 Stories, 16:9 YouTube, social crops) with face-anchored smart cropping and contain-blur-pad framing.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        masterUrl: { type: 'STRING', description: 'Data URI or hosted image of the master artwork.' },
                        platforms: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Target platform IDs (default: full matrix).' },
                        fit: { type: 'STRING', enum: ['cover', 'contain-blur-pad'], description: 'Framing fit mode.' },
                        download: { type: 'BOOLEAN', description: 'Whether to package downloadable zip (default true).' }
                    },
                    required: ['masterUrl']
                }
            },
            {
                name: 'scan_brand_compliance',
                description: 'CIEDE2000 delta-E color deviation and logo safe-zone analysis gating distribution export.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetIndex: { type: 'NUMBER', description: 'Index of asset in generated history or uploads.' },
                        assetId: { type: 'STRING', description: 'Explicit ID of asset to scan.' }
                    }
                }
            },
            {
                name: 'record_asset_version',
                description: 'Append-only DAG version graph node recording for provenance and audit tracking.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetId: { type: 'STRING', description: 'Asset identifier.' },
                        url: { type: 'STRING', description: 'Asset URL or data URI.' },
                        source: { type: 'STRING', enum: ['generation', 'edit', 'fusion', 'canvas-export', 'typography', 'mockup', 'export-bundle', 'upload'], description: 'Creation source.' },
                        parentVersionId: { type: 'STRING', description: 'Parent version ID if deriving from an earlier node.' },
                        provenance: { type: 'OBJECT', description: 'Provenance metadata.' },
                        compliance: { type: 'OBJECT', description: 'Compliance scan results.' },
                        tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Asset tags.' }
                    },
                    required: ['assetId', 'url', 'source']
                }
            },
            {
                name: 'promote_asset_version',
                description: 'Promote a historical version to the head of the asset version graph (non-destructive revert).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetId: { type: 'STRING', description: 'Asset identifier.' },
                        versionId: { type: 'STRING', description: 'Version ID to promote to head.' }
                    },
                    required: ['assetId', 'versionId']
                }
            },
            {
                name: 'set_asset_rights',
                description: 'Record statutory rights taxonomy and licensing metadata for an asset.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assetId: { type: 'STRING', description: 'Asset identifier.' },
                        usageRights: { type: 'STRING', enum: ['ai-generated', 'ai-assisted', 'owned-licensed', 'licensed-third-party'], description: 'Statutory usage rights taxonomy.' },
                        releaseId: { type: 'STRING', description: 'Optional associated release ID.' },
                        licenseNotes: { type: 'STRING', description: 'License notes (required for licensed-third-party).' },
                        disclosureRequired: { type: 'BOOLEAN', description: 'Whether statutory AI disclosure is required.' }
                    },
                    required: ['assetId', 'usageRights']
                }
            }
        ]
    }]

};

// Freeze the schema to prevent cross-test contamination or runtime leaks
freezeAgentConfig(CreativeAgent);
