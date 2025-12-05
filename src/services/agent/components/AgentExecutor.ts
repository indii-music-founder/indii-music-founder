import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/core/store';
import { agentRegistry } from '../registry';
import { AgentContext } from './ContextResolver';
export class AgentExecutor {
    constructor() { }

    async execute(agentId: string, userGoal: string, context: AgentContext, onProgress?: (event: any) => void) {
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

        try {
            const response = await agent.execute(userGoal, {
                currentProjectId: context.currentProjectId,
                currentOrganizationId: context.currentOrganizationId,
                userProfile: context.userProfile,
                brandKit: context.brandKit,
                chatHistory: context.chatHistory
            }, onProgress);

            return response.text;
        } catch (e: any) {
            console.error(`[AgentExecutor] Agent ${agent.name} failed.`, e);
            throw e;
        }
    }
}

