import { agentRegistry } from '../registry';
import { PipelineContext } from './ContextPipeline';

export class AgentExecutor {
    constructor() { }

    async execute(agentId: string, userGoal: string, context: PipelineContext, onProgress?: (event: any) => void) {
        // Try to get specific agent, or default to generalist
        let agent = agentRegistry.get(agentId);

        if (!agent) {
            console.warn(`[AgentExecutor] Agent '${agentId}' not found. Falling back to Generalist.`);
            agent = agentRegistry.get('generalist');
        }

        if (!agent) {
            throw new Error(`[AgentExecutor] Fatal: No agent found for ID '${agentId}' and no Generalist registered.`);
        }

        console.log(`[AgentExecutor] Executing with agent: ${agent.name} (${agent.id})`);

        // Log if semantic memories were retrieved
        if (context.relevantMemories && context.relevantMemories.length > 0) {
            console.log(`[AgentExecutor] Injecting ${context.relevantMemories.length} semantic memories into context`);
        }

        try {
            const response = await agent.execute(userGoal, {
                currentProjectId: context.currentProjectId,
                currentOrganizationId: context.currentOrganizationId,
                userProfile: context.userProfile,
                brandKit: context.brandKit,
                chatHistory: context.chatHistory,
                chatHistoryString: context.chatHistoryString,
                // Inject semantic memory context
                memoryContext: context.memoryContext,
                relevantMemories: context.relevantMemories,
                // Inject distributor requirements context
                distributor: context.distributor
            }, onProgress);

            return response;
        } catch (e: any) {
            console.error(`[AgentExecutor] Agent ${agent.name} failed.`, e);
            throw e;
        }
    }
}

