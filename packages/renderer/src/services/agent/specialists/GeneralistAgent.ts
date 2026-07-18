 
import { BaseAgent } from '../BaseAgent';
// useStore removed to prevent circular dependency - dynamically imported in execute()
// TOOL_REGISTRY removed to prevent circular dependency
import { FunctionDeclaration, ToolDefinition } from '../types';

import systemPrompt from '@agents/conductor/prompt.md?raw';
import { importWithRetry } from '@/utils/dynamicImport';

/**
 * GeneralistAgent (indii Conductor) - The primary orchestrator and fallback agent.
 * 
 * This agent implements the indii Conductor protocol with three operating modes:
 * - Mode A (Curriculum): Strategic planning for complex goals
 * - Mode B (Executor): Tool-based task execution
 * - Mode C (Companion): Natural conversation
 * 
 * ARCHITECTURE (Native Function Calling):
 * Unlike the legacy JSON parsing approach, this implementation uses Gemini's
 * native function calling API for more reliable tool invocation.
 */
export class GeneralistAgent extends BaseAgent {
    id = 'generalist';
    name = 'indii Conductor';
    description = 'Central Studio Head and Creative Orchestrator.';
    color = 'bg-green-600';
    category: 'manager' | 'department' | 'specialist' = 'manager';

    private readonly CONDUCTOR_PROTOCOL = systemPrompt;

    systemPrompt = systemPrompt;

    tools: ToolDefinition[] = [];
    protected authorizedTools: string[] = [
        'generate_image', 'generate_video', 'save_memory', 'recall_memories', 'consult_specialist', 'delegate_task',
        'create_project', 'list_projects', 'search_knowledge', 'request_approval', 'verify_output',
        'batch_edit_images', 'generate_social_post', 'list_files', 'search_files',
        'list_organizations', 'switch_organization',
        'propose_plan', 'get_plan', 'refine_plan', 'cancel_plan',
        'report_bug', 'request_feature',
        'edit_image_with_annotations', 'edit_document_with_annotations',
        'seat_agent', 'unseat_agent'
    ];

    constructor() {
        super({
            id: 'generalist',
            name: 'indii',
            description: 'Creative orchestrator — plans, delegates, and executes across all departments.',
            color: 'bg-green-500',
            category: 'manager',
            systemPrompt: systemPrompt,
            tools: []
        });

        // Initialization moved to async initialize() to prevent circular execution
    }

    private isHardStopError(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes('verification failed') ||
            lower.includes('permission_denied') ||
            lower.includes('unauthenticated') ||
            lower.includes('app check') ||
            lower.includes('missing or insufficient permissions') ||
            lower.includes('rate limit') ||
            lower.includes('resource-exhausted') ||
            lower.includes('resource_exhausted') ||
            lower.includes('quota') ||
            lower.includes('cost control') ||
            lower.includes('cost ledger') ||
            lower.includes('billing') ||
            lower.includes('prepayment credits');
    }

    /**
     * Initializes the agent by loading tools dynamically.
     * This must be called after instantiation by the registry.
     */
    async initialize() {
        const { TOOL_REGISTRY } = await importWithRetry(() => import('../tools'));
        this.functions = TOOL_REGISTRY;
        this.tools = this.buildToolDeclarations();

        // NOTE: freezeAgentConfig was removed here. It deep-froze `this.tools` (and `this` itself),
        // which caused "Cannot assign to read only property 'parameters'" errors when model
        // gateways normalize tool declarations. Tool integrity is now protected by per-iteration cloning below.
    }



    /**
     * Builds native Gemini function declarations from the TOOL_REGISTRY(conceptually).
     * This enables proper function calling instead of JSON parsing.
     */
    private buildToolDeclarations(): ToolDefinition[] {
        // Core tools that indii Conductor needs - we'll define the most important ones
        // with proper schemas for native function calling
        const functionDeclarations: FunctionDeclaration[] = [
            {
                name: 'canvas_push',
                description: 'Push structured visual content (chart, table, card, markdown) to the user\'s workspace canvas for dashboard visualization.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        type: { type: 'STRING', enum: ['chart', 'table', 'card', 'html', 'markdown'], description: 'Type of content to push.' },
                        title: { type: 'STRING', description: 'Title of the panel.' },
                        data: { type: 'OBJECT', description: 'Data for the panel matching the type.' },
                        agentId: { type: 'STRING', description: 'Optional agent ID to associate with the push.' }
                    },
                    required: ['type', 'title', 'data']
                }
            },
            {
                name: 'canvas_clear',
                description: 'Clear all agent-pushed canvas panels from the user\'s workspace.',
                parameters: {
                    type: 'OBJECT',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'draw_shape',
                description: 'Draw a deterministic vector shape (rectangle, circle, line, text) directly on the workspace UI canvas. Use this strictly for UI and diagrammatic drawing, not for generative image creation.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        shapeType: { type: 'STRING', enum: ['rect', 'circle', 'line', 'text'], description: 'Type of shape to draw.' },
                        x: { type: 'NUMBER', description: 'X coordinate.' },
                        y: { type: 'NUMBER', description: 'Y coordinate.' },
                        width: { type: 'NUMBER', description: 'Width for rect.' },
                        height: { type: 'NUMBER', description: 'Height for rect.' },
                        radius: { type: 'NUMBER', description: 'Radius for circle.' },
                        color: { type: 'STRING', description: 'Color hex or name.' },
                        fill: { type: 'BOOLEAN', description: 'Whether to fill the shape.' },
                        stroke: { type: 'STRING', description: 'Stroke color.' },
                        zIndex: { type: 'NUMBER', description: 'Z-index for layering. Maximum allowed value is 1000 to prevent obscuring UI.' },
                        label: { type: 'STRING', description: 'Optional text label.' }
                    },
                    required: ['shapeType', 'x', 'y']
                }
            },
            {
                name: 'generate_image',
                description: 'Generate images based on a text prompt. Use this when the user asks to create, generate, or make any visual content.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Detailed visual description of the image to generate.' },
                        style: { type: 'STRING', description: 'Optional artistic style (e.g., "photorealistic", "anime", "oil painting").' },
                        aspectRatio: { type: 'STRING', description: 'Aspect ratio (e.g., "16:9", "1:1", "9:16").' },
                        negativePrompt: { type: 'STRING', description: 'What to avoid in the image.' },
                        quality: { type: 'STRING', description: 'Generation quality: "standard" or "hd".' }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'edit_image_with_annotations',
                description: 'Edit an existing image using spatial annotations to define regions for specific edits. Used for iterative visual refinement based on user interaction in chat.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        imageId: { type: 'STRING', description: 'ID of the original image to edit' },
                        annotations: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    color: { type: 'STRING', description: 'Color of the annotation (red, blue, yellow)' },
                                    cx: { type: 'NUMBER' },
                                    cy: { type: 'NUMBER' },
                                    r: { type: 'NUMBER' }
                                }
                            }
                        },
                        colorPrompts: {
                            type: 'OBJECT',
                            properties: {
                                red: { type: 'STRING' },
                                blue: { type: 'STRING' },
                                yellow: { type: 'STRING' }
                            }
                        }
                    },
                    required: ['imageId', 'annotations', 'colorPrompts']
                }
            },
            {
                name: 'generate_video',
                description: 'Generate a video from a text prompt or starting image.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Description of the motion and scene.' },
                        image: { type: 'STRING', description: 'Optional base64 starting image.' },
                        duration: { type: 'NUMBER', description: 'Duration in seconds (default 5).' }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'save_memory',
                description: 'Save a fact, rule, or preference to long-term memory for future recall.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'The content to remember.' },
                        type: { type: 'STRING', description: 'Type of memory: "fact", "summary", or "rule".' }
                    },
                    required: ['content']
                }
            },
            {
                name: 'recall_memories',
                description: 'Search long-term memory for relevant information.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'Search query to find relevant memories.' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'seat_agent',
                description: 'Seat or bring a specialist agent (e.g., finance, legal, marketing, brand, distribution, music, video, social, publicist, publishing, licensing, road, merchandise, creative, producer, director, screenwriter, devops, security) into the Boardroom discussion. Use this automatically when the user asks to "bring in", "seat", "invite", "add", or "summon" a department or agent, or when a task is delegated to an absent department.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetAgentId: { type: 'STRING', description: 'ID of the specialist agent to seat (e.g., finance, legal, marketing, brand, distribution, music, video, social, publicist, publishing, licensing, road, merchandise, creative, producer, director, screenwriter, devops, security).' }
                    },
                    required: ['targetAgentId']
                }
            },
            {
                name: 'unseat_agent',
                description: 'Unseat or remove a specialist agent from the Boardroom discussion when their expertise is no longer needed or their task is fully complete. Use this to keep the boardroom focused and clean.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetAgentId: { type: 'STRING', description: 'ID of the agent to unseat (e.g. finance, legal, marketing).' }
                    },
                    required: ['targetAgentId']
                }
            },
            {
                name: 'consult_specialist',
                description: 'Consult a specialized agent via the A2A protocol. Use this for precise, single-expert delegation with security gating and session context. Requests routed via secure encrypted channels with automatic fallback if needed.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetAgentId: { type: 'STRING', description: 'ID of the expert agent to consult (e.g., marketing, legal, finance).' },
                        task: { type: 'STRING', description: 'Detailed instruction or question for the expert.' },
                        sharedContext: { type: 'STRING', description: 'Optional context to preserve session continuity.' }
                    },
                    required: ['targetAgentId', 'task']
                }
            },
            {
                name: 'delegate_task',
                description: 'Delegate a task to a specialized agent. Use this for broad or parallel handoff when you need a quick answer from a generalist. Works through hub-and-spoke coordination.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetAgentId: { type: 'STRING', description: 'ID of the target agent.' },
                        task: { type: 'STRING', description: 'The specific task to delegate.' },
                        sharedContext: { type: 'STRING', description: '(Optional) Specific context or memory to share.' }
                    },
                    required: ['targetAgentId', 'task']
                }
            },
            {
                name: 'create_project',
                description: 'Create a new project in the workspace.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING', description: 'Project name.' },
                        type: { type: 'STRING', description: 'Project type (album, single, ep, video, campaign).' }
                    },
                    required: ['name', 'type']
                }
            },
            {
                name: 'list_projects',
                description: 'List all projects in the current organization.',
                parameters: {
                    type: 'OBJECT',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'search_knowledge',
                description: 'Search the internal knowledge base for answers, guidelines, or policies.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'The search query.' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'request_approval',
                description: 'Request user approval for high-stakes actions (posting, sending, publishing).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'Content or action requiring approval.' },
                        type: { type: 'STRING', description: 'Type of action (post, email, publish).' }
                    },
                    required: ['content']
                }
            },
            {
                name: 'verify_output',
                description: 'Critique and verify generated content against a goal.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        goal: { type: 'STRING', description: 'The original goal or requirements.' },
                        content: { type: 'STRING', description: 'The content to verify.' }
                    },
                    required: ['goal', 'content']
                }
            },
            {
                name: 'batch_edit_images',
                description: 'Edit uploaded images using a text instruction.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'The editing instruction.' },
                        imageIndices: { type: 'ARRAY', description: 'Indices of images to edit.', items: { type: 'NUMBER' } }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'generate_social_post',
                description: 'Generate a social media post for a specific platform.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        platform: { type: 'STRING', description: 'Platform (twitter, instagram, tiktok, linkedin).' },
                        topic: { type: 'STRING', description: 'Topic or theme of the post.' },
                        tone: { type: 'STRING', description: 'Tone (professional, casual, hype, mysterious).' }
                    },
                    required: ['platform', 'topic', 'tone']
                }
            },
            {
                name: 'list_files',
                description: 'List recently generated files.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        limit: { type: 'NUMBER', description: 'Maximum number of files to return.' },
                        type: { type: 'STRING', description: 'Filter by type (image, video, audio).' }
                    },
                    required: []
                }
            },
            {
                name: 'search_files',
                description: 'Search files by name or description.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'Search query.' },
                        type: { type: 'STRING', description: 'Filter by type.' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'list_organizations',
                description: 'List all organizations the user has access to.',
                parameters: {
                    type: 'OBJECT',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'switch_organization',
                description: 'Switch to a different organization.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        orgId: { type: 'STRING', description: 'Organization ID to switch to.' }
                    },
                    required: ['orgId']
                }
            },
            {
                name: 'report_bug',
                description: 'Report a bug or issue encountered during the session. Use this when you detect an error, the user describes a bug, or something is not working as expected. Trigger phrases: "broken", "not working", "crash", "error", "bug", "glitch", "freeze". Creates a structured bug report saved to the project tracker.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        title: { type: 'STRING', description: 'Clear, concise bug title.' },
                        description: { type: 'STRING', description: 'Detailed description of the bug.' },
                        stepsToReproduce: { type: 'STRING', description: 'Steps to reproduce the bug.' },
                        expectedBehavior: { type: 'STRING', description: 'What should have happened.' },
                        actualBehavior: { type: 'STRING', description: 'What actually happened.' },
                        severity: { type: 'STRING', description: 'Bug severity: critical, major, minor, or cosmetic.' },
                        module: { type: 'STRING', description: 'Which module the bug occurred in.' },
                        errorMessage: { type: 'STRING', description: 'Any error message or stack trace.' }
                    },
                    required: ['title', 'description']
                }
            },
            {
                name: 'request_feature',
                description: 'Capture a feature request or product suggestion from the user. Use this when the user expresses a desire for new functionality or improvements. Trigger phrases: "it would be cool if", "I wish", "can you add", "feature idea", "suggestion", "would be nice if", "missing", "enhancement". Saves a structured feature request to the feedback tracker.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        title: { type: 'STRING', description: 'Clear, concise feature title.' },
                        description: { type: 'STRING', description: 'Detailed description of what the user wants.' },
                        useCase: { type: 'STRING', description: 'Why the user wants this feature — the problem it solves.' },
                        priority: { type: 'STRING', description: 'Priority level: nice-to-have, important, or critical.' },
                        category: { type: 'STRING', description: 'Feature category: ux, performance, integration, content, or other.' },
                        module: { type: 'STRING', description: 'Which module this feature relates to.' }
                    },
                    required: ['title', 'description']
                }
            },
            {
                name: 'propose_plan',
                description: 'Propose a structured Living Plan for a high-level goal (e.g. album release, tour, brand build). Creates a draft plan card for user approval.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        shape: { type: 'STRING', enum: ['atomic', 'workflow', 'timeline'], description: 'Visual shape of the plan.' },
                        summary: { type: 'STRING', description: 'Brief summary of the plan strategy.' },
                        steps: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    id: { type: 'STRING' },
                                    title: { type: 'STRING' },
                                    description: { type: 'STRING' },
                                    toolName: { type: 'STRING' }
                                },
                                required: ['id', 'title', 'description']
                            }
                        },
                        phases: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    id: { type: 'STRING' },
                                    title: { type: 'STRING' },
                                    days: { type: 'NUMBER' },
                                    milestones: { type: 'ARRAY', items: { type: 'STRING' } }
                                },
                                required: ['id', 'title', 'days']
                            }
                        },
                        durationDays: { type: 'NUMBER' },
                        autoApprove: { type: 'BOOLEAN' },
                        risks: { type: 'ARRAY', items: { type: 'STRING' } }
                    },
                    required: ['shape', 'summary']
                }
            },
            {
                name: 'get_plan',
                description: 'Get details of a Living Plan by ID.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        planId: { type: 'STRING' }
                    },
                    required: ['planId']
                }
            },
            {
                name: 'refine_plan',
                description: 'Update a draft plan with refinements based on user feedback.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        planId: { type: 'STRING' },
                        updates: { type: 'OBJECT', description: 'Partial PlanDraft object.' }
                    },
                    required: ['planId', 'updates']
                }
            },
            {
                name: 'cancel_plan',
                description: 'Cancel a proposed or active plan.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        planId: { type: 'STRING' }
                    },
                    required: ['planId']
                }
            },
            {
                name: 'edit_document_with_annotations',
                description: 'Edit a document (PDF/Text) using specific area highlights or sticky notes with instructions.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        documentId: { type: 'STRING', description: 'The ID of the document to edit.' },
                        annotations: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    pageNumber: { type: 'NUMBER', description: 'The page number (1-indexed).' },
                                    type: { type: 'STRING', description: 'Type of annotation: highlight or sticky_note.' },
                                    x: { type: 'NUMBER' },
                                    y: { type: 'NUMBER' },
                                    width: { type: 'NUMBER' },
                                    height: { type: 'NUMBER' },
                                    color: { type: 'STRING' },
                                    content: { type: 'STRING', description: 'Text content or instruction for this spot.' }
                                },
                                required: ['pageNumber', 'type', 'x', 'y']
                            }
                        },
                        globalInstruction: { type: 'STRING', description: 'Overall instruction for the document edit.' }
                    },
                    required: ['documentId', 'annotations']
                }
            }
        ];

        return [{ functionDeclarations }];
    }

    // execute() method deleted to unify specialist execution loops and inherit directly from BaseAgent.
    // GeneralistAgent now relies on its initialized systemPrompt, modelId, authorizedTools, tools, and functions configurations
    // to drive tool definitions, routing, and prompt injections via BaseAgent.ts's single robust executor loop.
}
