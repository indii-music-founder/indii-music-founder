import { AgentConfig } from "../types";
import { VideoTools } from '../tools/VideoTools';
import { UniversalTools } from '../tools/UniversalTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import systemPrompt from '@agents/video/prompt.md?raw';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';
import { StorageTools } from '../tools/StorageTools';
import { VideoProjectTools } from '../tools/VideoProjectTools';
import { EditorTools } from '../tools/EditorTools';



const videoRetrievalConfig = {
    'videoJobs': { path: 'videoJobs', requiresUserIdFilter: true },
    'video_releases': { path: 'video_releases', requiresUserIdFilter: true },
    'generated_videos': { path: 'generated_videos', requiresUserIdFilter: true }
};
const videoRetrievalTools = buildDomainRetrievalTools('Video', videoRetrievalConfig);
const videoRetrievalDeclarations = buildDomainRetrievalDeclarations('Video', videoRetrievalConfig);

export const VideoAgent: AgentConfig = {
    id: 'video',
    name: 'Video Director',
    description: 'Specializes in video production, editing, and VFX.',
    color: 'bg-blue-600',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            ...videoRetrievalTools,
            list_stored_assets: StorageTools.list_files,
            search_stored_assets: StorageTools.search_files,
            generate_video: VideoTools.generate_video,
            batch_edit_videos: VideoTools.batch_edit_videos,
            extend_video: VideoTools.extend_video,
            update_keyframe: VideoTools.update_keyframe,
            browser_tool: UniversalTools.browser_tool,
            indii_image_gen: UniversalTools.indii_image_gen,
            orchestrate_timeline: VideoTools.orchestrate_timeline,
            create_performance_video: VideoTools.create_performance_video,
            inspect_video_project: VideoProjectTools.inspect_video_project,
            add_video_clip: VideoProjectTools.add_video_clip,
            update_video_clip: VideoProjectTools.update_video_clip,
            queue_video_render: VideoProjectTools.queue_video_render,
            video_list_renderable_assets: EditorTools.video_list_renderable_assets,
            video_plan_sequence: EditorTools.video_plan_sequence,
            video_plan_chain: EditorTools.video_plan_chain,
            video_render_stitch: EditorTools.video_render_stitch,
            video_render_chain: EditorTools.video_render_chain,
            video_get_render_status: EditorTools.video_get_render_status,
            generate_storyboard: async (args: { script: string, numFrames: number }) => {
                const prompt = `Break down this script into a ${args.numFrames}-frame storyboard. For each frame, provide a shot type, action description, and visual prompt for image generation. Script: ${args.script}`;
                try {
                    const response = await AutonomousIntelligence.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                    return { success: true, data: { storyboard: response } };
                } catch (e: unknown) {
                    return { success: false, error: (e as Error).message };
                }
            },
            draft_video_budget: async (args: { durationMinutes: number, vfxLevel: string, locationDays: number }) => {
                const prompt = `Draft a video production budget for a ${args.durationMinutes} minute video with ${args.vfxLevel} VFX and ${args.locationDays} location shooting days. Include pre-pro, production, and post-production costs.`;
                try {
                    const response = await AutonomousIntelligence.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                    return { success: true, data: { budget: response } };
                } catch (e: unknown) {
                    return { success: false, error: (e as Error).message };
                }
            }
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: [
        'list_domain_records',
        'list_stored_assets',
        'search_stored_assets',
        'generate_video',
        'batch_edit_videos',
        'extend_video',
        'update_keyframe',
        'browser_tool',
        'indii_image_gen',
        'orchestrate_timeline',
        'create_performance_video',
        'inspect_video_project',
        'add_video_clip',
        'update_video_clip',
        'queue_video_render',
        'generate_storyboard',
        'draft_video_budget',
        'video_list_renderable_assets',
        'video_plan_sequence',
        'video_plan_chain',
        'video_render_stitch',
        'video_render_chain',
        'video_get_render_status'
    ],
    tools: [{
        functionDeclarations: [
            ...videoRetrievalDeclarations,
            {
                name: "list_stored_assets",
                description: "List the user’s saved gallery images, brand assets, reference images, and recent uploads. Use this to resolve requests like 'one of the last three images' before generating video.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        source: { type: "STRING", enum: ['gallery', 'brand_assets', 'reference_images', 'uploads', 'all'], description: "Asset source to list." },
                        limit: { type: "NUMBER", description: "Maximum number of assets to return." },
                        type: { type: "STRING", description: "Optional media type filter, such as image or video." }
                    },
                    required: []
                }
            },
            {
                name: "search_stored_assets",
                description: "Search the user’s saved gallery images, brand assets, reference images, and recent uploads by text.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search words to match against prompts, type, or source." }
                    },
                    required: ['query']
                }
            },
            {
                name: "generate_video",
                description: "Generate a video from a text prompt or start image.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "Description of motion/scene." },
                        image: { type: "STRING", description: "Optional base64 start image or HTTPS image URL." },
                        assetId: { type: "STRING", description: "Optional saved image asset ID to use as the first frame." },
                        recentImageIndex: { type: "NUMBER", description: "Optional zero-based index from the most recent generated/uploaded images to use as the first frame." },
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
                name: "extend_video",
                description: "Extend a video clip forwards or backwards.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        videoUrl: { type: "STRING", description: "URL of the video to extend." },
                        prompt: { type: "STRING", description: "Content of the extension." },
                        direction: { type: "STRING", enum: ["start", "end"], description: "Direction to extend." }
                    },
                    required: ["videoUrl", "prompt", "direction"]
                }
            },
            {
                name: "update_keyframe",
                description: "Update animation keyframes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        clipId: { type: "STRING", description: "ID of the clip." },
                        property: { type: "STRING", enum: ["scale", "opacity", "x", "y", "rotation"], description: "Property to animate." },
                        frame: { type: "NUMBER", description: "Frame number." },
                        value: { type: "NUMBER", description: "Value." },
                        easing: { type: "STRING", enum: ["linear", "easeIn", "easeOut", "easeInOut"], description: "Easing function." }
                    },
                    required: ["clipId", "property", "frame", "value"]
                }
            },
            {
                name: "browser_tool",
                description: "Search for stock footage or visual references.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "indii_image_gen",
                description: "Generate storyboard keyframes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING" },
                        aspect_ratio: { type: "STRING" }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "orchestrate_timeline",
                description: "Acts as a render supervisor, dynamically breaking down a master script/timeline into sequential 5-second descriptive prompts optimized for Veo generation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        masterScript: { type: "STRING", description: "The overall vision or script for the video." },
                        totalDuration: { type: "NUMBER", description: "Total intended duration of the video in seconds." },
                        artStyle: { type: "STRING", description: "The overarching visual style to append to each prompt (e.g., 'Cinematic 35mm, neon noir')." }
                    },
                    required: ["masterScript", "totalDuration", "artStyle"]
                }
            },
            {
                name: "inspect_video_project",
                description: "Inspect the active indii video project, including its tracks, clips, timing, layout, transitions, and keyframes. Call this before editing the timeline.",
                parameters: { type: "OBJECT", properties: {}, required: [] }
            },
            {
                name: "add_video_clip",
                description: "Add a video, image, text, or audio clip to the active editor timeline. The live HyperFrames preview updates automatically.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", enum: ["video", "image", "text", "audio"] },
                        name: { type: "STRING" },
                        trackId: { type: "STRING", description: "Optional compatible track ID; otherwise the first compatible track is used." },
                        src: { type: "STRING", description: "Media URL for video, image, or audio." },
                        text: { type: "STRING", description: "Text content for a text clip." },
                        startFrame: { type: "NUMBER" },
                        durationInFrames: { type: "NUMBER" },
                        x: { type: "NUMBER" }, y: { type: "NUMBER" }, width: { type: "NUMBER" }, height: { type: "NUMBER" },
                        opacity: { type: "NUMBER" }, rotation: { type: "NUMBER" }, volume: { type: "NUMBER" },
                        textColor: { type: "STRING" }, fontSize: { type: "NUMBER" },
                        textAlign: { type: "STRING", enum: ["left", "center", "right"] }
                    },
                    required: ["type", "name", "startFrame", "durationInFrames"]
                }
            },
            {
                name: "update_video_clip",
                description: "Update an existing clip on the active timeline. Inspect the project first to get the clip ID; omitted properties remain unchanged.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        clipId: { type: "STRING" }, name: { type: "STRING" }, src: { type: "STRING" }, text: { type: "STRING" },
                        startFrame: { type: "NUMBER" }, durationInFrames: { type: "NUMBER" },
                        x: { type: "NUMBER" }, y: { type: "NUMBER" }, width: { type: "NUMBER" }, height: { type: "NUMBER" },
                        opacity: { type: "NUMBER" }, rotation: { type: "NUMBER" }, volume: { type: "NUMBER" },
                        textColor: { type: "STRING" }, fontSize: { type: "NUMBER" },
                        textAlign: { type: "STRING", enum: ["left", "center", "right"] }
                    },
                    required: ["clipId"]
                }
            },
            {
                name: "queue_video_render",
                description: "Render the active video-editor project through indii's planner. Direct media uses FFmpeg; composed timelines use HyperFrames. The completed MP4 becomes the editor preview artifact.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectId: { type: "STRING", description: "Optional safety check against the active video project." },
                        outputName: { type: "STRING", description: "Optional MP4 filename." }
                    },
                    required: []
                }
            },
            {
                name: "generate_storyboard",
                description: "Break down a script into a storyboard with visual prompts.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        script: { type: "STRING" },
                        numFrames: { type: "NUMBER" }
                    },
                    required: ["script", "numFrames"]
                }
            },
            {
                name: "draft_video_budget",
                description: "Draft a video production budget.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        durationMinutes: { type: "NUMBER" },
                        vfxLevel: { type: "STRING", enum: ["low", "medium", "high"] },
                        locationDays: { type: "NUMBER" }
                    },
                    required: ["durationMinutes", "vfxLevel", "locationDays"]
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
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
