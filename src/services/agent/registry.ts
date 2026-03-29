import { logger } from '@/utils/logger';
import { AGENT_CONFIGS } from './agentConfig';
import { freezeAgentConfig } from './FreezeDiagnostic';

import { SpecializedAgent, AgentRegistryProvider } from './types';

export class AgentRegistry implements AgentRegistryProvider {
    private agents: Map<string, SpecializedAgent> = new Map();
    private loaders: Map<string, () => Promise<SpecializedAgent>> = new Map();
    private metadata: Map<string, SpecializedAgent> = new Map();
    private loadErrors: Map<string, { error: Error; timestamp: number; attempts: number }> = new Map();
    private loadingPromises: Map<string, Promise<SpecializedAgent | undefined>> = new Map();
    private isInitialized = false;

    constructor() {
        this.initializeAgents();
    }

    /**
     * Pre-warm critical agents (call on app startup)
     */
    async warmup(): Promise<void> {
        if (this.isInitialized) return;

        try {
            logger.debug('[AgentRegistry] Pre-warming Generalist agent...');
            const generalist = await this.getAsync('generalist');
            if (generalist) {
                logger.debug('[AgentRegistry] Generalist agent pre-warmed successfully');
                this.isInitialized = true;
            } else {
                logger.error('[AgentRegistry] Failed to pre-warm Generalist agent');
            }
        } catch (e: unknown) {
            logger.error('[AgentRegistry] Warmup error:', e);
        }
    }

    private initializeAgents() {
        // Register Complex Agents (indii Conductor — Hub)
        // CRITICAL: Generalist MUST be registered first to ensure fallback availability
        try {
            const generalistKey = 'generalist';
            // Generalist metadata
            const meta = {
                id: generalistKey,
                name: 'indii Conductor',
                description: 'General assistance, complex reasoning, fallback.',
                color: '#fff',
                category: 'specialist',
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(meta, async () => {
                const module = await import('./specialists/GeneralistAgent');
                if (!module.GeneralistAgent) {
                    throw new Error("Module imported but GeneralistAgent export is missing!");
                }
                const agent = new module.GeneralistAgent();
                // Check for initialize method using type guard
                if ('initialize' in agent && typeof agent.initialize === 'function') {
                    await agent.initialize();
                }
                return agent;
            });
        } catch (e: unknown) {
            logger.error("[AgentRegistry] CRITICAL: Failed to register GeneralistAgent:", e);
        }

        // Register Merchandise Agent (Class-based)
        try {
            const merchMeta = {
                id: 'merchandise',
                name: 'Merchandise Specialist',
                description: 'AI-powered merchandise creation expert. Handles product design, mockup generation, video production, and manufacturing coordination.',
                color: '#FFE135',
                category: 'specialist',
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(merchMeta, async () => {
                const { MerchandiseAgent } = await import('./MerchandiseAgent');
                return new MerchandiseAgent();
            });
        } catch (e: unknown) {
            logger.warn("[AgentRegistry] Failed to register MerchandiseAgent:", e);
        }

        // Register config-based agents
        if (AGENT_CONFIGS && Array.isArray(AGENT_CONFIGS)) {
            AGENT_CONFIGS.forEach(config => {
                try {
                    const meta = {
                        id: config.id,
                        name: config.name,
                        description: config.description,
                        color: config.color,
                        category: config.category,
                        execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
                    } as SpecializedAgent;

                    this.registerLazy(meta, async () => {
                        const { RAGAgent } = await import('./RAGAgent');
                        // Use RAGAgent which automatically queries File Search before execution
                        // RAGAgent extends BaseAgent.
                        const agent = new RAGAgent(config);
                        freezeAgentConfig(agent);
                        return agent;
                    });
                } catch (e: unknown) {
                    logger.warn(`[AgentRegistry] Failed to register agent '${config?.id || 'unknown'}':`, e);
                }
            });
        }

        // Register Keeper (Context Integrity Guardian)
        try {
            const keeperMeta = {
                id: 'keeper',
                name: 'Keeper',
                description: 'Context Integrity Guardian. Maintains coherence and recalls critical context/rules.',
                color: '#4B0082', // Indigo
                category: 'specialist',
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(keeperMeta, async () => {
                const { BaseAgent } = await import('./BaseAgent');
                const agent = new BaseAgent({
                    id: 'keeper',
                    name: 'Keeper',
                    description: 'Context Integrity Guardian',
                    color: '#4B0082',
                    category: 'specialist',
                    systemPrompt: 'You are Keeper, the Context Integrity Guardian for indiiOS. Your goal is to ensure all agent interactions are coherent, adhere to brand guidelines, and recall necessary memories or rules.',
                    tools: []
                });
                freezeAgentConfig(agent);
                return agent;
            });
        } catch (e: unknown) {
            logger.warn("[AgentRegistry] Failed to register Keeper agent:", e);
        }
        // Register Curriculum Agent (Music Business Education)
        try {
            const curriculumMeta = {
                id: 'curriculum',
                name: 'Music Education Specialist',
                description: 'Teaches independent artists the music business — copyright, royalties, contracts, distribution, and building a sustainable career.',
                color: '#FF4081',
                category: 'specialist',
                execute: async () => { throw new Error('Cannot execute metadata-only agent'); }
            } as SpecializedAgent;

            this.registerLazy(curriculumMeta, async () => {
                const { CurriculumAgent } = await import('./specialists/CurriculumAgent');
                return new CurriculumAgent();
            });
        } catch (e: unknown) {
            logger.warn("[AgentRegistry] Failed to register CurriculumAgent:", e);
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

    async getAsync(id: string, retryCount = 0): Promise<SpecializedAgent | undefined> {
        const MAX_RETRIES = 2;
        const RETRY_DELAY_MS = 500;

        // Return cached agent if already loaded
        if (this.agents.has(id)) {
            return this.agents.get(id);
        }

        // Deduplicate concurrent loads - if already loading, wait for that promise
        if (this.loadingPromises.has(id)) {
            return this.loadingPromises.get(id);
        }

        const loader = this.loaders.get(id);
        if (!loader) {
            return undefined;
        }

        // Create the loading promise and cache it to prevent duplicate loads
        const loadPromise = (async (): Promise<SpecializedAgent | undefined> => {
            try {
                logger.debug(`[AgentRegistry] Loading agent '${id}'...`);
                const agent = await loader();
                this.agents.set(id, agent);
                // Clear any previous error state
                this.loadErrors.delete(id);
                logger.debug(`[AgentRegistry] Agent '${id}' loaded successfully`);
                return agent;
            } catch (e: unknown) {
                const error = e instanceof Error ? e : new Error(String(e));
                const existingError = this.loadErrors.get(id);
                const attempts = (existingError?.attempts || 0) + 1;

                logger.error(`[AgentRegistry] Failed to load agent '${id}' (attempt ${attempts}):`, error.message);
                this.loadErrors.set(id, { error, timestamp: Date.now(), attempts });

                // Retry with exponential backoff
                if (retryCount < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
                    logger.debug(`[AgentRegistry] Retrying '${id}' in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    this.loadingPromises.delete(id); // Clear so retry can proceed
                    return this.getAsync(id, retryCount + 1);
                }

                logger.error(`[AgentRegistry] Agent '${id}' failed after ${MAX_RETRIES + 1} attempts`);
                return undefined;
            } finally {
                // Clean up loading promise after completion (unless retrying)
                if (retryCount >= MAX_RETRIES || this.agents.has(id)) {
                    this.loadingPromises.delete(id);
                }
            }
        })();

        this.loadingPromises.set(id, loadPromise);
        return loadPromise;
    }

    /**
     * Get the last error for an agent (useful for debugging)
     */
    getLoadError(id: string): { error: Error; timestamp: number; attempts: number } | undefined {
        return this.loadErrors.get(id);
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

