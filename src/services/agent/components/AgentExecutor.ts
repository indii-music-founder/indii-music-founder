import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/core/store';
import { agentRegistry } from '../registry';
import { AgentContext } from './ContextResolver';
import { AgentZero } from '../AgentZero';

export class AgentExecutor {
    private agentZero: AgentZero;

    constructor() {
        this.agentZero = new AgentZero();
    }

    async execute(agentId: string, userGoal: string, context: AgentContext) {
        // Check if we have a specialized agent for this ID
        const specialist = agentRegistry.get(agentId);
        if (specialist) {
            console.log(`[AgentExecutor] Delegating to specialist: ${specialist.name}`);
            try {
                const response = await specialist.execute(userGoal, {
                    currentProjectId: context.currentProjectId,
                    currentOrganizationId: context.currentOrganizationId
                });

                // Add the response to the chat
                this.addModelMessage(response.text);
                return;
            } catch (e) {
                console.error(`[AgentExecutor] Specialist ${agentId} failed, falling back to Agent Zero.`, e);
                // Fallback to Agent Zero logic below
            }
        }

        // Fallback / Generalist Logic -> Agent Zero
        await this.agentZero.execute(userGoal, context);
    }

    private addModelMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'model', text, timestamp: Date.now() });
    }
}

