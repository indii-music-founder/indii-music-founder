import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { agentRegistry } from './registry';
import { LegalAgent } from './specialists/LegalAgent';
import { CampaignAgent } from './specialists/MarketingAgent';
import { MusicAgent } from './specialists/MusicAgent';
import { PublicistAgent } from './specialists/PublicistAgent';
import { BrandAgent } from './specialists/BrandAgent';
import { RoadAgent } from './specialists/RoadAgent';
import { ContextResolver } from './components/ContextResolver';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';

class AgentService {
    private isProcessing = false;
    private contextResolver: ContextResolver;
    private orchestrator: AgentOrchestrator;
    private executor: AgentExecutor;

    constructor() {
        // Register Specialists
        agentRegistry.register(new LegalAgent());
        agentRegistry.register(new CampaignAgent());
        agentRegistry.register(new MusicAgent());
        agentRegistry.register(new PublicistAgent());
        agentRegistry.register(new BrandAgent());
        agentRegistry.register(new RoadAgent());

        // Initialize Components
        this.contextResolver = new ContextResolver();
        this.orchestrator = new AgentOrchestrator();
        this.executor = new AgentExecutor();
    }

    async sendMessage(text: string, attachments?: { mimeType: string; base64: string }[]) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Add User Message
        const userMsg: AgentMessage = {
            id: uuidv4(),
            role: 'user',
            text,
            timestamp: Date.now(),
            attachments
        };
        useStore.getState().addAgentMessage(userMsg);

        try {
            // 1. Resolve Context
            const context = await this.contextResolver.resolveContext();

            // 2. Determine Agent
            const agentId = this.orchestrator.determineAgent(context);
            console.log(`[AgentService] Selected Agent: ${agentId}`);

            // 3. Execute Agent
            await this.executor.execute(agentId, text, context);

        } catch (e: any) {
            console.error(e);
            this.addSystemMessage(`Error: ${e.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private addSystemMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }
}

export const agentService = new AgentService();

