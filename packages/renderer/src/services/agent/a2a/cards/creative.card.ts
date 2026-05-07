import { AgentCard } from '../AgentCard.schema';

export const CreativeCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'creative',
    displayName: 'Creative Agent',
    description: 'Specialist for creative operations.',
    capabilities: [
    {
        "name": "generate_image",
        "description": "Generate AI images using text prompts with support for aspect ratios, reference images, and brand guidelines. Images are automatically saved to history.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "batch_edit_images",
        "description": "Edit multiple uploaded images with a text instruction.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "run_showroom_mockup",
        "description": "Generate photorealistic product mockups for showcases (vinyl, CD, t-shirt, poster).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_high_res_asset",
        "description": "Generate print-quality visual assets at high resolution for physical media (CD jacket, vinyl sleeve, poster, merch).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "render_cinematic_grid",
        "description": "Create a 2x2 cinematic shot grid (Wide, Medium, Close-up, Low Angle) for visual storytelling and shot composition planning.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "extract_grid_frame",
        "description": "Extract a single frame from a previously generated 2x2 cinematic grid for standalone use or further editing.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "add_character_reference",
        "description": "Set a character reference image for maintaining visual consistency across multiple image generations.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_audio",
        "description": "Perform \"Audio-to-Visual\" analysis to extract BPM, key, mood, and energy from a track to guide artistic direction.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "canvas_push",
        "description": "Push a visual asset or moodboard directly to the Agent Canvas for A2UI interaction and further design refinement.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    }
],
    inputSchemas: {},
    outputSchemas: {},
    costModel: {
        perTokenInUsd: 0,
        perTokenOutUsd: 0
    },
    riskTier: 'write',
    sla: {
        modeSync: {
            p50Ms: 2000,
            p99Ms: 5000
        },
        modeStream: {
            firstByteMs: 500
        }
    }
};
