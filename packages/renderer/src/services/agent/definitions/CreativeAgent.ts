import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { DirectorTools } from '../tools/DirectorTools';
import systemPrompt from '@agents/creative/prompt.md?raw';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';
import { McpTools } from '../tools/McpTools';
import { StorageTools } from '../tools/StorageTools';
import { VideoProjectTools } from '../tools/VideoProjectTools';

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
        'audit_asset_resolutions'
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
            }
        ]
    }]

};

// Freeze the schema to prevent cross-test contamination or runtime leaks
freezeAgentConfig(CreativeAgent);
