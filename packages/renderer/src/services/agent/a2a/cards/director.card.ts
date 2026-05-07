import { AgentCard } from '../AgentCard.schema';

export const DirectorCard: AgentCard = {
    schemaVersion: '1.0.0',
    agentId: 'director',
    displayName: 'Director Agent',
    description: 'Specialist for director operations.',
    capabilities: [
    {
        "name": "generate_image",
        "description": "Generate images based on a text prompt.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "batch_edit_images",
        "description": "Edit uploaded images using a text instruction.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_video",
        "description": "Generate a video from a text prompt or start image.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "batch_edit_videos",
        "description": "Edit/grade uploaded videos with an instruction.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "run_showroom_mockup",
        "description": "Generate a product mockup in the Showroom.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_high_res_asset",
        "description": "Generate a 4K/UHD asset for physical media printing.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "set_entity_anchor",
        "description": "Set a global reference image for character consistency (Entity Anchor).",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "generate_visual_script",
        "description": "Generate a structured 9-beat visual script from a synopsis.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "render_cinematic_grid",
        "description": "Render a cinematic grid of shots (Wide, Close-up, etc.) using the Entity Anchor.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "extract_grid_frame",
        "description": "Extract a specific frame from a generated cinematic grid.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "interpolate_sequence",
        "description": "Generate a seamless video transition between two frames.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "analyze_audio",
        "description": "Deep technical and semantic analysis of an uploaded audio file. Extracts BPM, key, energy, genre, mood, and visual prompts.",
        "inputSchemaRef": "#/components/schemas/Empty",
        "outputSchemaRef": "#/components/schemas/Empty",
        "streaming": false
    },
    {
        "name": "canvas_push",
        "description": "Push structured visual content (charts, tables, cards, markdown) to the user's workspace canvas.",
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
