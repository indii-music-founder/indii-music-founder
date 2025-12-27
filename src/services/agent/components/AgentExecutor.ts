import { agentRegistry } from '../registry';
import { PipelineContext } from './ContextPipeline';

export class AgentExecutor {
    constructor() { }

    async execute(agentId: string, userGoal: string, context: PipelineContext, onProgress?: (event: { type: string; content: string; toolName?: string }) => void) {
        // Try to get specific agent, or default to generalist
        let agent = agentRegistry.get(agentId);

        if (!agent) {
            console.warn(`[AgentExecutor] Agent '${agentId}' not found. Falling back to Generalist.`);
            agent = agentRegistry.get('generalist');
        }

        if (!agent) {
            throw new Error(`[AgentExecutor] Fatal: No agent found for ID '${agentId}' and no Generalist registered.`);
        }

        try {
            const response = await agent.execute(userGoal, context, onProgress);
            return response;
        } catch (e: unknown) {
            console.error(`[AgentExecutor] Agent ${agent.name} failed.`, e);
            throw e;
        }
    }
}

