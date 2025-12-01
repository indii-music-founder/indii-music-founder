import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export interface AgentResponse {
    text: string;
    data?: any;
}

export interface SpecializedAgent {
    id: string;
    name: string;
    description: string;
    execute(task: string, context?: any): Promise<AgentResponse>;
}

export class AgentRegistry {
    private agents: Map<string, SpecializedAgent> = new Map();

    register(agent: SpecializedAgent) {
        this.agents.set(agent.id, agent);
        console.log(`[AgentRegistry] Registered: ${agent.name} (${agent.id})`);
    }

    get(id: string): SpecializedAgent | undefined {
        return this.agents.get(id);
    }

    getAll(): SpecializedAgent[] {
        return Array.from(this.agents.values());
    }

    listCapabilities(): string {
        return Array.from(this.agents.values())
            .map(a => `- ${a.name} (${a.id}): ${a.description}`)
            .join('\n');
    }
}

export const agentRegistry = new AgentRegistry();
