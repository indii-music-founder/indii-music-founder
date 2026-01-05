/**
 * Instrument-Aware Agent Service
 *
 * Extended AgentService that can discover and execute instruments.
 * Provides agents with access to the full instrument ecosystem.
 */

import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage } from '@/core/store';
import { ContextPipeline } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { agentContextBridge } from './AgentContextBridge';
import { AgentContext } from './types';

export interface InstrumentAgentMessage extends AgentMessage {
  instrumentUsed?: string;
  instrumentCost?: number;
  instrumentResult?: any;
}

export class InstrumentAgentService {
  private isProcessing = false;
  private contextPipeline: ContextPipeline;
  private orchestrator: AgentOrchestrator;
  private executor: AgentExecutor;
  private contextBridge = agentContextBridge;

  constructor() {
    this.contextPipeline = new ContextPipeline();
    this.orchestrator = new AgentOrchestrator();
    this.executor = new AgentExecutor();
  }

  /**
   * Send a message to the agent with instrument awareness
   */
  async sendMessage(
    text: string,
    attachments?: { mimeType: string; base64: string }[],
    forcedAgentId?: string,
    options?: {
      enableInstruments?: boolean; // Whether agent can use instruments
      skipApproval?: boolean; // Skip approvals for testing
    }
  ): Promise<void> {
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

      // 3. Add instrument descriptions to context if enabled
      if (options?.enableInstruments !== false) {
        const instrumentDescriptions = await this.contextBridge.getAgentInstrumentDescriptions();
        context.systemPrompt = `
${context.systemPrompt}

${instrumentDescriptions}

When you need to perform an action (generate images, videos, analyze data, etc.), use the available instrument functions.
The format is: use_instrument_INSTRUMENT_ID(instrument_id, { parameters })
`;
      }

      // 4. Execute Agent
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
        agentId
      });

      let currentStreamedText = '';

      const result = await this.executor.execute(
        agentId,
        text,
        context as any,
        (event) => {
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

          // Handle instrument execution events
          if (event.type === 'instrument execution') {
            this.handleInstrumentExecution(responseId, event);
          }
        },
        undefined,
        undefined,
        attachments
      );

      if (result && result.text) {
        if (!result.text.includes('Agent Zero')) {
          updateAgentMessage(responseId, { text: result.text, isStreaming: false });
        }
      } else {
        updateAgentMessage(responseId, { isStreaming: false });
      }

    } catch (e: unknown) {
      const error = e as Error;
      console.error('[InstrumentAgentService] Execution Failed:', error);
      this.addSystemMessage(`❌ **Error:** ${error.message || 'Unknown error occurred.'}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle instrument execution events
   */
  private async handleInstrumentExecution(messageId: string, event: any): Promise<void> {
    const { updateAgentMessage } = useStore.getState();
    const currentMsg = useStore.getState().agentHistory.find(m => m.id === messageId);

    if (!currentMsg) return;

    try {
      const result = await this.contextBridge.executeAgentInstrument(
        event.instrumentId,
        event.parameters
      );

      // Add instrument result as a thought
      const instrumentThought = {
        id: uuidv4(),
        text: `🎨 Executed instrument: ${event.instrumentId} → ${JSON.stringify(result).slice(0, 200)}...`,
        timestamp: Date.now(),
        type: 'tool' as const,
        toolName: event.instrumentId.replace('use_instrument_', '')
      };

      updateAgentMessage(messageId, {
        thoughts: [...(currentMsg.thoughts || []), instrumentThought]
      });
    } catch (error) {
      // Add error as a thought
      const errorThought = {
        id: uuidv4(),
        text: `❌ Instrument execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        type: 'error' as const,
        toolName: event.instrumentId.replace('use_instrument_', '')
      };

      updateAgentMessage(messageId, {
        thoughts: [...(currentMsg.thoughts || []), errorThought]
      });
    }
  }

  /**
   * Allow an agent to directly execute an instrument
   * (bypasses the chat interface, useful for tool-integrated reasoning)
   */
  async executeAgentInstrument(
    agentId: string,
    instrumentId: string,
    parameters: Record<string, any>
  ): Promise<any> {
    return this.contextBridge.executeAgentInstrument(instrumentId, parameters);
  }

  /**
   * Run an agent with full instrument capabilities
   */
  async runAgent(
    agentId: string,
    task: string,
    parentContext?: AgentContext,
    parentTraceId?: string,
    attachments?: { mimeType: string; base64: string }[],
    options?: {
      enableInstruments?: boolean;
    }
  ): Promise<unknown> {
    // Build a pipeline context from the parent context or fresh
    const context = parentContext || await this.contextPipeline.buildContext();

    // Ensure minimal context exists
    if (!context.chatHistory) context.chatHistory = [];
    if (!context.chatHistoryString) context.chatHistoryString = '';

    // Add instrument descriptions if enabled
    if (options?.enableInstruments !== false) {
      const instrumentDescriptions = await this.contextBridge.getAgentInstrumentDescriptions();
      context.systemPrompt = `
${context.systemPrompt}

${instrumentDescriptions}

When you need to perform actions, use the available instrument functions.
`;
    }

    return await this.executor.execute(
      agentId,
      task,
      context as any,
      undefined,
      undefined,
      parentTraceId,
      attachments || context.attachments
    );
  }

  /**
   * Get the current agent context with instrument information
   */
  async getAgentContext(): Promise<{
    availableInstruments: Array<{
      id: string;
      name: string;
      description: string;
    }>;
    currentTier: string;
    quotaRemaining: boolean;
  }> {
    const context = await this.contextBridge.buildAgentContext();

    return {
      availableInstruments: context.availableInstruments.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description
      })),
      currentTier: context.currentTier,
      quotaRemaining: context.hasQuotaRemaining
    };
  }

  /**
   * Add a system message to the chat
   */
  private addSystemMessage(text: string): void {
    useStore.getState().addAgentMessage({
      id: uuidv4(),
      role: 'system',
      text,
      timestamp: Date.now()
    });
  }
}

export const instrumentAgentService = new InstrumentAgentService();
