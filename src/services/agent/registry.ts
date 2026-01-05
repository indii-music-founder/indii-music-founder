import { AI } from '@/services/ai/AIService'; // Keep if needed for types, though not used in registry directly in original
import { AI_MODELS } from '@/core/config/ai-models';
import { AGENT_CONFIGS } from './agentConfig';

import { AgentContext } from './types';

export interface AgentResponse {
    text: string;
    data?: unknown;
}

export type AgentProgressCallback = (event: { type: 'thought' | 'tool' | 'token'; content: string; toolName?: string }) => void;

export interface SpecializedAgent {
    id: string;
    name: string;
    description: string;
    color: string;
    category: 'manager' | 'department' | 'specialist';
    execute(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse>;
}

export class AgentRegistry {
    private agents: Map<string, SpecializedAgent> = new Map();
    private loaders: Map<string, () => Promise<SpecializedAgent>> = new Map();
    private metadata: Map<string, SpecializedAgent> = new Map(); // Stores lightweight metadata for both lazy and active agents

    constructor() {
        this.initializeAgents();
    }

    private initializeAgents() {
        // Register Config-based Agents
        // For now, we wrap the instantiation in a loader to defer BaseAgent overhead
        AGENT_CONFIGS.forEach(config => {
            // We register the config as metadata immediately so Orchestrator can see it
            // We use the config itself as the "SpecializedAgent" shape for metadata purposes
            // (BaseAgent config satisfies most of SpecializedAgent, but execute() is missing in config)

            // Allow metadata to be just the config properties
            const meta = {
                id: config.id,
                name: config.name,
                description: config.description,
                color: config.color,
                category: config.category,
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(meta, async () => {
                const { BaseAgent } = await import('./BaseAgent');
                return new BaseAgent(config);
            });
        });

        // Register Complex Agents (Agent Zero)
        try {
            const generalistKey = 'generalist';
            // Generalist metadata
            const meta = {
                id: generalistKey,
                name: 'Agent Zero',
                description: 'General assistance, complex reasoning, fallback.',
                color: '#fff',
                category: 'specialist',
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(meta, async () => {
                const { GeneralistAgent } = await import('./specialists/GeneralistAgent');
                return new GeneralistAgent();
            });

        } catch (e) {
            console.warn("Failed to register GeneralistAgent:", e);
        }
    }

    register(agent: SpecializedAgent) {
        this.agents.set(agent.id, agent);
        this.metadata.set(agent.id, agent);
    }

    registerLazy(meta: SpecializedAgent, loader: () => Promise<SpecializedAgent>) {
        this.metadata.set(meta.id, meta);
        this.loaders.set(meta.id, loader);
    }

    get(id: string): SpecializedAgent | undefined {
        // Legacy synchronous get - only works if already loaded
        return this.agents.get(id);
    }

    async getAsync(id: string): Promise<SpecializedAgent | undefined> {
        if (this.agents.has(id)) {
            return this.agents.get(id);
        }

        const loader = this.loaders.get(id);
        if (loader) {
            try {
                const agent = await loader();
                this.agents.set(id, agent);
                return agent;
            } catch (e) {
                console.error(`[AgentRegistry] Failed to load agent '${id}':`, e);
                return undefined;
            }
        }

        return undefined;
    }

    getAll(): SpecializedAgent[] {
        // Returns mixed active agents and metadata-only placeholders
        // Use with caution for execution. Use for listing capabilities.
        return Array.from(this.metadata.values());
    }

    listCapabilities(): string {
        return Array.from(this.metadata.values())
            .map(a => `- ${a.name} (${a.id}): ${a.description}`)
            .join('\n');
    }
}

export const agentRegistry = new AgentRegistry();

