import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentThought } from '@/core/store';
// useStore removed
import { ContextPipeline, PipelineContext } from './components/ContextPipeline';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { HybridOrchestrator } from './hybrid/HybridOrchestrator';
import { AgentExecutor } from './components/AgentExecutor';
import { SpecializedAgent, AgentResponse, AgentProgressCallback, AgentContext, HUB_AGENT_ID, SPOKE_AGENT_IDS } from './types';
import { memoryService } from './MemoryService';
import { agentRegistry } from './registry';

import { coordinator } from './WorkflowCoordinator';
import { agentZeroService } from './AgentZeroService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';

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
        const { useStore } = await import('@/core/store');
        useStore.getState().addAgentMessage(userMsg);

        try {
            // 1. Resolve Context
            const context = await this.contextPipeline.buildContext();

            // 2. Workflow Coordination (The Brain)
            const responseId = uuidv4();
            const { useStore } = await import('@/core/store');
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

            let timeoutHandle: NodeJS.Timeout;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error(`Indii Timeout: No response received after ${timeoutMs / 1000}s.`)), timeoutMs);
            });

            try {
                // Main execution logic wrapped in a race with timeout
                await Promise.race([
                    this.executeFlow(redactedText, attachments, context, responseId, forcedAgentId).finally(() => {
                        if (timeoutHandle) clearTimeout(timeoutHandle);
                    }),
                    timeoutPromise
                ]);
            } catch (err: unknown) {
                console.error('[AgentService] Message Flow Failed:', err);

                // TIMEOUT GRACE: Check if images were added to gallery during execution
                const galleryCountAfter = useStore.getState().generatedHistory?.length || 0;
                const newItemsGenerated = galleryCountAfter > galleryCountBefore;

                const errorMessage = err instanceof Error ? err.message : String(err);
                if (errorMessage.includes('Timeout')) {
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
                        text: `❌ **Error:** ${(err as Error).message || 'The request failed.'}`,
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
            const errObj = e instanceof Error ? e : new Error(String(e));
            this.addSystemMessage(`❌ **Fatal Error:** ${errObj.message || 'Unknown error occurred.'}`);
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
        const { useStore } = await import('@/core/store');
        const { updateAgentMessage, activeAgentProvider } = useStore.getState();

        // 0. Direct Chat: Bypass all orchestration, talk straight to the LLM
        if (activeAgentProvider === 'direct') {
            await this.handleDirectChatFlow(text, attachments, context, responseId);
            return;
        }

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
            coordinatorResult = await coordinator.handleUserRequest(text, context, (chunk: string) => {
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
        let agentId = forcedAgentId;

        // Resolve Active Agent ID if not forced
        if (!agentId) {
            const { sessions, activeSessionId } = useStore.getState();
            const session = sessions[activeSessionId || ''];
            agentId = session?.participants?.[0] || 'generalist';
        }

        // Update agent ID in the placeholder (Native/Agent path)
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
                    type: event.type as AgentThought["type"], // Typed in interface
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

    private async handleAgentZeroFlow(text: string, attachments: { mimeType: string; base64: string }[] | undefined, responseId: string): Promise<void> {
        const { useStore } = await import('@/core/store');
        const { updateAgentMessage } = useStore.getState();

        // Adapt attachments for Agent Zero (files base64 with filenames)
        let agentZeroAttachments: { filename: string; base64: string }[] = [];

        if (attachments && attachments.length > 0) {
            agentZeroAttachments = attachments.map((att: { mimeType: string; base64: string }, index: number) => {
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
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            updateAgentMessage(responseId, {
                text: `Agent Zero Error: ${errorMessage}`,
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
     * Direct Chat Flow: Bypasses all orchestration and talks straight to the LLM.
     * Uses FirebaseAIService streaming for low-latency conversational responses.
     * No tools, no specialist agents, no context pipeline overhead.
     */
    private async handleDirectChatFlow(
        text: string,
        attachments: { mimeType: string; base64: string }[] | undefined,
        context: AgentContext,
        responseId: string
    ): Promise<void> {
        const { useStore } = await import('@/core/store');
        const { updateAgentMessage, agentHistory } = useStore.getState();

        // Build persona-aware system prompt from context
        const artistName = context.userProfile?.displayName || '';
        const brandDesc = context.brandKit?.brandDescription || '';
        const genre = context.brandKit?.releaseDetails?.genre || '';

        let personaContext = '';
        if (artistName) {
            personaContext += `\nYou are working with the artist **${artistName}**.`;
            personaContext += ` ALWAYS use this exact name when referring to the artist. NEVER invent a different name.`;
        }
        if (brandDesc) personaContext += `\nBrand: ${brandDesc}`;
        if (genre) personaContext += `\nGenre: ${genre}`;

        const systemPrompt = `You are indii, a creative assistant for independent music artists and creators.${personaContext}

Be direct, creative, and helpful. You are in direct chat mode — respond conversationally without using any tools or complex orchestration.
If the user asks you to do something that requires tools (like generating images, searching files, or managing projects), suggest they switch to Agent mode for that task.`;

        // Build chat history for multi-turn context (last 20 messages)
        const recentHistory = agentHistory
            .filter(m => m.role === 'user' || m.role === 'model')
            .slice(-20)
            .map(m => ({
                role: m.role as 'user' | 'model',
                parts: [{ text: m.text }]
            }));

        // Build the prompt contents: history + current message
        const contents = [
            ...recentHistory,
            { role: 'user' as const, parts: [{ text }] }
        ];

        // Handle image attachments inline
        if (attachments && attachments.length > 0) {
            const lastContent = contents[contents.length - 1];
            for (const att of attachments) {
                lastContent.parts.push({
                    inlineData: { mimeType: att.mimeType, data: att.base64 }
                } as any);
            }
        }

        try {
            const { stream } = await firebaseAI.generateContentStream(
                contents,
                AI_MODELS.TEXT.FAST,
                undefined,
                systemPrompt
            );

            // Consume the ReadableStream and stream tokens to UI
            const reader = stream.getReader();
            let accumulatedText = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkText = typeof value.text === 'function' ? value.text() : '';
                    if (chunkText) {
                        accumulatedText += chunkText;
                        updateAgentMessage(responseId, { text: accumulatedText });
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // Final update
            updateAgentMessage(responseId, {
                text: accumulatedText || 'No response generated.',
                thoughts: [{
                    id: crypto.randomUUID(),
                    text: 'Direct Chat (Fast Path)',
                    timestamp: Date.now(),
                    type: 'logic',
                    toolName: 'Direct LLM'
                }]
            });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            updateAgentMessage(responseId, {
                text: `Chat Error: ${errorMessage}`,
                thoughts: [{
                    id: crypto.randomUUID(),
                    text: 'Direct chat failed',
                    timestamp: Date.now(),
                    type: 'error'
                }]
            });
            throw err;
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
    async runAgent(agentId: string, task: string, parentContext?: AgentContext, parentTraceId?: string, attachments?: { mimeType: string; base64: string }[]): Promise<{ text: string; thoughtSignature?: string }> {
        // CRITICAL: Deep clone context to prevent mutation affecting parent agent
        let context: AgentContext;

        if (parentContext) {
            // Deep clone to isolate execution contexts
            try {
                context = structuredClone(parentContext);
            } catch (e) {
                context = { ...parentContext };
            }

            // Ensure Living Context is present
            if (!context.livingContext) {
                const { auth } = await import('@/services/firebase');
                if (auth.currentUser) {
                    const { livingFileService } = await import('./living/LivingFileService');
                    context.livingContext = await livingFileService.injectContext(auth.currentUser.uid);
                }
            }

            // Phase 3: Semantic Retrieval Integration
            const projectId = context.projectId || (await import('@/core/store')).useStore.getState().currentProjectId;
            if (projectId && !context.memoryContext) {
                try {
                    console.log(`[AgentService] Searching for relevant memories for task: "${task.substring(0, 50)}..."`);
                    const memories = await memoryService.recallMemories(projectId, task, 5);
                    if (memories && memories.length > 0) {
                        context.relevantMemories = memories.map((m: any) => m.content);
                        context.memoryContext = memories
                            .map((m: any) => `- [${new Date(m.timestamp).toLocaleDateString()}] (${m.type}): ${m.content}`)
                            .join('\n');
                        console.log(`[AgentService] Injected ${memories.length} memories into context.`);
                    }
                } catch (e) {
                    console.warn('[AgentService] Semantic retrieval failed (non-blocking):', e);
                }
            }

            // Restore non-serializable properties
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

    private async addSystemMessage(text: string): Promise<void> {
        const { useStore } = await import('@/core/store');
        useStore.getState().addAgentMessage({ id: uuidv4(), role: 'system', text, timestamp: Date.now() });
    }

    /**
     * Redacts sensitive information from the input text before sending it to the LLM.
     */
    private redactPII(text: string): string {
        const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
        const passwordRegex = /(password(?:\s+is)?[:\s=]+)([^\s.,;!]+)/gi;

        let redacted = text.replace(creditCardRegex, (match) => {
            if (match.replace(/\D/g, '').length < 13) return match;
            return '[REDACTED_CREDIT_CARD]';
        });

        redacted = redacted.replace(passwordRegex, (match, prefix, _value) => {
            return `${prefix}[REDACTED_PASSWORD]`;
        });

        return redacted;
    }
}

export const agentService = new AgentService();
