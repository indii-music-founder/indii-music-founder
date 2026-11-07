import { voiceService } from '@/services/intelligence/VoiceService';
import { resolveAgentVoice, stripMarkdownForSpeech } from '@/services/agent/AgentVoiceRegistry';
import { deterministicSpokenIntentFallback, judgeSpokenConversationIntent } from '@/config/liveConversationJudgments';
import { logger } from '@/utils/logger';

interface QueuedSpeechItem {
    agentId: string;
    text: string;
    messageId?: string;
}

export interface LiveConversationStartOptions {
    /** Target agent ID override if starting directly for a specific agent */
    targetAgentId?: string;
    /** Originating client surface */
    source?: 'desktop' | 'mobile-remote';
    /** Optional custom turn sender (e.g., Mobile Remote relay). Defaults to desktop AgentService. */
    onCommitTurn?: (text: string) => Promise<void> | void;
    /** Optional callback for live transcript updates (defaults to updating commandBarInput). */
    onLiveTranscript?: (text: string) => void;
    /** Optional error callback for microphone issues. */
    onError?: (error: unknown) => void;
}

const SILENCE_COMMIT_MS = 1400;

export class LiveConversationService {
    private active = false;
    private speechQueue: QueuedSpeechItem[] = [];
    private isDrainingSpeech = false;
    private silenceTimer: ReturnType<typeof setTimeout> | null = null;
    private latestFinalText = '';
    private latestInterimText = '';
    private options: LiveConversationStartOptions = {};
    private dictationHandlers: Parameters<typeof voiceService.startDictation>[0] | null = null;

    private async getStoreState() {
        const { useStore } = await import('@/core/store');
        return typeof useStore?.getState === 'function' ? useStore.getState() : null;
    }

    isActive(): boolean {
        return this.active;
    }

    async toggleSession(options: LiveConversationStartOptions = {}): Promise<boolean> {
        if (this.active) {
            await this.stopSession();
            return false;
        }
        return this.startSession(options);
    }

    async startSession(options: LiveConversationStartOptions = {}): Promise<boolean> {
        if (!voiceService.isSupported()) {
            options.onError?.(new Error('Speech recognition is not supported in this browser.'));
            return false;
        }

        this.options = options;
        this.active = true;
        this.speechQueue = [];
        this.clearSilenceTimer();
        voiceService.stopSpeaking();

        const state = await this.getStoreState();
        state?.setLiveConversationActive?.(true);
        state?.setLiveConversationPhase?.('listening');
        state?.setActiveSpeakingAgentId?.(null);

        const started = this.openListeningTurn();
        if (!started) {
            this.active = false;
            state?.setLiveConversationActive?.(false);
            state?.setLiveConversationPhase?.('idle');
            return false;
        }
        return true;
    }

    async stopSession(): Promise<void> {
        this.active = false;
        this.clearSilenceTimer();
        this.speechQueue = [];
        this.latestFinalText = '';
        this.latestInterimText = '';

        if (this.dictationHandlers) {
            voiceService.stopDictationIfOwner(this.dictationHandlers);
            this.dictationHandlers = null;
        } else {
            voiceService.stopDictation();
        }
        voiceService.stopSpeaking();

        const state = await this.getStoreState();
        state?.setLiveConversationActive?.(false);
        state?.setLiveConversationPhase?.('idle');
        state?.setActiveSpeakingAgentId?.(null);
    }

    /**
     * Barge-in: interrupts agent speech immediately and switches back to listening,
     * or if currently listening with spoken words, commits the turn immediately.
     */
    async handlePrimaryAction(): Promise<void> {
        if (!this.active) {
            await this.startSession(this.options);
            return;
        }

        const state = await this.getStoreState();
        const phase = state?.liveConversationPhase ?? 'listening';

        if (phase === 'speaking') {
            // Barge-in: silence current speaker and listen to user immediately
            this.speechQueue = [];
            voiceService.stopSpeaking();
            state?.setActiveSpeakingAgentId?.(null);
            state?.setLiveConversationPhase?.('listening');
            this.openListeningTurn();
            return;
        }

        const pendingSpoken = [this.latestFinalText.trim(), this.latestInterimText.trim()].filter(Boolean).join(' ');
        if (phase === 'listening' && pendingSpoken.length > 0) {
            await this.commitUserTurn(pendingSpoken);
            return;
        }

        // Otherwise, clicking the active conversation button ends the two-way session
        await this.stopSession();
    }

    private openListeningTurn(): boolean {
        if (!this.active) return false;
        this.clearSilenceTimer();
        this.latestFinalText = '';
        this.latestInterimText = '';

        const handlers: Parameters<typeof voiceService.startDictation>[0] = {
            onFinal: (finalText: string) => {
                if (!this.active) return;
                this.latestFinalText = finalText;
                const combined = [finalText.trim(), this.latestInterimText.trim()].filter(Boolean).join(' ');
                this.updateLiveInput(combined);
                if (combined.trim().length > 0) {
                    this.scheduleSilenceCommit();
                }
            },
            onInterim: (interimText: string) => {
                if (!this.active) return;
                this.latestInterimText = interimText;
                const combined = [this.latestFinalText.trim(), interimText.trim()].filter(Boolean).join(' ');
                this.updateLiveInput(combined);
                if (combined.trim().length > 0) {
                    this.scheduleSilenceCommit();
                }
            },
            onEnd: () => {
                if (!this.active) return;
                const combined = [this.latestFinalText.trim(), this.latestInterimText.trim()].filter(Boolean).join(' ');
                if (combined.length > 0) {
                    void this.commitUserTurn(combined);
                } else {
                    // Engine timed out on silence while session is still active: reopen mic if still in listening phase
                    void this.getStoreState().then(st => {
                        if (this.active && st?.liveConversationPhase === 'listening') {
                            this.openListeningTurn();
                        }
                    });
                }
            },
            onSuperseded: () => {
                // Another surface took over the shared recognition instance
                void this.stopSession();
            },
            onError: (error: unknown) => {
                logger.warn('[LiveConversationService] Recognition error:', error);
                this.options.onError?.(error);
            },
        };

        this.dictationHandlers = handlers;
        return voiceService.startDictation(handlers);
    }

    private updateLiveInput(text: string): void {
        if (this.options.onLiveTranscript) {
            this.options.onLiveTranscript(text);
            return;
        }
        void this.getStoreState().then(state => {
            state?.setCommandBarInput?.(text);
        });
    }

    private clearSilenceTimer(): void {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    private scheduleSilenceCommit(): void {
        this.clearSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            const combined = [this.latestFinalText.trim(), this.latestInterimText.trim()].filter(Boolean).join(' ');
            if (this.active && combined.length > 0) {
                void this.commitUserTurn(combined);
            }
        }, SILENCE_COMMIT_MS);
    }

    private async commitUserTurn(spokenText: string): Promise<void> {
        this.clearSilenceTimer();
        this.latestFinalText = '';
        this.latestInterimText = '';

        if (this.dictationHandlers) {
            voiceService.stopDictationIfOwner(this.dictationHandlers);
            this.dictationHandlers = null;
        }

        const cleanTurn = spokenText.trim();
        if (!cleanTurn || !this.active) return;

        // Check for immediate spoken barge-in / stop intent via Jev System One / fallback
        const intent = deterministicSpokenIntentFallback(cleanTurn);
        if (intent.action === 'barge_in_stop') {
            this.speechQueue = [];
            voiceService.stopSpeaking();
            this.updateLiveInput('');
            const st = await this.getStoreState();
            st?.setActiveSpeakingAgentId?.(null);
            st?.setLiveConversationPhase?.('listening');
            this.openListeningTurn();
            return;
        }

        const state = await this.getStoreState();
        state?.setLiveConversationPhase?.('thinking');
        this.updateLiveInput('');

        try {
            if (this.options.onCommitTurn) {
                await this.options.onCommitTurn(cleanTurn);
                return;
            }

            // Run Jev System One semantic intent evaluation with speculative routing
            let judgedTargetSpecialist: string | undefined = undefined;
            try {
                const currentAgentId = this.options.targetAgentId || state?.directTargetAgentId || state?.activeDepartmentId || 'generalist';
                const verdict = await judgeSpokenConversationIntent(cleanTurn, currentAgentId);
                if (verdict.action === 'barge_in_stop') {
                    this.speechQueue = [];
                    voiceService.stopSpeaking();
                    this.updateLiveInput('');
                    state?.setActiveSpeakingAgentId?.(null);
                    state?.setLiveConversationPhase?.('listening');
                    this.openListeningTurn();
                    return;
                }
                if (verdict.targetAgentId) {
                    judgedTargetSpecialist = verdict.targetAgentId;
                }
            } catch (judgeErr) {
                logger.debug?.('[LiveConversationService] Intent judgment bypassed:', judgeErr);
            }

            await this.dispatchDesktopTurn(cleanTurn, judgedTargetSpecialist);
        } catch (err) {
            logger.error('[LiveConversationService] Failed to dispatch turn:', err);
            if (this.active) {
                state?.setLiveConversationPhase?.('listening');
                this.openListeningTurn();
            }
        }
    }

    private async dispatchDesktopTurn(text: string, targetSpecialistOverride?: string): Promise<void> {
        const state = await this.getStoreState();
        const { agentService } = await import('@/services/agent/AgentService');
        const { agentRegistry } = await import('@/services/agent/registry');

        const currentAttachments = [...(state?.commandBarAttachments || [])];
        state?.setCommandBarAttachments?.([]);

        const processedAttachments = await Promise.all(
            currentAttachments.map(file =>
                new Promise<{ mimeType: string; base64: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        mimeType: file.type,
                        base64: (reader.result as string).split(',')[1]!,
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                })
            )
        );

        let outgoingAttachments = processedAttachments.length > 0 ? processedAttachments : undefined;
        try {
            if (state?.viewMode === 'editor') {
                const { canvasOps } = await import('@/modules/creative/services/CanvasOperationsService');
                if (canvasOps.isInitialized() && canvasOps.hasContent()) {
                    const visual = await canvasOps.prepareVisualPrompt();
                    if (visual?.data) {
                        outgoingAttachments = [
                            ...(outgoingAttachments || []),
                            { mimeType: visual.mimeType, base64: visual.data },
                        ];
                    }
                }
            }
        } catch (visErr) {
            logger.warn('[LiveConversationService] Could not attach canvas visual:', visErr);
        }

        const isIndiiMode = state?.chatChannel === 'indii';
        const currentModule = state?.currentModule || 'dashboard';
        const knownIds = agentRegistry.getAll().map(a => a.id);
        const fallbackTarget = isIndiiMode ? undefined : (knownIds.includes(currentModule) ? currentModule : undefined);
        const targetAgentId = targetSpecialistOverride || this.options.targetAgentId || fallbackTarget;

        await agentService.sendMessage(text, outgoingAttachments, targetAgentId, { source: 'desktop' });
    }

    /**
     * Called by AgentService (or MobileRemote AgentChat) whenever an agent completes a response.
     * Enqueues the agent's spoken reply in their assigned voice and resumes listening afterwards.
     */
    async notifyAgentResponse(agentId: string, rawText: string, messageId?: string): Promise<void> {
        if (!this.active) return;
        const speakable = stripMarkdownForSpeech(rawText);
        if (!speakable) {
            if (!this.isDrainingSpeech && this.speechQueue.length === 0) {
                const state = await this.getStoreState();
                if (this.active) {
                    state?.setLiveConversationPhase?.('listening');
                    this.openListeningTurn();
                }
            }
            return;
        }

        this.speechQueue.push({ agentId: agentId || 'generalist', text: speakable, messageId });
        await this.drainSpeechQueue();
    }

    private async drainSpeechQueue(): Promise<void> {
        if (this.isDrainingSpeech) return;
        this.isDrainingSpeech = true;

        try {
            while (this.active && this.speechQueue.length > 0) {
                const next = this.speechQueue.shift()!;
                const state = await this.getStoreState();
                state?.setActiveSpeakingAgentId?.(next.agentId);
                state?.setLiveConversationPhase?.('speaking');

                const voice = resolveAgentVoice(next.agentId, state?.agentVoiceOverrides);
                try {
                    await voiceService.speak(next.text, voice);
                } catch (err) {
                    logger.warn(`[LiveConversationService] Speech playback interrupted/failed for ${next.agentId}:`, err);
                }
            }
        } finally {
            this.isDrainingSpeech = false;
            const state = await this.getStoreState();
            if (this.active) {
                state?.setActiveSpeakingAgentId?.(null);
                state?.setLiveConversationPhase?.('listening');
                this.openListeningTurn();
            } else {
                state?.setActiveSpeakingAgentId?.(null);
                state?.setLiveConversationPhase?.('idle');
            }
        }
    }
}

export const liveConversationService = new LiveConversationService();
