import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { agentRegistry } from './registry';
import { ContextPipeline } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';

export class AgentService {
    private isProcessing = false;
    private contextPipeline: ContextPipeline;
    private orchestrator: AgentOrchestrator;
    private executor: AgentExecutor;

    constructor() {
        // Components initialized. Agents are auto-registered in AgentRegistry singleton.
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

            let currentStreamedText = '';

            const result = await this.executor.execute(agentId, text, context, (event) => {
                if (event.type === 'token') {
                    currentStreamedText += event.content;
                    updateAgentMessage(responseId, { text: currentStreamedText });
                }

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

            if (result && result.text) {
                if (!result.text.includes("Agent Zero")) {
                    updateAgentMessage(responseId, { text: result.text, isStreaming: false });
                }
            } else {
                updateAgentMessage(responseId, { isStreaming: false });
            }

        } catch (e: any) {
            console.error('[AgentService] Execution Failed:', e);
            this.addSystemMessage(`❌ **Error:** ${e.message || 'Unknown error occurred.'}`);
        } finally {
            this.isProcessing = false;
        }
    }
    async runAgent(agentId: string, task: string, parentContext?: any): Promise<any> {
        // Build a pipeline context from the parent context or fresh
        const context = parentContext || await this.contextPipeline.buildContext();

        // Ensure minimal context exists
        if (!context.chatHistory) context.chatHistory = [];

        console.log(`[AgentService] Delegating task to ${agentId}: "${task}"`);

        return await this.executor.execute(agentId, task, context);
    }

    private addSystemMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }
}

export const agentService = new AgentService();

