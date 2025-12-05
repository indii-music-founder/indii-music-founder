import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { agentRegistry } from './registry';
import { LegalAgent } from './specialists/LegalAgent';
import { CampaignAgent } from './specialists/MarketingAgent';
import { MusicAgent } from './specialists/MusicAgent';
import { PublicistAgent } from './specialists/PublicistAgent';
import { BrandAgent } from './specialists/BrandAgent';
import { RoadAgent } from './specialists/RoadAgent';
import { DirectorAgent } from './specialists/DirectorAgent';
import { VideoAgent } from './specialists/VideoAgent';
import { GeneralistAgent } from './specialists/GeneralistAgent';
import { ContextPipeline } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';

export class AgentService {
    private isProcessing = false;
    private contextPipeline: ContextPipeline;
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
        agentRegistry.register(new DirectorAgent());
        agentRegistry.register(new VideoAgent());
        agentRegistry.register(new GeneralistAgent());

        // Initialize Components
        this.contextPipeline = new ContextPipeline();
        this.orchestrator = new AgentOrchestrator();
        this.executor = new AgentExecutor();
    }

    async sendMessage(text: string, attachments?: { mimeType: string; base64: string }[], forcedAgentId?: string) {
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
            const context = await this.contextPipeline.buildContext();

            // 2. Determine Agent
            let agentId = forcedAgentId;
            if (!agentId) {
                agentId = await this.orchestrator.determineAgent(context, text);
            }
            console.log(`[AgentService] Selected Agent: ${agentId} ${forcedAgentId ? '(Forced)' : '(Auto)'}`);

            // 3. Execute Agent
            const responseId = uuidv4();
            const { addAgentMessage, updateAgentMessage } = useStore.getState();

            // Create placeholder for the response
            addAgentMessage({
                id: responseId,
                role: 'model',
                text: '',
                timestamp: Date.now(),
                isStreaming: true,
                thoughts: []
            });

            const result = await this.executor.execute(agentId, text, context, (event) => {
                if (event.type === 'thought' || event.type === 'tool') {
                    const currentMsg = useStore.getState().agentHistory.find(m => m.id === responseId);
                    const newThought = {
                        id: uuidv4(),
                        text: event.content,
                        timestamp: Date.now(),
                        type: event.type as 'tool' | 'logic' | 'error',
                        toolName: event.toolName
                    };

                    if (currentMsg) {
                        updateAgentMessage(responseId, {
                            thoughts: [...(currentMsg.thoughts || []), newThought]
                        });
                    }
                }
            });

            if (typeof result === 'string' && !result.includes("Agent Zero")) {
                updateAgentMessage(responseId, { text: result, isStreaming: false });
            } else {
                updateAgentMessage(responseId, { isStreaming: false });
            }

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

