import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';
import { VideoTools } from '@/services/agent/tools/VideoTools';
import { NarrativeTools } from '@/services/agent/tools/NarrativeTools';
import { DirectorTools } from '@/services/agent/tools/DirectorTools';
import { MusicTools } from '@/services/agent/tools/MusicTools';
import { CanvasTools } from '@/services/agent/tools/CanvasTools';
import { CommerceTools } from '@/services/agent/tools/CommerceTools';
import { MediaTools } from '@/services/agent/tools/MediaTools';

export const DirectorAgent: AgentConfig = {
    id: 'director',
    name: 'Creative Director',
    description: 'Oversees the creative vision and direction of projects.',
    color: 'bg-pink-500',
    category: 'manager',
    systemPrompt,
    get functions() {
        return {
            generate_image: DirectorTools.generate_image,
            batch_edit_images: DirectorTools.batch_edit_images,
            generate_video: VideoTools.generate_video,
            batch_edit_videos: VideoTools.batch_edit_videos,
            run_showroom_mockup: DirectorTools.run_showroom_mockup,
            generate_high_res_asset: DirectorTools.generate_high_res_asset,
            set_entity_anchor: DirectorTools.set_entity_anchor,
            generate_visual_script: NarrativeTools.generate_visual_script,
            render_cinematic_grid: DirectorTools.render_cinematic_grid,
            extract_grid_frame: DirectorTools.extract_grid_frame,
            interpolate_sequence: VideoTools.interpolate_sequence,
            analyze_audio: MusicTools.analyze_audio,
            canvas_push: CanvasTools.canvas_push,
            mockup_merchandise: CommerceTools.mockup_merchandise,
            generate_mockup: CommerceTools.generate_mockup,
            export_platform_assets: MediaTools.export_platform_assets,
            render_distribution_bundle: MediaTools.render_distribution_bundle,
            animate_still: VideoTools.animate_still,
            canvas_open_image: CanvasTools.canvas_open_image,
            canvas_add_layer: CanvasTools.canvas_add_layer,
            canvas_set_adjustments: CanvasTools.canvas_set_adjustments,
            canvas_export: CanvasTools.canvas_export,
            fuse_likeness: DirectorTools.fuse_likeness,
            render_typography: DirectorTools.render_typography,
            scan_brand_compliance: DirectorTools.scan_brand_compliance,
            record_asset_version: DirectorTools.record_asset_version,
            promote_asset_version: DirectorTools.promote_asset_version,
            set_asset_rights: DirectorTools.set_asset_rights,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['generate_image', 'batch_edit_images', 'generate_video', 'batch_edit_videos', 'run_showroom_mockup', 'generate_high_res_asset', 'set_entity_anchor', 'generate_visual_script', 'render_cinematic_grid', 'extract_grid_frame', 'interpolate_sequence', 'analyze_audio', 'canvas_push', 'mockup_merchandise', 'generate_mockup', 'export_platform_assets', 'render_distribution_bundle', 'animate_still', 'canvas_open_image', 'canvas_add_layer', 'canvas_set_adjustments', 'canvas_export', 'fuse_likeness', 'render_typography', 'scan_brand_compliance', 'record_asset_version', 'promote_asset_version', 'set_asset_rights'],
    tools: [{
        functionDeclarations: [
            {
                name: "generate_image",
                description: "Generate images based on a text prompt.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "The visual description." },
                        count: { type: "NUMBER", description: "Number of images (default 1)." },
                        negativePrompt: { type: "STRING", description: "What to avoid." },
                        aspectRatio: { type: "STRING", description: "Aspect ratio (e.g., '16:9', '1:1', '9:16')." },
                        resolution: { type: "STRING", description: "Resolution (e.g., '1024x1024')." }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "batch_edit_images",
                description: "Edit uploaded images using a text instruction.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "The editing instruction." },
                        imageIndices: { type: "ARRAY", description: "Optional list of indices to edit.", items: { type: "NUMBER" } }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "generate_video",
                description: "Generate a video from a text prompt or start image.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Description of motion/scene." },
                        image: { type: "STRING", description: "Optional base64 start image." },
                        duration: { type: "NUMBER", description: "Duration in seconds." }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "batch_edit_videos",
                description: "Edit/grade uploaded videos with an instruction.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Editing instruction." },
                        videoIndices: { type: "ARRAY", description: "Optional list of indices.", items: { type: "NUMBER" } }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "run_showroom_mockup",
                description: "Generate a product mockup in the Showroom.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productType: { type: "STRING", enum: ['T-Shirt', 'Hoodie', 'Mug', 'Bottle', 'Poster', 'Phone Screen'], description: "The type of product to generate." },
                        scenePrompt: { type: "STRING", description: "Visual description of the scene." }
                    },
                    required: ["productType", "scenePrompt"]
                }
            },
            {
                name: "generate_high_res_asset",
                description: "Generate a 4K/UHD asset for physical media printing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Visual description of the asset." },
                        templateType: { type: "STRING", description: "The physical format (e.g. 'cd_front', 'vinyl_jacket')." },
                        style: { type: "STRING", description: "Artistic style." }
                    },
                    required: ["prompt", "templateType"]
                }
            },
            {
                name: "set_entity_anchor",
                description: "Set a global reference image for character consistency (Entity Anchor).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        image: { type: "STRING", description: "Base64 encoded image." }
                    },
                    required: ["image"]
                }
            },
            {
                name: "generate_visual_script",
                description: "Generate a structured 9-beat visual script from a synopsis.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        synopsis: { type: "STRING", description: "Story synopsis or lyrics." }
                    },
                    required: ["synopsis"]
                }
            },
            {
                name: "render_cinematic_grid",
                description: "Render a cinematic grid of shots (Wide, Close-up, etc.) using the Entity Anchor.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Scene description." }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "extract_grid_frame",
                description: "Extract a specific frame from a generated cinematic grid.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        imageId: { type: "STRING", description: "ID of the grid image." },
                        gridIndex: { type: "NUMBER", description: "Index of the panel to extract." }
                    },
                    required: ["gridIndex"]
                }
            },
            {
                name: "interpolate_sequence",
                description: "Generate a seamless video transition between two frames.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        firstFrame: { type: "STRING", description: "Starting frame (base64)." },
                        lastFrame: { type: "STRING", description: "Ending frame (base64)." },
                        prompt: { type: "STRING", description: "Optional description of transition." }
                    },
                    required: ["firstFrame", "lastFrame"]
                }
            },
            {
                name: "analyze_audio",
                description: "Deep technical and semantic analysis of an uploaded audio file. Extracts BPM, key, energy, genre, mood, and visual prompts.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        uploadedAudioIndex: { type: "NUMBER", description: "The index of the audio in the uploaded list." }
                    },
                    required: ["uploadedAudioIndex"]
                }
            },
            {
                name: "canvas_push",
                description: "Push structured visual content (charts, tables, cards, markdown) to the user's workspace canvas.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", enum: ['chart', 'table', 'card', 'markdown'], description: "The type of content." },
                        title: { type: "STRING", description: "Title of the panel." },
                        data: { type: "OBJECT", description: "The structured data for the panel." },
                        agentId: { type: "STRING", description: "Optional agent ID (default 'director')." }
                    },
                    required: ["type", "title", "data"]
                }
            },
            {
                name: "mockup_merchandise",
                description: "Generate an artwork-faithful product mockup. With artworkUrl: the artwork is passed as an image reference with a fidelity-locked template (tee/hoodie/vinyl/poster/cassette/cd). Without: text-described preview.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productType: { type: "STRING", description: "Product: t-shirt, hoodie, vinyl, poster, cassette, cd." },
                        designIdea: { type: "STRING", description: "Text idea (legacy path; ignored when artworkUrl present)." },
                        artworkUrl: { type: "STRING", description: "Optional data URI or hosted image of the artwork." },
                        scene: { type: "STRING", enum: ['studio', 'lifestyle', 'flat'], description: "Staging scene." },
                        aspectRatio: { type: "STRING", description: "Optional output aspect ratio override." }
                    },
                    required: ["productType", "designIdea"]
                }
            },
            {
                name: "export_platform_assets",
                description: "Deterministically export a master image into platform dimensions (Spotify 3000x3000, Stories, YouTube, X, Facebook) from the PLATFORM_DIMENSIONS registry. No AI. Returns per-platform assets + downloadable zip.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        masterUrl: { type: "STRING", description: "Data URI or hosted image of the master artwork." },
                        platforms: { type: "ARRAY", items: { type: "STRING" }, description: "Optional platform ids; defaults to the core matrix." },
                        fit: { type: "STRING", enum: ['cover', 'contain-blur-pad'], description: "Fit mode; defaults per aspect change." },
                        download: { type: "BOOLEAN", description: "Whether to bundle a zip (default true)." }
                    },
                    required: ["masterUrl"]
                }
            },
            {
                name: "animate_still",
                description: "Render a deterministic camera move (dolly/pan/tilt/ken-burns) over a still image. No generative model, no token cost.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        imageUrl: { type: "STRING", description: "Data URI or hosted still image." },
                        preset: { type: "STRING", enum: ['dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'ken-burns'], description: "Camera move preset." },
                        intensity: { type: "NUMBER", description: "0..1 move intensity (default 0.35)." },
                        durationSec: { type: "NUMBER", description: "Duration in seconds (default 4)." },
                        resolution: { type: "STRING", enum: ['9:16', '16:9', '4:5'], description: "Output resolution (default 9:16)." }
                    },
                    required: ["imageUrl"]
                }
            },
            {
                name: "canvas_open_image",
                description: "Open a gallery image into the non-destructive layer editor.",
                parameters: { type: "OBJECT", properties: { imageIndex: { type: "NUMBER", description: "Index of the gallery image." } }, required: ["imageIndex"] }
            },
            {
                name: "canvas_add_layer",
                description: "Add a raster layer from a gallery item to the open layer doc.",
                parameters: { type: "OBJECT", properties: { docId: { type: "STRING" }, imageIndex: { type: "NUMBER" } }, required: ["docId", "imageIndex"] }
            },
            {
                name: "canvas_set_adjustments",
                description: "Merge a non-destructive adjustment patch over the neutral stack for a raster layer.",
                parameters: { type: "OBJECT", properties: { docId: { type: "STRING" }, layerId: { type: "STRING" }, adjustments: { type: "OBJECT" } }, required: ["docId", "layerId", "adjustments"] }
            },
            {
                name: "canvas_export",
                description: "Export the open layer doc as a raster PNG/JPEG history item + URL.",
                parameters: { type: "OBJECT", properties: { docId: { type: "STRING" }, format: { type: "STRING", enum: ['png','jpeg'] }, scale: { type: "NUMBER" } }, required: [] }
            },
            {
                name: "generate_mockup",
                description: "Generate photorealistic merchandise/media mockups (vinyl, CD, cassette, tee, hoodie, poster) using locked prompt templates enforcing 1:1 artwork fidelity.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productType: { type: "STRING", description: "Product type (tee, hoodie, vinyl, cd, cassette, poster)." },
                        artworkUrl: { type: "STRING", description: "Artwork URL or base64 data URI." },
                        artworkIndex: { type: "NUMBER", description: "Optional index of generated image." },
                        scene: { type: "STRING", enum: ['studio', 'lifestyle', 'flat'], description: "Staging scene." },
                        aspectRatio: { type: "STRING", description: "Aspect ratio (e.g. '1:1', '4:5')." }
                    }
                }
            },
            {
                name: "render_distribution_bundle",
                description: "Direct distribution packaging enforcing DSP/print specs (DPI, bleed math, sRGB color space, file caps) with SHA-256 verifiable delivery manifests.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        masterUrl: { type: "STRING", description: "Data URI or hosted image URL of the master artwork." },
                        masterIndex: { type: "NUMBER", description: "Index of the master image in generatedHistory." },
                        profileIds: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Target delivery profile IDs (e.g. 'spotify-cover', 'apple-itunes-cover', 'print-12in-sleeve-300dpi', 'cd-jewel-300dpi')."
                        },
                        trackId: { type: "STRING", description: "Track/Release ID for manifest association." },
                        overrideReason: { type: "STRING", description: "Explicit reason if overriding brand compliance gate." }
                    }
                }
            },
            {
                name: "fuse_likeness",
                description: "Fuse verified user likeness onto generated subjects with cosine similarity scoring on 128-d face embeddings and best-of-N retry loop. Arbitrary external/gallery URLs rejected.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        targetImageIndex: { type: "NUMBER", description: "Index of generated subject image to fuse onto." },
                        headshotId: { type: "STRING", description: "Verified Likeness ID from My Likeness or Brand Kit headshot. Arbitrary external URLs or gallery images are strictly rejected." },
                        maxAttempts: { type: "NUMBER", description: "Maximum retry attempts (default 3)." }
                    },
                    required: ["targetImageIndex"]
                }
            },
            {
                name: "render_typography",
                description: "Renders uploaded .ttf/.otf fonts as true vector glyphs via opentype.js with exact pair kerning and tracking, bypassing generative text artifacts.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        text: { type: "STRING", description: "Text string/wordmark to render." },
                        fontId: { type: "STRING", description: "Optional uploaded font ID. If omitted, uses Brand Kit default font." },
                        fontSize: { type: "NUMBER", description: "Font size in points (default 48)." },
                        x: { type: "NUMBER", description: "Horizontal coordinate." },
                        y: { type: "NUMBER", description: "Vertical coordinate." },
                        letterSpacing: { type: "NUMBER", description: "Tracking/letter spacing in font units." },
                        fill: { type: "STRING", description: "CSS color or hex fill (default #ffffff)." }
                    },
                    required: ["text"]
                }
            },
            {
                name: "scan_brand_compliance",
                description: "CIEDE2000 delta-E color deviation and logo safe-zone analysis gating distribution export.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        assetIndex: { type: "NUMBER", description: "Index of asset in generated history or uploads." },
                        assetId: { type: "STRING", description: "Explicit ID of asset to scan." }
                    }
                }
            },
            {
                name: "record_asset_version",
                description: "Append-only DAG version graph node recording for provenance and audit tracking.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        assetId: { type: "STRING", description: "Asset identifier." },
                        url: { type: "STRING", description: "Asset URL or data URI." },
                        source: { type: "STRING", enum: ['generation', 'edit', 'fusion', 'canvas-export', 'typography', 'mockup', 'export-bundle', 'upload'], description: "Creation source." },
                        parentVersionId: { type: "STRING", description: "Parent version ID if deriving from an earlier node." },
                        provenance: { type: "OBJECT", description: "Provenance metadata." },
                        compliance: { type: "OBJECT", description: "Compliance scan results." },
                        tags: { type: "ARRAY", items: { type: "STRING" }, description: "Asset tags." }
                    },
                    required: ["assetId", "url", "source"]
                }
            },
            {
                name: "promote_asset_version",
                description: "Promote a historical version to the head of the asset version graph (non-destructive revert).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        assetId: { type: "STRING", description: "Asset identifier." },
                        versionId: { type: "STRING", description: "Version ID to promote to head." }
                    },
                    required: ["assetId", "versionId"]
                }
            },
            {
                name: "set_asset_rights",
                description: "Record statutory rights taxonomy and licensing metadata for an asset.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        assetId: { type: "STRING", description: "Asset identifier." },
                        usageRights: { type: "STRING", enum: ['ai-generated', 'ai-assisted', 'owned-licensed', 'licensed-third-party'], description: "Statutory usage rights taxonomy." },
                        releaseId: { type: "STRING", description: "Optional associated release ID." },
                        licenseNotes: { type: "STRING", description: "License notes (required for licensed-third-party)." },
                        disclosureRequired: { type: "BOOLEAN", description: "Whether statutory AI disclosure is required." }
                    },
                    required: ["assetId", "usageRights"]
                }
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination

