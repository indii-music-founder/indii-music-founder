import { SpecializedAgent, AgentResponse, AgentProgressCallback } from './registry';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
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

    constructor(config: AgentConfig) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.color = config.color;
        this.category = config.category;
        this.systemPrompt = config.systemPrompt;
        this.tools = config.tools || [];
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
                if (typeof targetAgentId !== 'string' || typeof task !== 'string') {
                    return { error: 'Invalid delegation parameters' };
                }
                // Runtime validation: reject invalid agent IDs to prevent hallucination issues
                if (!VALID_AGENT_IDS.includes(targetAgentId as ValidAgentId)) {
                    return {
                        error: `Invalid agent ID: "${targetAgentId}". Valid IDs are: ${VALID_AGENT_IDS_LIST}`
                    };
                }
                return await agentService.runAgent(targetAgentId, task, context);
            },
            ...(config.functions || {} as any)
        };
    }

    async execute(task: string, context?: AgentContext, onProgress?: AgentProgressCallback): Promise<AgentResponse> {
        // Lazy import AI Service to prevent circular deps during registry loading
        const { AI } = await import('@/services/ai/AIService');

        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        const enrichedContext = {
            ...context,
            orgId: context?.orgId,
            projectId: context?.projectId
        };

        const SUPERPOWER_PROMPT = `
        ## CAPABILITIES & PROTOCOLS
        You have access to the following advanced capabilities ("Superpowers"):
        - **Memory:** Call 'save_memory' to retain critical facts. Call 'recall_memories' to find past context.
        - **Reflection:** Call 'verify_output' to critique your own work if the task is complex.
        - **Approval:** Call 'request_approval' for any action that publishes content or spends money.

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

        const fullPrompt = `
# MISSION
${this.systemPrompt}

# CONTEXT
${JSON.stringify(enrichedContext, null, 2)}

# HISTORY
${context?.chatHistoryString || ''}
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
        const allTools: ToolDefinition[] = [
            ...(this.tools || []),
            ...(filteredSuperpowers.length > 0 ? [{ functionDeclarations: filteredSuperpowers }] : [])
        ];

        try {
            onProgress?.({ type: 'thought', content: 'Generating response...' });

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                config: {
                    ...AI_CONFIG.THINKING.LOW
                },
                tools: allTools as any
            });

            const functionCall = response.functionCalls()?.[0];

            if (functionCall) {
                const { name, args } = functionCall;
                onProgress?.({ type: 'tool', toolName: name, content: `Calling tool: ${name}` });

                // Check local functions first (specialist specific)
                if (this.functions[name]) {
                    const result = await this.functions[name](args, enrichedContext);
                    onProgress?.({ type: 'thought', content: `Tool ${name} completed.` });
                    return {
                        text: `[Tool: ${name}] Output: ${JSON.stringify(result)}`,
                        data: result
                    };
                }
                // Then check global tool registry
                else if (TOOL_REGISTRY[name]) {
                    const result = await TOOL_REGISTRY[name](args);
                    onProgress?.({ type: 'thought', content: `Tool ${name} completed.` });
                    return {
                        text: `[Tool: ${name}] Output: ${result}`,
                        data: result
                    };
                } else {
                    return {
                        text: `Error: Tool '${name}' not implemented.`
                    };
                }
            }

            return {
                text: response.text()
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

