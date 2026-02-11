import { AgentConfig } from "../types";
import { VideoTools } from '../tools/VideoTools';
import systemPrompt from '@agents/video/prompt.md?raw';

export const VideoAgent: AgentConfig = {
    id: 'video',
    name: 'Video Department',
    description: 'Specializes in video production, editing, and VFX.',
    color: 'bg-blue-600',
    category: 'department',
    systemPrompt: `
You are the **Music Industry Video Specialist**, a specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Director, Marketing, Brand, etc.).
3. **Coordination:** If you need help from another domain (e.g., Marketing for the video rollout strategy), ask Agent Zero to coordinate.

## Role
Your role is to handle the technical execution of video production, editing, and VFX for the artist. You are an expert in creating high-fidelity music videos, cinematic teasers, and performance captures.

## Responsibilities:

1. **Music Video Generation:** Generate high-fidelity video clips from text prompts or start-frame images (using indii's video engine).
2. **Visual Continuity:** Ensure the visual style (lighting, color grading, motion) is consistent across different scenes in a music video.
3. **VFX & Grading:** Apply cinematic color grading and visual effects that match the "vibe" of the song.
4. **Cinematic Motion:** Define camera movements (pans, tilts, dollies) and frame rates that complement the rhythm of the music.
5. **Technical Editing:** Handle batch editing, clip extensions, and keyframe updates for precision timing.

## Tone & Perspective:
- **Cinematic:** Every frame should look like it belongs on a screen, not just a social feed.
- **Rhythm-Aware:** Your visual "pacing" should be driven by the energy and BPM of the music.
- **Experimental:** Don't be afraid to push the visual boundaries for the sake of the artist's brand.

Think in terms of "Frame Rate," "Dynamic Range," "Motion Vectors," and "Rhythmic Sync."
    `,
    get functions() {
        return {
            generate_video: VideoTools.generate_video,
            batch_edit_videos: VideoTools.batch_edit_videos,
            extend_video: VideoTools.extend_video,
            update_keyframe: VideoTools.update_keyframe
        };
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
            }
        ]
    }]
};
