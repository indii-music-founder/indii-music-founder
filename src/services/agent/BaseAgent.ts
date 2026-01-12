import { SpecializedAgent, AgentResponse, AgentProgressCallback } from './registry';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { ZodType } from 'zod';
import { TOOL_REGISTRY } from './tools';
import { AgentConfig, ToolDefinition, FunctionDeclaration, AgentContext, VALID_AGENT_IDS_LIST, VALID_AGENT_IDS, ValidAgentId } from './types';

// Export types for use in definitions
export type { AgentConfig };

const SUPERPOWER_TOOLS: FunctionDeclaration[] = [
    {
        name: 'save_memory',
        description: 'Save a fact, rule, or preference to long-term memory.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'The content to remember.' },
                type: { type: 'STRING', description: 'Type of memory.', enum: ['fact', 'summary', 'rule'] }
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
                query: { type: 'STRING', description: 'Search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'verify_output',
        description: 'Critique and verify generated content against a goal.',
        parameters: {
            type: 'OBJECT',
            properties: {
                goal: { type: 'STRING', description: 'The original goal.' },
                content: { type: 'STRING', description: 'The content to verify.' }
            },
            required: ['goal', 'content']
        }
    },
    {
        name: 'request_approval',
        description: 'Request user approval for high-stakes actions.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'Content or action requiring approval.' },
                type: { type: 'STRING', description: 'Type of action (e.g., "post", "email").' }
            },
            required: ['content']
        }
    },
    {
        name: 'get_project_details',
        description: 'Fetch full details of a project by ID.',
        parameters: {
            type: 'OBJECT',
            properties: {
                projectId: { type: 'STRING', description: 'The ID of the project to fetch.' }
            },
            required: ['projectId']
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
        name: 'delegate_task',
        description: `Delegate a sub-task to another specialized agent. ONLY use valid agent IDs from this list: ${VALID_AGENT_IDS_LIST}. Using any other ID will fail.`,
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `The ID of the agent to delegate to. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The specific task for the agent to perform.' }
            },
            required: ['targetAgentId', 'task']
        }
    },
    {
        name: 'consult_experts',
        description: 'Consult multiple specialized agents in parallel to get diverse perspectives on a complex sub-task.',
        parameters: {
            type: 'OBJECT',
            properties: {
                consultations: {
                    type: 'ARRAY',
                    description: 'List of specific tasks to delegate to specialized agents.',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            targetAgentId: { type: 'STRING', description: `The ID of the agent to consult. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                            task: { type: 'STRING', description: 'The specific question or instruction for this specialist.' }
                        },
                        required: ['targetAgentId', 'task']
                    }
                }
            },
            required: ['consultations']
        }
    },
    {
        name: 'speak',
        description: 'Read text aloud using the agents voice. Use this for proactive notifications or to emphasize important information.',
        parameters: {
            type: 'OBJECT',
            properties: {
                text: { type: 'STRING', description: 'The text to read aloud.' },
                voice: { type: 'STRING', description: 'Optional voice override (e.g., Kore, Puck, Charon, Vega, Capella).' }
            },
            required: ['text']
        }
    },
    {
        name: 'schedule_task',
        description: 'Schedule a task to be executed automatically after a delay (e.g., follow-ups, reminders).',
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `Agent to execute. Valid IDs: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The instruction to execute.' },
                delayMinutes: { type: 'NUMBER', description: 'Minutes to wait before execution.' }
            },
            required: ['targetAgentId', 'task', 'delayMinutes']
        }
    },
    {
        name: 'subscribe_to_event',
        description: 'Subscribe to a system event to trigger an autonomous response (e.g., when a task completes).',
        parameters: {
            type: 'OBJECT',
            properties: {
                eventType: {
                    type: 'STRING',
                    enum: ['TASK_COMPLETED', 'TASK_FAILED', 'SYSTEM_ALERT'],
                    description: 'The type of event to monitor.'
                },
                task: { type: 'STRING', description: 'The instruction to execute when the event occurs.' }
            },
            required: ['eventType', 'task']
        }
    },
    {
        name: 'send_notification',
        description: 'Display a proactive notification (toast) to the user.',
        parameters: {
            type: 'OBJECT',
            properties: {
                type: {
                    type: 'STRING',
                    enum: ['info', 'success', 'warning', 'error'],
                    description: 'The style of the notification.'
                },
                message: { type: 'STRING', description: 'The message to display.' }
            },
            required: ['type', 'message']
        }
    }
];

export class BaseAgent implements SpecializedAgent {
    public id: string;
    public name: string;
    public description: string;
    public color: string;
    public category: 'manager' | 'department' | 'specialist';
    public systemPrompt: string;
    public tools: ToolDefinition[];
    protected functions: Record<string, (args: Record<string, unknown>, context?: AgentContext) => Promise<unknown>>;
    private toolSchemas: Map<string, ZodType> = new Map();

    constructor(config: AgentConfig) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.color = config.color;
        this.category = config.category;
        this.systemPrompt = config.systemPrompt;
        this.tools = config.tools || [];

        // Populate tool schemas for validation
        this.tools.forEach(def => {
            def.functionDeclarations.forEach(fn => {
                if (fn.schema) {
                    this.toolSchemas.set(fn.name, fn.schema);
                }
            });
        });

        this.functions = {
            get_project_details: async ({ projectId }) => {
                const { useStore } = await import('@/core/store');
                const { projects } = useStore.getState();
                const project = projects.find(p => p.id === projectId);
                if (!project) return { error: 'Project not found' };
                return project;
            },
            delegate_task: async ({ targetAgentId, task }, context) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');

                if (typeof targetAgentId !== 'string' || typeof task !== 'string') {
                    return toolError('Invalid delegation parameters', 'INVALID_ARGS');
                }
                // Runtime validation: reject invalid agent IDs to prevent hallucination issues
                if (!VALID_AGENT_IDS.includes(targetAgentId as ValidAgentId)) {
                    return toolError(
                        `Invalid agent ID: "${targetAgentId}". Valid IDs are: ${VALID_AGENT_IDS_LIST}`,
                        'INVALID_AGENT_ID'
                    );
                }
                const result = await agentService.runAgent(targetAgentId, task, context, context?.traceId, context?.attachments);
                // AgentService.runAgent returns AgentResponse, we wrap it
                return {
                    success: true,
                    data: result,
                    message: `Delegated task to ${targetAgentId}`
                };
            },
            consult_experts: async ({ consultations }, context) => {
                const { agentService } = await import('./AgentService');
                const { toolError } = await import('./utils/ToolUtils');

                if (!Array.isArray(consultations)) {
                    return toolError('Consultations must be an array', 'INVALID_ARGS');
                }

                try {
                    const results = await Promise.all(
                        consultations.map(async (c: { targetAgentId: string; task: string }) => {
                            if (!VALID_AGENT_IDS.includes(c.targetAgentId as ValidAgentId)) {
                                return { agentId: c.targetAgentId, error: `Invalid agent ID: ${c.targetAgentId}` };
                            }
                            const res = await agentService.runAgent(c.targetAgentId, c.task, context, context?.traceId, context?.attachments);
                            return { agentId: c.targetAgentId, response: res };
                        })
                    );

                    return {
                        success: true,
                        data: { results },
                        message: `Consulted ${consultations.length} experts`
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    return toolError(`Consultation failed: ${message}`, 'EXECUTION_ERROR');
                }
            },
            schedule_task: async (args: Record<string, unknown>) => {
                const { targetAgentId, task, delayMinutes } = args as { targetAgentId: string; task: string; delayMinutes: number };
                const { proactiveService } = await import('./ProactiveService');
                const executeAt = Date.now() + (delayMinutes * 60000);
                const taskId = await proactiveService.scheduleTask(targetAgentId, task, executeAt);
                return {
                    success: true,
                    data: { taskId },
                    message: `Task scheduled for ${new Date(executeAt).toLocaleString()}`
                };
            },
            subscribe_to_event: async (args: Record<string, unknown>) => {
                const { eventType, task } = args as { eventType: string; task: string };
                const { proactiveService } = await import('./ProactiveService');
                // @ts-expect-error - eventType is dynamically checked in proactiveService
                const taskId = await proactiveService.subscribeToEvent(this.id, eventType, task);
                return {
                    success: true,
                    data: { taskId },
                    message: `Agent ${this.name} subscribed to ${eventType}`
                };
            },
            send_notification: async (args: Record<string, unknown>) => {
                const { type, message } = args as { type: 'info' | 'success' | 'warning' | 'error'; message: string };
                const { events } = await import('@/core/events');
                events.emit('SYSTEM_ALERT', { level: type, message });
                return {
                    success: true,
                    message: 'Notification sent'
                };
            },
            speak: async (args: Record<string, unknown>) => {
                const { text, voice } = args as { text: string; voice?: string };
                const { AI } = await import('@/services/ai/AIService');
                const { audioService } = await import('@/services/audio/AudioService');

                const VOICE_MAP: Record<string, string> = {
                    'kyra': 'Kore',
                    'liora': 'Vega',
                    'mistral': 'Charon',
                    'seraph': 'Capella',
                    'vance': 'Puck'
                };

                const selectedVoice = voice || VOICE_MAP[this.id.toLowerCase()] || 'Kore';

                try {
                    const response = await AI.generateSpeech(text, selectedVoice);
                    await audioService.play(response.audio.inlineData.data, response.audio.inlineData.mimeType);
                    return {
                        success: true,
                        message: 'Speech generated and played'
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('[BaseAgent] Speak failure:', err);
                    return {
                        success: false,
                        message: `Failed to speak: ${message}`
                    };
                }
            },
            ...(config.functions || {} as Record<string, (args: Record<string, unknown>, context?: AgentContext) => Promise<unknown>>)
        };
    }

    /**
     * Common method to execute a task using the agent's capabilities.
     * This method handles the AI interaction loop, tool calls, and progress reporting.
     * 
     * @param task The mission or objective to achieve
     * @param context Execution context (org, project, brand, etc.)
     * @param onProgress Callback for granular progress events (thought, tool use, tokens)
     * @param signal AbortSignal for cancellation
     * @param attachments Optional multimodal inputs (images, base64)
     * @returns Standardized AgentResponse
     */
    async execute(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse> {
        // Lazy import AI Service to prevent circular deps during registry loading
        const { AI } = await import('@/services/ai/AIService');

        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        // KEEPER: Prevent Context Duplication
        // We strip large fields from the JSON context because they are either
        // injected separately (chatHistoryString) or not needed in the raw JSON dump.
        const { chatHistoryString, chatHistory, memoryContext, ...leanContext } = context || {};

        const enrichedContext = {
            ...leanContext,
            orgId: context?.orgId,
            projectId: context?.projectId
        };

        const SUPERPOWER_PROMPT = `
        ## CAPABILITIES & PROTOCOLS
        You have access to the following advanced capabilities ("Superpowers"):
        - **Memory:** Call 'save_memory' to retain critical facts. Call 'recall_memories' to find past context.
        - **Reflection:** Call 'verify_output' to critique your own work if the task is complex.
        - **Approval:** Call 'request_approval' for any action that publishes content or spends money.
        - **Collaboration:** If a task requires expertise outside your primary domain (${this.name}), call 'delegate_task' to hand it over to a specialist. For complex problems needing multiple viewpoints, use 'consult_experts'.

        ## COLLABORATION PROTOCOL
        - If you are receiving a delegated task (check context.traceId), be extremely concise and data-oriented.
        - When delegating, provide full context so the next agent doesn't need to ask follow-up questions.
        - Use 'consult_experts' when you need parallel logic (e.g., both music and marketing perspectives).

        ## TONE & STYLE
        - Be direct and concise. Avoid "As an AI..." boilerplate.
        - Act with the authority of your role (${this.name}).
        - If the user asks for an action, DO IT. Don't just say you can.
        `;

        // Build memory section if memories were retrieved
        const memorySection = context?.memoryContext
            ? `\n## RELEVANT MEMORIES\n${context.memoryContext}\n`
            : '';

        // Build distributor section - this informs all AI operations about requirements
        const distributorSection = context?.distributor?.isConfigured
            ? `\n## DISTRIBUTOR REQUIREMENTS\n${context.distributor.promptContext}\n\nIMPORTANT: When generating any cover art, promotional images, or release assets:\n- ALWAYS use ${context.distributor.coverArtSize.width}x${context.distributor.coverArtSize.height}px for cover art\n- Export audio in ${context.distributor.audioFormat.join(' or ')} format\n- These are ${context.distributor.name} requirements - non-compliance will cause upload rejection.\n`
            : '';

        // KEEPER: Truncate history string if it's too long
        // Max context window for standard Gemini models is huge (1M), but we don't want to pay for all of it.
        // Let's cap the HISTORY part at ~8k tokens (approx 32k chars) to be safe and efficient.
        // This ensures the total prompt size (incl. system instructions and tools) stays manageable.
        const MAX_HISTORY_CHARS = 32000;
        let safeHistory = context?.chatHistoryString || '';
        if (safeHistory.length > MAX_HISTORY_CHARS) {
            safeHistory = safeHistory.slice(-MAX_HISTORY_CHARS);
            // Prepend a marker
            safeHistory = `[...Older history truncated...]\n${safeHistory}`;
        }

        const fullPrompt = `
# MISSION
${this.systemPrompt}

# CONTEXT
${JSON.stringify(enrichedContext, null, 2)}

# HISTORY
${safeHistory}
${memorySection}
${distributorSection}

${SUPERPOWER_PROMPT}

# CURRENT OBJECTIVE
${task}
`;

        // Collect all tool names from specialist's tools to avoid duplicates
        const specialistToolNames = new Set(
            (this.tools || [])
                .flatMap(t => t.functionDeclarations || [])
                .map(f => f.name)
        );

        // Filter SUPERPOWER_TOOLS to exclude any already defined by specialist
        const filteredSuperpowers = SUPERPOWER_TOOLS.filter(
            tool => !specialistToolNames.has(tool.name)
        );

        // Merge specialist tools with filtered superpowers
        // We prioritize core collaboration tools to ensure swarming always works
        const collaborationToolNames = ['delegate_task', 'consult_experts'];
        const collaborationTools = filteredSuperpowers.filter(t => collaborationToolNames.includes(t.name));
        const otherSuperpowers = filteredSuperpowers.filter(t => !collaborationToolNames.includes(t.name));

        const allFunctions: FunctionDeclaration[] = ([
            ...collaborationTools,
            ...(this.tools || []).flatMap(t => t.functionDeclarations || []),
            ...otherSuperpowers
        ]).slice(0, 12);

        const allTools: ToolDefinition[] = allFunctions.length > 0
            ? [{ functionDeclarations: allFunctions }]
            : [];

        try {
            onProgress?.({ type: 'thought', content: 'Generating response...' });

            const { stream, response: responsePromise } = await AI.generateContentStream({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: fullPrompt },
                        ...(attachments || []).map(a => ({
                            inlineData: { mimeType: a.mimeType, data: a.base64 }
                        }))
                    ]
                }],
                config: {
                    ...AI_CONFIG.THINKING.LOW
                },
                tools: allTools as any, // casting to any due to complex tool schema mapping
                signal
            });

            // Consume stream for tokens (Robust handling)
            const streamIterator = {
                [Symbol.asyncIterator]: async function* () {
                    const rawStream = stream as unknown;
                    if (rawStream && typeof (rawStream as { getReader?: () => { read: () => Promise<{ done: boolean; value: any }>; releaseLock: () => void } }).getReader === 'function') {
                        const reader = (rawStream as { getReader: () => { read: () => Promise<{ done: boolean; value: any }>; releaseLock: () => void } }).getReader();
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
                    } else {
                        // Not iterable, warn but don't crash
                        console.info('[BaseAgent] Stream is not iterable, waiting for full response');
                    }
                }
            };

            try {
                for await (const value of streamIterator) {
                    const chunkText = typeof value.text === 'function' ? value.text() : '';
                    if (chunkText) {
                        onProgress?.({ type: 'token', content: chunkText });
                    }
                }
            } catch (streamError) {
                console.warn('[BaseAgent] Stream read interrupted:', streamError);
            }

            const response = await responsePromise;
            const usage = response.usage();
            const mappedUsage = usage ? {
                promptTokens: usage.promptTokenCount || 0,
                completionTokens: usage.candidatesTokenCount || 0,
                totalTokens: usage.totalTokenCount || 0
            } : undefined;

            const functionCall = response.functionCalls()?.[0];
            if (functionCall) {
                const { name, args } = functionCall;
                onProgress?.({ type: 'tool', toolName: name, content: `Calling tool: ${name}` });

                let result: any;

                // Check local functions first (specialist specific)
                if (this.functions[name]) {
                    try {
                        // Validate against Zod schema if available
                        const schema = this.toolSchemas.get(name);
                        if (schema) {
                            // This throws if invalid
                            schema.parse(args);
                        }
                        result = await this.functions[name](args, enrichedContext);
                    } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        console.warn(`[BaseAgent] Tool validation failed for ${name}:`, msg);
                        result = {
                            success: false,
                            error: `Validation Error: ${msg}`,
                            message: `Invalid arguments for tool '${name}': ${msg}`
                        };
                    }
                }
                // Then check global tool registry
                else if (TOOL_REGISTRY[name]) {
                    result = await TOOL_REGISTRY[name](args);
                } else {
                    result = {
                        success: false,
                        error: `Error: Tool '${name}' not implemented.`,
                        message: `Error: Tool '${name}' not implemented.`
                    };
                }

                onProgress?.({ type: 'thought', content: `Tool ${name} completed.` });

                // Construct a text-friendly output for the AI if it just returned data
                const outputText = typeof result === 'string'
                    ? result
                    : (result.success === false
                        ? `Error: ${result.error || result.message}`
                        : `Success: ${JSON.stringify(result.data || result)}`);

                return {
                    text: `[Tool: ${name}] Output: ${outputText}`,
                    data: result,
                    usage: mappedUsage
                };
            }

            return {
                text: response.text(),
                usage: mappedUsage
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[${this.name}] Error executing task:`, error);
            onProgress?.({ type: 'thought', content: `Error: ${errorMessage}` });
            return {
                text: `Error executing task: ${errorMessage}`
            };
        }
    }
}

