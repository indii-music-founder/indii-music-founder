import { AI } from '@/services/ai/AIService'; // Keep if needed for types, though not used in registry directly in original
import { AI_MODELS } from '@/core/config/ai-models';
import { BaseAgent } from './BaseAgent';
import { AGENT_CONFIGS } from './agentConfig';
import { GeneralistAgent } from './specialists/GeneralistAgent'; // Import the "Agent Zero" explicitly

export interface AgentResponse {
    text: string;
    data?: any;
}

export type AgentProgressCallback = (event: { type: 'thought' | 'tool' | 'token'; content: string; toolName?: string }) => void;

export interface SpecializedAgent {
    id: string;
    name: string;
    description: string;
    color: string;
    category: 'manager' | 'department' | 'specialist';
    execute(task: string, context?: any, onProgress?: AgentProgressCallback): Promise<AgentResponse>;
}

export class AgentRegistry {
    private agents: Map<string, SpecializedAgent> = new Map();

    constructor() {
        this.initializeAgents();
    }

    private initializeAgents() {
        // Register Config-based Agents
        AGENT_CONFIGS.forEach(config => {
            const agent = new BaseAgent(config);
            this.register(agent);
        });

        // Register Complex Agents (Agent Zero)
        // We handle this one manually because it overrides execute() with complex logic
        try {
            const generalistKey = 'generalist';
            if (!this.agents.has(generalistKey)) {
                const generalist = new GeneralistAgent();
                this.register(generalist);
            }
        } catch (e) {
            console.warn("Failed to register GeneralistAgent:", e);
        }
    }

    register(agent: SpecializedAgent) {
        this.agents.set(agent.id, agent);
        // Debug logging removed for production
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

