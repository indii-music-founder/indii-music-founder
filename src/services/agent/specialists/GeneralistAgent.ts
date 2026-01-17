import { BaseAgent } from '../BaseAgent';
// useStore removed to prevent circular dependency - dynamically imported in execute()
// TOOL_REGISTRY removed to prevent circular dependency
// import { TOOL_REGISTRY, BASE_TOOLS } from '../tools';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { AgentProgressCallback, AgentResponse, FunctionDeclaration, ToolDefinition, AgentContext } from '../types';
import { WhiskState } from '@/core/store/slices/creativeSlice';

/**
 * GeneralistAgent (Agent Zero) - The primary orchestrator and fallback agent.
 * 
 * This agent implements the Agent Zero protocol with three operating modes:
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
    name = 'Agent Zero';
    description = 'General assistance, complex reasoning, fallback.';
    color = 'bg-stone-500';
    category = 'manager' as const;

    private readonly AGENT0_PROTOCOL = `
## RULE: THE AGENT0 EVOLUTION PROTOCOL (Strict Architecture)
**Goal:** Emulate the "Agent0" framework behavior. You are not a static chatbot; you are a co-evolutionary system consisting of three distinct internal modes.

**1. Mode A: The Curriculum Agent (The Manager)**
* **Function:** Strategy, Challenge, and Planning.
* **Behavior:** When a user presents a complex goal, do not just solve it. First, generate a "Frontier Task"—a specific challenge that pushes the user's career slightly beyond their current state.
* **Exception:** If the request is simple (e.g., "generate an image", "fix this typo"), SKIP this mode and go directly to execution.
* **Output Signature:** Always preface strategic advice with:
    * *"[Curriculum]: Based on your current trajectory, I have formulated a new frontier task..."*

**2. Mode B: The Executor Agent (The Worker)**
* **Function:** Tool Use, Coding, and Implementation.
* **Behavior:** Once the strategy is set (or for simple tasks), ruthlessly execute using available tools. Be concise.
* **Output Signature:** Preface execution steps with:
    * *"[Executor]: Deploying tools to solve this task..."*

**3. Mode C: The Companion (Casual Conversation)**
* **Function:** Chat, Greetings, and Simple Q&A.
* **Behavior:** If the user is just saying hello, asking a simple question, or chatting, respond NATURALLY.
* **Constraint:** Do NOT use [Curriculum] or [Executor] prefixes for this mode. Just be helpful and friendly.

**Tone:** Professional, conversational, and encouraging. Be helpful and proactive.

**4. SUPERPOWERS (The "indii" Upgrade)**
* **Memory:** You have long-term memory. Use 'save_memory' to store important facts/preferences. Use 'recall_memories' to fetch context before answering complex queries.
* **Reflection:** For creative tasks, use 'verify_output' to critique your own work before showing it to the user.
* **Approval:** For high-stakes actions (e.g., posting to social media, sending emails), you MUST use 'request_approval' to get user sign-off.
* **File Management:** You can list and search generated files using 'list_files' and 'search_files'. Use this to help the user find past work.
* **Organization:** You can switch contexts using 'switch_organization' or 'create_organization' if the user asks to change workspaces.
* **Creative Generation:** Use 'generate_image' to create visuals and 'generate_video' to create videos. DO NOT just describe - GENERATE.
`;

    systemPrompt = `You are indii, the Autonomous Studio Manager (Agent Zero).
${this.AGENT0_PROTOCOL}

CRITICAL RULES:
1. When the user asks to "generate", "create", or "make" an image/visual, you MUST use the 'generate_image' tool. Do not just describe it.
2. When asked to create video content, use 'generate_video'.
3. Be proactive - if a tool can help, use it immediately.
4. For complex tasks, break them into steps and execute each one.
`;

    tools: ToolDefinition[] = [];

    constructor() {
        super({
            id: 'generalist',
            name: 'Agent Zero',
            description: 'General assistance, complex reasoning, fallback.',
            color: 'bg-stone-500',
            category: 'manager',
            systemPrompt: 'You are indii, the Autonomous Studio Manager (Agent Zero).',
            tools: []
        });

        // Initialization moved to async initialize() to prevent circular execution
    }

    /**
     * Initializes the agent by loading tools dynamically.
     * This must be called after instantiation by the registry.
     */
    async initialize() {
        const { TOOL_REGISTRY } = await import('../tools');
        this.functions = TOOL_REGISTRY;
        this.tools = this.buildToolDeclarations();
    }

    /**
     * Builds a context string from the Reference Mixer (Whisk) state.
     * This allows the agent to understand what references the user has locked.
     */
    private buildWhiskContext(whiskState: WhiskState): string {
        const subjects = whiskState.subjects.filter(i => i.checked);
        const scenes = whiskState.scenes.filter(i => i.checked);
        const styles = whiskState.styles.filter(i => i.checked);

        if (subjects.length === 0 && scenes.length === 0 && styles.length === 0) {
            return '';
        }

        const lines: string[] = [
            'REFERENCE MIXER CONTEXT (Whisk):',
            `- Precise Mode: ${whiskState.preciseReference ? 'ON (strict adherence to references)' : 'OFF (creative freedom)'}`,
        ];

        if (subjects.length > 0) {
            lines.push(`- SUBJECTS: ${subjects.map(s => s.aiCaption || s.content).join('; ')}`);
        }
        if (scenes.length > 0) {
            lines.push(`- SCENES: ${scenes.map(s => s.aiCaption || s.content).join('; ')}`);
        }
        if (styles.length > 0) {
            lines.push(`- STYLES: ${styles.map(s => s.aiCaption || s.content).join('; ')}`);
        }

        lines.push('');
        lines.push('IMPORTANT: When generating images, you MUST incorporate these locked references. Synthesize the subject, scene, and style into a cohesive prompt.');

        return lines.join('\n');
    }

    /**
     * Builds native Gemini function declarations from the TOOL_REGISTRY(conceptually).
     * This enables proper function calling instead of JSON parsing.
     */
    private buildToolDeclarations(): ToolDefinition[] {
        // Core tools that Agent Zero needs - we'll define the most important ones
        // with proper schemas for native function calling
        const functionDeclarations: FunctionDeclaration[] = [
            {
                name: 'generate_image',
                description: 'Generate images based on a text prompt. Use this when the user asks to create, generate, or make any visual content.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        prompt: { type: 'STRING', description: 'Detailed visual description of the image to generate.' },
                        style: { type: 'STRING', description: 'Optional artistic style (e.g., "photorealistic", "anime", "oil painting").' },
                        aspectRatio: { type: 'STRING', description: 'Aspect ratio (e.g., "16:9", "1:1", "9:16").' },
                        negativePrompt: { type: 'STRING', description: 'What to avoid in the image.' }
                    },
                    required: ['prompt']
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
                name: 'delegate_task',
                description: 'Delegate a task to a specialized agent. Use when expertise is needed.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        targetAgentId: { type: 'STRING', description: 'ID of the agent (marketing, legal, finance, director, video, social, brand, etc.).' },
                        task: { type: 'STRING', description: 'The specific task to delegate.' }
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
            }
        ];

        return [{ functionDeclarations }];
    }

    /**
     * Executes a task using the Agent Zero strategy with NATIVE FUNCTION CALLING.
     * 
     * This implementation uses Gemini's native function calling API instead of
     * JSON parsing, providing more reliable tool invocation.
     */
    async execute(
        task: string,
        context?: AgentContext,
        onProgress?: AgentProgressCallback,
        signal?: AbortSignal,
        attachments?: { mimeType: string; base64: string }[]
    ): Promise<AgentResponse> {

        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        const { useStore } = await import('@/core/store');
        const { currentOrganizationId, currentProjectId, currentModule } = useStore.getState();

        // Build rich context
        const orgContext = `
ORGANIZATION CONTEXT:
- Organization ID: ${currentOrganizationId}
- Project ID: ${currentProjectId}
- Current Module: ${currentModule || 'unknown'}
`;

        const brandKit = context?.brandKit;
        const brandContext = brandKit ? `
BRAND CONTEXT:
- Identity: ${context?.userProfile?.bio || 'N/A'}
- Visual Style: ${brandKit.brandDescription || 'N/A'}
- Colors: ${brandKit.colors?.join(', ') || 'N/A'}
- Fonts: ${brandKit.fonts || 'N/A'}
- Negative Prompt: ${brandKit.negativePrompt || 'N/A'}

CURRENT RELEASE:
- Title: ${brandKit.releaseDetails?.title || 'Untitled'}
- Type: ${brandKit.releaseDetails?.type || 'N/A'}
- Mood: ${brandKit.releaseDetails?.mood || 'N/A'}
- Themes: ${brandKit.releaseDetails?.themes || 'N/A'}

SOCIALS & BUSINESS:
- Twitter: ${brandKit.socials?.twitter || 'N/A'}
- Instagram: ${brandKit.socials?.instagram || 'N/A'}
- Spotify: ${brandKit.socials?.spotify || 'N/A'}
- SoundCloud: ${brandKit.socials?.soundcloud || 'N/A'}
- Bandcamp: ${brandKit.socials?.bandcamp || 'N/A'}
- Beatport: ${brandKit.socials?.beatport || 'N/A'}
- Website: ${brandKit.socials?.website || 'N/A'}
- PRO: ${brandKit.socials?.pro || 'N/A'}
- Distributor: ${brandKit.socials?.distributor || 'N/A'}

AVAILABLE ASSETS (Reference by Index):
Brand Assets:
${brandKit.brandAssets?.map((a: any, i: number) => `  [${i}] ${a.subject ? a.subject + ' - ' : ''}${a.category ? a.category.toUpperCase() + ': ' : ''}${a.description || 'Asset'} ${a.tags ? '(' + a.tags.join(', ') + ')' : ''}`).join('\n') || 'None'}

Reference Images:
${brandKit.referenceImages?.map((a: any, i: number) => `  [${i}] ${a.subject ? a.subject + ' - ' : ''}${a.category ? a.category.toUpperCase() + ': ' : ''}${a.description || 'Image'} ${a.tags ? '(' + a.tags.join(', ') + ')' : ''}`).join('\n') || 'None'}

RECENT UPLOADS (Reference by Index):
${useStore.getState().uploadedImages?.map((img: any, i: number) => `  [${i}] ${img.subject ? img.subject + ' - ' : ''}${img.category ? img.category.toUpperCase() + ': ' : ''}${img.prompt || 'Uploaded Image'} (${img.type}) ${img.tags ? '(' + img.tags.join(', ') + ')' : ''}`).slice(0, 10).join('\n') || 'None'}
` : '';

        // Build Reference Mixer context (Whisk)
        const whiskContext = context?.whiskState ? this.buildWhiskContext(context.whiskState) : '';

        const fullSystemPrompt = `${this.systemPrompt}
${orgContext}
${brandContext}
${whiskContext}

MODULE CONTEXT: You are currently in the '${currentModule}' module.
- IF module is 'creative' OR 'director', YOU ARE THE CREATIVE DIRECTOR.
- User requests for "images", "visuals", "scenes" MUST be handled by 'generate_image'.
- DO NOT just describe the image. YOU MUST GENERATE IT.
- DO NOT use 'search_assets' or 'search_files' when the user asks to CREATE something new. Only use them when explicitly asked to FIND existing files.
`;

        // Build conversation history
        const history = useStore.getState().agentHistory;
        const historyText = history
            .filter(msg => msg.role !== 'system')
            .slice(-10) // Last 10 messages
            .map(msg => `${msg.role.toUpperCase()}: ${msg.text}`)
            .join('\n');

        const fullPrompt = `${fullSystemPrompt}

CONVERSATION HISTORY:
${historyText}

CURRENT REQUEST: ${task}
`;

        // Execution loop with native function calling
        let iterations = 0;
        const MAX_ITERATIONS = 5;
        let accumulatedResponse = '';
        let lastToolCall: { name: string; args: string } | null = null;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            if (signal?.aborted) {
                return { text: 'Operation cancelled by user.' };
            }

            try {
                // DEBUG: Log tool declarations being sent to model
                const toolCount = this.tools?.[0]?.functionDeclarations?.length || 0;
                console.log(`[GeneralistAgent] Sending ${toolCount} tools to model:`,
                    this.tools?.[0]?.functionDeclarations?.map(f => f.name).join(', ') || 'NONE');

                const { stream, response: responsePromise } = await AI.generateContentStream({
                    model: AI_MODELS.TEXT.AGENT,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: iterations === 1 ? fullPrompt : `Continue. Previous output: ${accumulatedResponse.substring(0, 500)}` },
                            ...(attachments || []).map(a => ({
                                inlineData: { mimeType: a.mimeType, data: a.base64 }
                            }))
                        ]
                    }],
                    config: {
                        ...AI_CONFIG.THINKING.HIGH
                    },
                    tools: this.tools as any,
                    signal
                });

                // Consume stream for tokens
                const streamIterator = {
                    [Symbol.asyncIterator]: async function* () {
                        const rawStream = stream as unknown;
                        if (rawStream && typeof (rawStream as any).getReader === 'function') {
                            const reader = (rawStream as any).getReader();
                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) return;
                                    yield value;
                                }
                            } finally {
                                reader.releaseLock();
                            }
                        } else if (rawStream && typeof rawStream === 'object' && Symbol.asyncIterator in (rawStream as object)) {
                            yield* rawStream as AsyncIterable<{ text: () => string }>;
                        }
                    }
                };

                try {
                    for await (const value of streamIterator) {
                        const chunkText = typeof value.text === 'function' ? value.text() : '';
                        if (chunkText) {
                            onProgress?.({ type: 'token', content: chunkText });
                            accumulatedResponse += chunkText;
                        }
                    }
                } catch (streamError) {
                    console.warn('[GeneralistAgent] Stream read interrupted:', streamError);
                }

                const response = await responsePromise;

                // Check for function calls (native function calling)
                const allFunctionCalls = response.functionCalls?.() || [];
                console.log(`[GeneralistAgent] Response has ${allFunctionCalls.length} function calls:`,
                    allFunctionCalls.map(fc => fc.name).join(', ') || 'NONE');
                const functionCall = allFunctionCalls[0];

                if (functionCall) {
                    const { name, args } = functionCall;
                    const argsStr = JSON.stringify(args || {});

                    // Loop detection
                    if (lastToolCall && lastToolCall.name === name && lastToolCall.args === argsStr) {
                        console.warn(`[GeneralistAgent] Loop detected: same tool ${name} called twice with same args`);
                        return {
                            text: accumulatedResponse || 'Task completed.',
                            error: 'Loop detected - stopping to prevent infinite execution.'
                        };
                    }
                    lastToolCall = { name, args: argsStr };

                    onProgress?.({ type: 'tool', toolName: name, content: `Executing ${name}...` });

                    // Execute tool
                    let result: any;
                    if (this.functions[name]) {
                        try {
                            result = await this.functions[name](args as Record<string, unknown>, context);
                        } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : String(err);
                            result = { success: false, error: msg, message: `Tool error: ${msg}` };
                        }
                    } else {
                        // Dynamic try
                        const { TOOL_REGISTRY } = await import('../tools');
                        if (TOOL_REGISTRY[name]) {
                            try {
                                result = await TOOL_REGISTRY[name](args);
                            } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : String(err);
                                result = { success: false, error: msg, message: `Tool error: ${msg}` };
                            }
                        } else {
                            // Enhanced error: find similar tools
                            const allToolNames = Object.keys(TOOL_REGISTRY);
                            const nameLower = name.toLowerCase();
                            const suggestions = allToolNames
                                .filter(t => t.toLowerCase().includes(nameLower) || nameLower.includes(t.toLowerCase()))
                                .slice(0, 5);

                            const suggestionText = suggestions.length > 0
                                ? ` Did you mean: ${suggestions.join(', ')}?`
                                : '';

                            console.warn(`[GeneralistAgent] Tool '${name}' not found.${suggestionText}`);
                            result = {
                                success: false,
                                error: `Tool '${name}' not found.${suggestionText}`,
                                message: `Tool '${name}' not found.${suggestionText}`
                            };
                        }
                    }

                    const outputText = typeof result === 'string'
                        ? result
                        : (result.message || JSON.stringify(result));

                    onProgress?.({ type: 'thought', content: `Tool ${name} completed: ${outputText.substring(0, 200)}` });
                    accumulatedResponse += `\n[Tool: ${name}] ${outputText}`;

                    // If tool succeeded with "successfully", we might be done
                    if (String(outputText).toLowerCase().includes('success')) {
                        // Continue loop to let AI provide final response
                        continue;
                    }
                } else {
                    // No function call - this is the final text response
                    const responseText = response.text?.() || '';
                    if (responseText && !accumulatedResponse.includes(responseText)) {
                        accumulatedResponse = responseText;
                    }
                    break; // Exit loop - we have a final response
                }

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error('[GeneralistAgent] Error:', err);
                onProgress?.({ type: 'thought', content: `Error: ${message}` });

                if (iterations >= MAX_ITERATIONS) {
                    return { text: `Error after ${iterations} attempts: ${message}`, error: message };
                }
            }
        }

        return {
            text: accumulatedResponse || 'Task completed.',
        };
    }
}
