import { SpecializedAgent, AgentResponse } from '../registry';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TOOL_REGISTRY } from '../tools';

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
    }
];

export abstract class BaseAgent implements SpecializedAgent {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract systemPrompt: string;
    abstract tools?: any[]; // Define tools for the specialist

    protected functions: Record<string, (args: any) => Promise<any>> = {};

    async execute(task: string, context?: any): Promise<AgentResponse> {
        console.log(`[${this.name}] Received task: ${task}`);

        // Dynamically import store to avoid circular deps if any
        const { useStore } = await import('@/core/store');
        const { currentOrganizationId, currentProjectId } = useStore.getState();

        const enrichedContext = {
            ...context,
            orgId: currentOrganizationId,
            projectId: currentProjectId
        };

        const contextStr = `\nCONTEXT:\n${JSON.stringify(enrichedContext, null, 2)}`;

        const SUPERPOWER_PROMPT = `
        **SUPERPOWERS (Agent Zero Protocol):**
        - **Memory:** Use 'save_memory' to remember important details. Use 'recall_memories' to check for past context.
        - **Reflection:** Use 'verify_output' to double-check your work before finalizing.
        - **Approval:** Use 'request_approval' before taking any public or irreversible action.
        `;

        const fullPrompt = `${this.systemPrompt}\n${contextStr}\n${SUPERPOWER_PROMPT}\n\nTASK: ${task}`;

        // Merge specialist tools with superpowers
        const allTools = [...(this.tools || []), ...SUPERPOWER_TOOLS];

        try {
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

                if (this.functions[name]) {
                    const result = await this.functions[name](args);
                    return {
                        text: `[Tool: ${name}] Output: ${JSON.stringify(result)}`,
                        data: result
                    };
                } else if (TOOL_REGISTRY[name]) {
                    // Fallback to global registry for superpowers
                    const result = await TOOL_REGISTRY[name](args);
                    return {
                        text: `[Tool: ${name}] Output: ${result}`, // Registry returns string
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
            return {
                text: `Error executing task: ${error.message}`
            };
        }
    }
}
