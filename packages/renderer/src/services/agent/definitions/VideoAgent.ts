import { AgentConfig } from "../types";
import { VideoTools } from '../tools/VideoTools';
import systemPrompt from '@agents/video/prompt.md?raw';

export const VideoAgent: AgentConfig = {
    id: 'video',
    name: 'Video Director',
    description: 'Specializes in video production, editing, and VFX.',
    color: 'bg-blue-600',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            generate_video: VideoTools.generate_video,
            batch_edit_videos: VideoTools.batch_edit_videos,
            extend_video: VideoTools.extend_video,
            update_keyframe: VideoTools.update_keyframe
        };
    },
    authorizedTools: ['generate_video', 'batch_edit_videos', 'extend_video', 'update_keyframe', 'browser_tool', 'indii_image_gen', 'orchestrate_timeline'],
    tools: [{
        functionDeclarations: [
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
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
