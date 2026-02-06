import { v4 as uuidv4 } from 'uuid';
import { useStore, AgentMessage, AgentThought } from '@/core/store';
import { ContextPipeline, PipelineContext } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { HybridOrchestrator } from './hybrid/HybridOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { AgentContext } from './types';
import { agentRegistry } from './registry';

import { coordinator } from './WorkflowCoordinator';
import { agentZeroService } from './AgentZeroService';

/**
 * AgentService is the primary entry point for agent-related operations.
 * It manages the lifecycle of user messages, context resolution, orchestration, and execution.
 */
export class AgentService {
    private isProcessing = false;
    private isWarmedUp = false;
    private contextPipeline: ContextPipeline;
    private orchestrator: AgentOrchestrator;
    private hybridOrchestrator: HybridOrchestrator;
    private executor: AgentExecutor;

    constructor() {
        // Components initialized. Agents are auto-registered in AgentRegistry singleton.
        this.contextPipeline = new ContextPipeline();
        this.orchestrator = new AgentOrchestrator();
        this.hybridOrchestrator = new HybridOrchestrator();
        this.executor = new AgentExecutor();

        // Pre-warm agents in the background (non-blocking)
        this.warmup();
    }

    /**
     * Pre-warm critical agents. Call this on app startup for better first-message latency.
     */
    async warmup(): Promise<void> {
        if (this.isWarmedUp) return;

        try {
            await agentRegistry.warmup();
            this.isWarmedUp = true;
        } catch (e) {
            console.warn('[indii:Service] Warmup failed, will retry on first message:', e);
        }
    }

    /**
     * Sends a message to the agent system, handling context resolution and orchestration.
     * @param text The user's input text.
     * @param attachments Optional file attachments (images/PDFs).
     * @param forcedAgentId Optional specific agent to use, bypassing orchestration.
     */
    async sendMessage(text: string, attachments?: { mimeType: string; base64: string }[], forcedAgentId?: string): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Ensure agents are warmed up before processing (non-blocking if already done)
        if (!this.isWarmedUp) {
            await this.warmup();
        }

        // PII Redaction for Agent/LLM Input AND Storage
        // We redact BEFORE storage to prevent PII from leaking into the Context Pipeline via chat history.
        const redactedText = this.redactPII(text);
        if (redactedText !== text) {
            console.log("🔒 PII Detected and Redacted from Agent Input");
        }

        // Add User Message (Redacted)
        const userMsg: AgentMessage = {
            id: uuidv4(),
            role: 'user',
            text: redactedText,
            timestamp: Date.now(),
            attachments
        };
        useStore.getState().addAgentMessage(userMsg);

        try {
            // 1. Resolve Context
            const context = await this.contextPipeline.buildContext();

            // 2. Workflow Coordination (The Brain)
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

            // Create a timeout controller - detect generation requests for longer timeout
            const isGenerationRequest = /\b(generate|create|make|build)\b.*\b(image|video|asset|art|visual)\b/i.test(text);
            const timeoutMs = isGenerationRequest ? 600000 : 300000; // 10 min for generation, 5 min otherwise

            // Track gallery state before execution for timeout grace check
            const galleryCountBefore = useStore.getState().generatedHistory?.length || 0;

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Indii Timeout: No response received after ${timeoutMs / 1000}s.`)), timeoutMs);
            });

            try {
                // Main execution logic wrapped in a race with timeout
                await Promise.race([
                    this.executeFlow(redactedText, attachments, context, responseId, forcedAgentId),
                    timeoutPromise
                ]);
            } catch (err: any) {
                console.error('[AgentService] Message Flow Failed:', err);

                // TIMEOUT GRACE: Check if images were added to gallery during execution
                const galleryCountAfter = useStore.getState().generatedHistory?.length || 0;
                const newItemsGenerated = galleryCountAfter > galleryCountBefore;

                if (err.message?.includes('Timeout')) {
                    if (newItemsGenerated) {
                        // Case A: Items were found in gallery (already handled by logic above, but keeping for clarity)
                        console.log('[AgentService] Timeout grace: Generation detected in gallery');
                        updateAgentMessage(responseId, {
                            text: `✅ **Generation Complete!** ${galleryCountAfter - galleryCountBefore} new item(s) added to your Gallery.`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Synthesis successful',
                                timestamp: Date.now(),
                                type: 'logic'
                            }]
                        });
                    } else if (isGenerationRequest) {
                        // Case B: Generation request but no items yet - show "Taking longer" message
                        console.log('[AgentService] Timeout nudge: Showing "taking longer" message');
                        updateAgentMessage(responseId, {
                            text: `⏳ **Still working on it...** The synthesis is taking a bit longer than expected, but I'm still processing your request in the background. Keep an eye on your Gallery - your assets will appear there shortly!`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Background processing continues',
                                timestamp: Date.now(),
                                type: 'logic'
                            }]
                        });
                    } else {
                        // Case C: Standard timeout
                        updateAgentMessage(responseId, {
                            text: `❌ **Timeout:** The request is taking longer than expected (${timeoutMs / 1000}s). If you're generating high-res assets, they may still appear in your Gallery soon.`,
                            thoughts: [{
                                id: uuidv4(),
                                text: 'Request exceeded time limit',
                                timestamp: Date.now(),
                                type: 'error'
                            }]
                        });
                    }
                } else {
                    // Non-timeout error (API failure, etc)
                    updateAgentMessage(responseId, {
                        text: `❌ **Error:** ${err.message || 'The request failed.'}`,
                        thoughts: [{
                            id: uuidv4(),
                            text: 'Execution failed',
                            timestamp: Date.now(),
                            type: 'error'
                        }]
                    });
                }
            } finally {
                // CRITICAL: Always clear streaming state to avoid stuck "..." loading
                updateAgentMessage(responseId, { isStreaming: false });
            }

        } catch (e: unknown) {
            const error = e instanceof Error ? e : new Error(String(e));
            this.addSystemMessage(`❌ **Fatal Error:** ${error.message || 'Unknown error occurred.'}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Internal execution flow for sendMessage, separated for timeout racing.
     */
    private async executeFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string,
        forcedAgentId?: string
    ): Promise<void> {
        const { updateAgentMessage } = useStore.getState();
        const { activeAgentProvider } = useStore.getState();

        // 1. Check Provider: If set to 'agent-zero', delegate immediately
        if (activeAgentProvider === 'agent-zero') {
            await this.handleAgentZeroFlow(text, attachments, responseId);
            return;
        }

        // 2. Use Coordinator
        let coordinatorResult: string;
        if (forcedAgentId) {
            coordinatorResult = 'DELEGATED_TO_AGENT';
        } else {
            // Pass REDACTED text to the coordinator
            coordinatorResult = await coordinator.handleUserRequest(text, context, (chunk) => {
                // Update the UI optimistically if chunks arrive from fast path
                updateAgentMessage(responseId, { text: chunk });
            });
        }

        if (coordinatorResult !== 'DELEGATED_TO_AGENT') {
            // Direct Response from GenAI
            updateAgentMessage(responseId, {
                text: coordinatorResult,
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

        // 3. Fallback to Agent Orchestration (Executor)
        const agentId = forcedAgentId;
        if (!agentId) {
            // HYBRID GRAFT: Use the new HybridOrchestrator for complex reasoning
            console.info('[AgentService] Using Hybrid Orchestrator DNA...');
            const hybridResponse = await this.hybridOrchestrator.execute(context, text);

            updateAgentMessage(responseId, {
                text: hybridResponse,
                isStreaming: false
            });
            return;
        }

        // Update agent ID in the placeholder (Legacy path)
        updateAgentMessage(responseId, { agentId });

        let currentStreamedText = '';

        // Pass REDACTED text to the executor
        const result = await this.executor.execute(agentId, text, context as PipelineContext, (event) => {
            if (event.type === 'token') {
                currentStreamedText += event.content;
                updateAgentMessage(responseId, { text: currentStreamedText });
            }

            if (event.type === 'thought' || event.type === 'tool' || event.type === 'tool_result') {
                const currentMsg = useStore.getState().agentHistory.find(m => m.id === responseId);

                // Firestore explicitly rejects 'undefined' values. We must sanitize.
                const newThought: AgentThought = {
                    id: uuidv4(),
                    text: event.content || '', // Ensure no undefined text
                    timestamp: Date.now(),
                    type: event.type as any, // Typed in interface
                };

                if (event.type === 'tool' || event.type === 'tool_result') {
                    if (event.toolName) {
                        newThought.toolName = event.toolName;
                    }
                }

                // AGGRESSIVE SANITIZATION: Firestore chokes on undefined.
                const safeThought = JSON.parse(JSON.stringify(newThought));

                if (currentMsg) {
                    updateAgentMessage(responseId, {
                        thoughts: [...(currentMsg.thoughts || []), safeThought]
                    });
                }
            }
        }, undefined, undefined, attachments);

        if (result && result.text) {
            // Final update with full text and signature
            updateAgentMessage(responseId, {
                text: result.text,
                thoughtSignature: result.thoughtSignature
            });
        } else {
            updateAgentMessage(responseId, {
                thoughtSignature: result?.thoughtSignature
            });
        }
    }

    private async handleAgentZeroFlow(text: string, attachments: any[] | undefined, responseId: string): Promise<void> {
        const { updateAgentMessage } = useStore.getState();

        // Adapt attachments for Agent Zero (files base64 with filenames)
        let agentZeroAttachments: { filename: string; base64: string }[] = [];

        if (attachments && attachments.length > 0) {
            agentZeroAttachments = attachments.map((att, index) => {
                // Determine extension from mimeType
                let ext = 'bin';
                if (att.mimeType === 'image/jpeg') ext = 'jpg';
                else if (att.mimeType === 'image/png') ext = 'png';
                else if (att.mimeType === 'image/webp') ext = 'webp';
                else if (att.mimeType === 'application/pdf') ext = 'pdf';
                else if (att.mimeType === 'text/plain') ext = 'txt';

                return {
                    filename: `upload_${Date.now()}_${index}.${ext}`,
                    base64: att.base64
                };
            });
        }

        // Add initial "processing" thought
        updateAgentMessage(responseId, {
            thoughts: [{
                id: uuidv4(),
                text: 'Agent Zero is processing your request...',
                timestamp: Date.now(),
                type: 'logic',
                toolName: 'Agent Zero'
            }]
        });

        try {
            const response = await agentZeroService.sendMessage(text, agentZeroAttachments);

            // Parse response for tool usage patterns
            const thoughts = this.parseAgentZeroToolUsage(response.message);

            // Always include the base execution thought
            thoughts.unshift({
                id: uuidv4(),
                text: 'Executed on Agent Zero Container',
                timestamp: Date.now(),
                type: 'logic',
                toolName: 'Agent Zero'
            });

            updateAgentMessage(responseId, {
                text: response.message,
                thoughts
            });

            // If there are tool calls or attachments in response, handle them here
            if (response.attachments && response.attachments.length > 0) {
                // Append attachment links to text
                const links = response.attachments.map(url => `\n\n![Generated Asset](${url})`).join('');
                updateAgentMessage(responseId, {
                    text: response.message + links
                });
            }
        } catch (err: any) {
            updateAgentMessage(responseId, {
                text: `Agent Zero Error: ${err.message}`,
                thoughts: [{
                    id: uuidv4(),
                    text: 'Agent Zero Connection Failed',
                    timestamp: Date.now(),
                    type: 'error'
                }]
            });
            throw err; // Re-throw to be caught by executeFlow catch block
        }
    }

    /**
     * Parse Agent Zero response to detect tool usage patterns.
     * This creates visual feedback for tool execution even though Agent Zero
     * doesn't currently stream tool events.
     */
    private parseAgentZeroToolUsage(message: string): AgentThought[] {
        const thoughts: AgentThought[] = [];

        // Pattern detection for common Agent Zero tool usage
        const patterns = [
            {
                regex: /```(?:python|bash|sh|javascript|typescript)/gi,
                toolName: 'Code Execution',
                type: 'tool' as const,
                getMessage: () => 'Executed code to process your request'
            },
            {
                regex: /(?:created|wrote|saved|generated)\s+(?:file|image|document)/gi,
                toolName: 'File Operations',
                type: 'tool' as const,
                getMessage: (match: string) => `File operation: ${match}`
            },
            {
                regex: /(?:searched|browsed|visited|fetched)\s+(?:web|internet|url|website)/gi,
                toolName: 'Web Browser',
                type: 'tool' as const,
                getMessage: () => 'Browsed the web for information'
            },
            {
                regex: /img:\/\//gi,
                toolName: 'Image Generation',
                type: 'tool' as const,
                getMessage: () => 'Generated an image using Imagen 3'
            },
            {
                regex: /(?:analyzed|processed|examined)\s+(?:image|photo|picture)/gi,
                toolName: 'Vision Analysis',
                type: 'tool' as const,
                getMessage: () => 'Analyzed image content with Gemini Vision'
            },
            {
                regex: /(?:installed|updated|executed)\s+(?:package|dependency|npm|pip)/gi,
                toolName: 'Package Manager',
                type: 'tool' as const,
                getMessage: () => 'Managed project dependencies'
            }
        ];

        // Check each pattern
        for (const pattern of patterns) {
            const matches = message.match(pattern.regex);
            if (matches && matches.length > 0) {
                thoughts.push({
                    id: uuidv4(),
                    text: pattern.getMessage(matches[0]),
                    timestamp: Date.now(),
                    type: pattern.type,
                    toolName: pattern.toolName
                });
            }
        }

        return thoughts;
    }

    /**
     * Programmatically runs an agent for internal tasks.
     * @param agentId The ID of the agent to execute.
     * @param task The task description.
     * @param parentContext Optional parent context to inherit.
     * @param parentTraceId Optional trace ID for observability chaining.
     * @param attachments Optional file attachments.
     */
    async runAgent(agentId: string, task: string, parentContext?: AgentContext, parentTraceId?: string, attachments?: { mimeType: string; base64: string }[]): Promise<any> {
        // CRITICAL: Deep clone context to prevent mutation affecting parent agent
        // Context objects are passed by reference and can be mutated during execution,
        // causing parent agents to lose their execution state ("dismantling")
        let context: AgentContext;

        if (parentContext) {
            // Deep clone to isolate execution contexts
            context = JSON.parse(JSON.stringify(parentContext));

            // Restore non-serializable properties after cloning
            // (chatHistory and attachments contain references we want to preserve)
            if (parentContext.chatHistory) {
                context.chatHistory = [...parentContext.chatHistory];
            }
            if (parentContext.attachments) {
                context.attachments = [...parentContext.attachments];
            }
        } else {
            context = await this.contextPipeline.buildContext();
        }

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

    private addSystemMessage(text: string): void {
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }

    /**
     * Redacts sensitive information from the input text before sending it to the LLM.
     */
    private redactPII(text: string): string {
        // Redact Credit Cards: 13-19 digits, possibly separated by spaces or dashes.
        // Supports 4 groups of 4 (Visa/MC) and 15-digit (AMEX) formats.
        // Regex looks for sequences of digits/spaces/dashes that look like cards.
        const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;

        // Redact "Password: value" pattern
        // Matches "password" followed by optional "is", then optional separators (colon, space, equals),
        // then captures the value until whitespace or punctuation.
        // We use a replacement function to ensure we replace the VALUE, not the label.
        // Regex: (password(?:\s+is)?[:\s=]+)([^\s\.,;!]+)
        const passwordRegex = /(password(?:\s+is)?[:\s=]+)([^\s.,;!]+)/gi;

        // Heuristic Check: Only replace if it passes Luhn check?
        // For now, simple pattern matching to avoid complexity in this security filter.
        // Note: The previous regex was too strict (4x4). This one is broader.
        let redacted = text.replace(creditCardRegex, (match) => {
            // Basic filter to avoid matching timestamps or simple IDs (e.g. 2024-10-10)
            // A credit card usually has mixed spacing or is long.
            if (match.replace(/\D/g, '').length < 13) return match;
            return '[REDACTED_CREDIT_CARD]';
        });

        redacted = redacted.replace(passwordRegex, (match, prefix, value) => {
            return `${prefix}[REDACTED_PASSWORD]`;
        });

        return redacted;
    }
}

export const agentService = new AgentService();

