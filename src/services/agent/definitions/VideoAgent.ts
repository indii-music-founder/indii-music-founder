import { AgentConfig } from "../types";
import { VideoTools } from '../tools/VideoTools';
import systemPrompt from '@agents/video/prompt.md?raw';

export const VideoAgent: AgentConfig = {
    id: 'video',
    name: 'Video Department',
    description: 'Specializes in video production, editing, and VFX.',
    color: 'bg-blue-500',
    category: 'department',
    systemPrompt,
    functions: {
        generate_video: VideoTools.generate_video,
        batch_edit_videos: VideoTools.batch_edit_videos,
        extend_video: VideoTools.extend_video,
        update_keyframe: VideoTools.update_keyframe
    },
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
            }
        ]
    }]
};
