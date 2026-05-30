import { getCardForAgent } from '../a2a/CardRegistry';
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { SpecializedAgent, AgentConfig } from '../types';

/**
 * SpecialistAgentFactory
 * 
 * Factory responsible for clean instantiation of both config-based and class-based
 * specialist agents, ensuring proper A2A cryptographic card association, configuration freezing,
 * and lifecycle initialization. Bypasses loader boilerplate inside registry imports.
 */
export class SpecialistAgentFactory {
    /**
     * Instantiates a dynamic RAGAgent using standard configuration,
     * binds its unique A2A identification card, and freezes the config against mutations.
     */
    static async createConfigAgent(config: AgentConfig): Promise<SpecializedAgent> {
        const { RAGAgent } = await import('../RAGAgent');
        const agent = new RAGAgent(config);
        agent.card = getCardForAgent(config.id);
        freezeAgentConfig(agent);
        return agent;
    }

    /**
     * Instantiates a custom class-based specialist agent,
     * associates its unique A2A identification card, and runs any asynchronous lifecycle initialization if present.
     */
    static async createSpecialistAgent<T extends SpecializedAgent>(
        id: string,
        AgentClass: new (...args: any[]) => T
    ): Promise<T> {
        const agent = new AgentClass();
        agent.card = getCardForAgent(id);
        if ('initialize' in agent && typeof (agent as any).initialize === 'function') {
            await (agent as any).initialize();
        }
        return agent;
    }

    /**
     * Instantiates a standard BaseAgent config representation,
     * binds its unique A2A card, and freezes its configuration.
     */
    static async createBaseAgent(config: AgentConfig): Promise<SpecializedAgent> {
        const { BaseAgent } = await import('../BaseAgent');
        const agent = new BaseAgent(config);
        agent.card = getCardForAgent(config.id);
        freezeAgentConfig(agent);
        return agent;
    }
}
