import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { ContextPipeline, PipelineContext } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { AgentContext } from './types';

import { coordinator } from './WorkflowCoordinator';

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

            // 2. Workflow Coordination (The Brain)
            // Decide if this is a simple generation or complex orchestration
            const responseId = uuidv4();
            const { addAgentMessage, updateAgentMessage } = useStore.getState();

            // Create placeholder for the response
            addAgentMessage({
                id: responseId,
                role: 'model',
                text: '',
                timestamp: Date.now(),
                isStreaming: true,
                thoughts: [],
                agentId: 'generalist' // Default initially
            });

            // Use Coordinator
            let coordinatorResult: string;

            if (forcedAgentId) {
                coordinatorResult = 'DELEGATED_TO_AGENT';
            } else {
                coordinatorResult = await coordinator.handleUserRequest(text, context, (chunk) => {
                    // For direct generation, we might get chunks if we enhanced it to support streaming.
                    // Currently handleUserRequest handles generation atomically but accepts a callback.
                    // We update the UI optimistically if chunks arrive.
                    updateAgentMessage(responseId, { text: chunk });
                });
            }

            if (coordinatorResult !== 'DELEGATED_TO_AGENT') {
                // Direct Response from GenAI
                updateAgentMessage(responseId, {
                    text: coordinatorResult,
                    isStreaming: false,
                    thoughts: [{
                        id: uuidv4(),
                        text: "Executed via Fast Path (Workflow Coordinator)",
                        timestamp: Date.now(),
                        type: 'logic',
                        toolName: 'Direct Generation'
                    }]
                });
                return;
            }

            // 3. Fallback to Agent Orchestration
            let agentId = forcedAgentId;
            if (!agentId) {
                // If coordinator delegated, we determine the best agent
                agentId = await this.orchestrator.determineAgent(context, text);
            }

            // Update agent ID in the placeholder
            updateAgentMessage(responseId, { agentId });

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
            }, undefined, undefined, attachments);

            if (result && result.text) {
                if (!result.text.includes("Agent Zero")) {
                    updateAgentMessage(responseId, { text: result.text, isStreaming: false });
                }
            } else {
                updateAgentMessage(responseId, { isStreaming: false });
            }

        } catch (e: unknown) {
            const error = e as Error;
            this.addSystemMessage(`❌ **Error:** ${error.message || 'Unknown error occurred.'}`);
        } finally {
            this.isProcessing = false;
        }
    }


    async runAgent(agentId: string, task: string, parentContext?: AgentContext, parentTraceId?: string, attachments?: { mimeType: string; base64: string }[]): Promise<unknown> {
        // Build a pipeline context from the parent context or fresh
        const context = parentContext || await this.contextPipeline.buildContext();

        // Ensure minimal context exists
        if (!context.chatHistory) context.chatHistory = [];
        if (!context.chatHistoryString) context.chatHistoryString = '';

        return await this.executor.execute(
            agentId,
            task,
            context as PipelineContext,
            undefined,
            undefined,
            parentTraceId,
            attachments || context.attachments
        );
    }

    private addSystemMessage(text: string) {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }
}

export const agentService = new AgentService();

