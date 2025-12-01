import { SpecializedAgent, AgentResponse } from '../registry';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

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
        const fullPrompt = `${this.systemPrompt}\n${contextStr}\n\nTASK: ${task}`;

        try {
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                config: {
                    ...AI_CONFIG.THINKING.LOW,
                    tools: this.tools
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
