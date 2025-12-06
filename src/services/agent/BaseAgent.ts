import { SpecializedAgent, AgentResponse, AgentProgressCallback } from './registry';
// import { AI } from '@/services/ai/AIService'; // Avoid circular dependency if possible, or import lazily
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TOOL_REGISTRY } from './tools';

export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    color: string;
    category: 'manager' | 'department' | 'specialist';
    systemPrompt: string;
    tools?: any[]; // Tool definitions (JSON schema)
    functions?: Record<string, (args: any) => Promise<any>>; // Implementations
}

const SUPERPOWER_TOOLS = [
    {
        name: 'save_memory',
        description: 'Save a fact, rule, or preference to long-term memory.',
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'The content to remember.' },
                type: { type: 'string', enum: ['fact', 'summary', 'rule'], description: 'Type of memory.' }
            },
            required: ['content']
        }
    },
    {
        name: 'recall_memories',
        description: 'Search long-term memory for relevant information.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'verify_output',
        description: 'Critique and verify generated content against a goal.',
        parameters: {
            type: 'object',
            properties: {
                goal: { type: 'string', description: 'The original goal.' },
                content: { type: 'string', description: 'The content to verify.' }
            },
            required: ['goal', 'content']
        }
    },
    {
        name: 'request_approval',
        description: 'Request user approval for high-stakes actions.',
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'Content or action requiring approval.' },
                type: { type: 'string', description: 'Type of action (e.g., "post", "email").' }
            },
            required: ['content']
        }
    },
    {
        name: 'get_project_details',
        description: 'Fetch full details of a project by ID.',
        parameters: {
            type: 'object',
            properties: {
                projectId: { type: 'string', description: 'The ID of the project to fetch.' }
            },
            required: ['projectId']
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
    public tools: any[];
    protected functions: Record<string, (args: any) => Promise<any>>;

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
            ...config.functions
        };
    }

    async execute(task: string, context?: any, onProgress?: AgentProgressCallback): Promise<AgentResponse> {
        console.log(`[${this.name}] Received task: ${task}`);

        // Lazy import AI Service to prevent circular deps during registry loading
        const { AI } = await import('@/services/ai/AIService');

        // Report thinking start
        onProgress?.({ type: 'thought', content: `Analyzing request: "${task.substring(0, 50)}..."` });

        // Dynamically import store to avoid circular deps
        const { useStore } = await import('@/core/store');
        const { currentOrganizationId, currentProjectId } = useStore.getState();

        const enrichedContext = {
            ...context,
            orgId: currentOrganizationId,
            projectId: currentProjectId
        };

        const SUPERPOWER_PROMPT = `
        **SUPERPOWERS (Agent Zero Protocol):**
        - **Memory:** Use 'save_memory' to remember important details. Use 'recall_memories' to check for past context.
        - **Reflection:** Use 'verify_output' to double-check your work before finalizing.
        - **Approval:** Use 'request_approval' before taking any public or irreversible action.
        `;

        // Build memory section if memories were retrieved
        const memorySection = context?.memoryContext
            ? `\nRELEVANT MEMORIES (from past conversations):\n${context.memoryContext}\n`
            : '';

        const fullPrompt = `
${this.systemPrompt}

${SUPERPOWER_PROMPT}

CONTEXT:
${JSON.stringify(enrichedContext, null, 2)}

HISTORY:
${context?.chatHistoryString || ''}
${memorySection}
TASK:
${task}
`;

        // Merge specialist tools with superpowers
        const allTools = [
            ...(this.tools || []),
            { functionDeclarations: SUPERPOWER_TOOLS }
        ];

        try {
            onProgress?.({ type: 'thought', content: 'Generating response...' });

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                config: {
                    ...AI_CONFIG.THINKING.LOW,
                    tools: allTools
                }
            });

            const functionCall = response.functionCalls()?.[0];

            if (functionCall) {
                const { name, args } = functionCall;
                console.log(`[${this.name}] Tool Call: ${name}`, args);

                onProgress?.({ type: 'tool', toolName: name, content: `Calling tool: ${name}` });

                // Check local functions first (specialist specific)
                if (this.functions[name]) {
                    const result = await this.functions[name](args);
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
        } catch (error: any) {
            console.error(`[${this.name}] Error executing task:`, error);
            onProgress?.({ type: 'thought', content: `Error: ${error.message}` });
            return {
                text: `Error executing task: ${error.message}`
            };
        }
    }
}
