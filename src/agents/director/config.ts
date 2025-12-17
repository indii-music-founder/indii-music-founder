import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';

export const DirectorAgent: AgentConfig = {
    id: 'director',
    name: 'Creative Director',
    description: 'Oversees the creative vision and direction of projects.',
    color: 'bg-pink-500',
    category: 'manager',
    systemPrompt,
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
                description: "Generate a 4K/UHD asset for physical media printing using Nano Banana Pro.",
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
            }
        ]
    }]
};
