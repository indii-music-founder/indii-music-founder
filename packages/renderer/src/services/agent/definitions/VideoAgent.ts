import { AgentConfig } from "../types";
import { VideoTools } from '../tools/VideoTools';
import { UniversalTools } from '../tools/UniversalTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import systemPrompt from '@agents/video/prompt.md?raw';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';
import { StorageTools } from '../tools/StorageTools';



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
    authorizedTools: ['list_domain_records', 'list_stored_assets', 'search_stored_assets', 'generate_video', 'batch_edit_videos', 'extend_video', 'update_keyframe', 'browser_tool', 'indii_image_gen', 'orchestrate_timeline', 'create_performance_video', 'generate_storyboard', 'draft_video_budget'],
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
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
