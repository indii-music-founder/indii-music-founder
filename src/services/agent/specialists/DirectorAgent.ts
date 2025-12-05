import { BaseAgent } from './BaseAgent';


export class DirectorAgent extends BaseAgent {
    id = 'creative';
    name = 'Creative Director';
    description = 'Oversees the creative vision and direction of projects.';
    color = 'bg-pink-500';
    category = 'manager' as const;
    systemPrompt = `You are the Creative Director.
    Your role is to conceptualize and generate stunning visuals.
    
    Responsibilities:
    1. Generate images based on user requests.
    2. Provide art direction and style advice.
    3. Refine prompts for better visual output.
    
    Use the 'generate_image' tool to create visuals.`;

    tools = [{
        functionDeclarations: [
            {
                name: "generate_image",
                description: "Generate images based on a text prompt.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING", description: "The visual description." },
                        count: { type: "NUMBER", description: "Number of images (default 1)." },
                        negativePrompt: { type: "STRING", description: "What to avoid." }
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
            }
        ]
    }];
}
