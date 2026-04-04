/**
 * useRemoteCommandListener — Desktop-side hook (Firestore Cloud Relay).
 *
 * Uses Firestore onSnapshot to listen for commands from the phone in real-time.
 * When a command arrives:
 *   1. Marks it as 'processing'
 *   2. Runs it through agentService.sendMessage() (full auth, full pipeline)
 *   3. Writes the response back to Firestore
 *   4. Marks the command as 'completed'
 *
 * Also pushes desktop state to Firestore so the phone can see:
 *   - Current module
 *   - Whether the agent is processing
 *   - Online status
 *
 * Falls back to the Vite HTTP relay if auth is not available (dev mode).
 *
 * Mount ONCE in App.tsx.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { remoteRelayService, type RemoteCommand } from '@/services/agent/RemoteRelayService';
import { auth, db } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import type { ModuleId } from '@/core/constants';

/** Write relay diagnostics to Firestore (console is stripped in prod by terser) */
async function writeDiagnostic(stage: string, details?: Record<string, unknown>) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        await setDoc(doc(db, 'users', uid, 'remote-relay', 'diagnostics'), {
            stage,
            timestamp: serverTimestamp(),
            uid: uid.substring(0, 8),
            ...details,
        }, { merge: true });
    } catch {
        // Silent — diagnostics should never crash the app
    }
}

// ---------------------------------------------------------------------------
// Vite HTTP Relay Fallback (for dev mode without auth)
// ---------------------------------------------------------------------------
const POLL_INTERVAL = 1500;
const BASE_URL = '';

function useHttpRelayFallback(enabled: boolean) {
    const lastPollTime = useRef(0);
    const isProcessing = useRef(false);

    const { currentModule, isAgentProcessing, isGenerating, agentHistory } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
            isGenerating: state.isGenerating,
            agentHistory: state.agentHistory,
        }))
    );

    // Push state via HTTP
    useEffect(() => {
        if (!enabled) return;
        let active = true;

        const pushState = async () => {
            try {
                const recentMessages = agentHistory.slice(-5).map(m => ({
                    id: m.id,
                    role: m.role,
                    text: m.text?.slice(0, 500),
                    timestamp: m.timestamp,
                    agentId: m.agentId,
                }));

                await fetch(`${BASE_URL}/api/remote/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentModule,
                        isAgentProcessing,
                        isGenerating,
                        recentMessages,
                        timestamp: Date.now(),
                    }),
                });
            } catch {
                // Non-critical
            }
        };

        const loop = async () => {
            pushState();
            while (active) {
                await delay(3000);
                if (active) pushState();
            }
        };
        loop();

        return () => { active = false; };
    }, [enabled, currentModule, isAgentProcessing, isGenerating, agentHistory]);

    // Poll for commands via HTTP
    useEffect(() => {
        if (!enabled) return;

        const pollAndProcess = async () => {
            if (isProcessing.current) return;

            try {
                const res = await fetch(`${BASE_URL}/api/remote/poll?since=${lastPollTime.current}`);
                if (!res.ok) return;

                const data = await res.json();
                const commands = data.commands as Array<{ id: string; text: string; timestamp: number }>;
                if (!commands || commands.length === 0) return;

                lastPollTime.current = Math.max(...commands.map(c => c.timestamp));

                for (const cmd of commands) {
                    isProcessing.current = true;
                    logger.info(`[RemoteRelay/HTTP] 📱→🖥️ Processing: "${cmd.text}"`);

                    await fetch(`${BASE_URL}/api/remote/respond`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            commandId: cmd.id,
                            text: '⏳ Processing...',
                            role: 'model',
                            isStreaming: true,
                        }),
                    });

                    try {
                        await agentService.sendMessage(cmd.text, undefined, undefined, { source: 'mobile-remote' });

                        const state = useStore.getState();
                        const lastResponse = state.agentHistory
                            .filter(m => m.role === 'model' && m.text)
                            .slice(-1)[0];

                        if (lastResponse) {
                            await fetch(`${BASE_URL}/api/remote/respond`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    commandId: cmd.id,
                                    text: lastResponse.text,
                                    role: 'model',
                                    isStreaming: false,
                                    agentId: lastResponse.agentId,
                                }),
                            });
                        }
                    } catch (error: unknown) {
                        logger.error('[RemoteRelay/HTTP] Failed:', error);
                        await fetch(`${BASE_URL}/api/remote/respond`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                commandId: cmd.id,
                                text: `❌ Error: ${error instanceof Error ? error.message : 'Processing failed'}`,
                                role: 'model',
                                isStreaming: false,
                            }),
                        });
                    } finally {
                        isProcessing.current = false;
                    }
                }
            } catch {
                // Relay not available
            }
        };

        let active = true;
        const loop = async () => {
            while (active) {
                await pollAndProcess();
                await delay(POLL_INTERVAL);
            }
        };
        loop();

        return () => { active = false; };
    }, [enabled]);
}

// ---------------------------------------------------------------------------
// Firestore Cloud Relay (primary)
// ---------------------------------------------------------------------------
function useFirestoreRelay(enabled: boolean) {
    const isProcessing = useRef(false);

    // Diagnostic: log every enabled transition
    useEffect(() => {
        logger.info(`[RemoteRelay/Firestore] ⚡ Hook enabled state: ${enabled}`);
        writeDiagnostic('hook_enabled_changed', { enabled });
    }, [enabled]);

    const { currentModule, isAgentProcessing, activeSessionId } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
            activeSessionId: state.activeSessionId,
        }))
    );

    // Push desktop state to Firestore
    useEffect(() => {
        if (!enabled) return;
        let active = true;

        const pushState = async () => {
            try {
                await remoteRelayService.pushDesktopState({
                    currentModule: currentModule || 'dashboard',
                    isAgentProcessing,
                    activeSessionId: activeSessionId || '',
                    online: true,
                });
            } catch (error: unknown) {
                logger.warn('[RemoteRelay/Firestore] State push failed:', error);
            }
        };

        const loop = async () => {
            pushState();
            while (active) {
                await delay(5000);
                if (active) pushState();
            }
        };
        loop();

        // Mark offline on unmount
        return () => {
            active = false;
            remoteRelayService.pushDesktopState({
                currentModule: currentModule || 'dashboard',
                isAgentProcessing: false,
                activeSessionId: activeSessionId || '',
                online: false,
            }).catch(() => { });
        };
    }, [enabled, currentModule, isAgentProcessing, activeSessionId]);

    // Listen for commands from phone
    useEffect(() => {
        logger.info(`[RemoteRelay/Firestore] 🔍 Command listener effect triggered, enabled=${enabled}`);
        if (!enabled) {
            logger.info('[RemoteRelay/Firestore] ⏸️ Not enabled — skipping command listener');
            writeDiagnostic('listener_skipped', { reason: 'not_enabled' });
            return;
        }

        // Reset processing flag on each mount — prevents stale lock from previous session
        isProcessing.current = false;

        logger.info('[RemoteRelay/Firestore] 🚀 Registering command listener NOW...');
        writeDiagnostic('listener_registering', { enabled: true });

        // Safety timeout ref: auto-reset isProcessing after 2 min if agent hangs
        let processingTimeout: ReturnType<typeof setTimeout> | null = null;

        const unsubscribe = remoteRelayService.onCommand(async (command: RemoteCommand & { id: string }) => {
            if (isProcessing.current) {
                writeDiagnostic('command_skipped_busy', { commandId: command.id });
                return;
            }
            isProcessing.current = true;

            // Safety: auto-unlock after 2 minutes so one stuck command can't block the relay forever
            processingTimeout = setTimeout(() => {
                if (isProcessing.current) {
                    isProcessing.current = false;
                    writeDiagnostic('processing_timeout_reset', { commandId: command.id });
                }
            }, 120_000);

            // When phone sends "auto" (no targetAgentId), route through the generalist orchestrator
            // NOT whatever agent the desktop session happened to be using last.
            // When phone explicitly picks an agent (brand, road-manager, etc.), use that directly.
            const targetAgent = command.targetAgentId || 'generalist';
            logger.info(`[RemoteRelay/Firestore] 📱→🖥️ Processing: "${command.text}" → agent: ${targetAgent || 'auto'}`);
            writeDiagnostic('command_received', { commandId: command.id, text: command.text?.substring(0, 50), agent: targetAgent || 'auto' });
            try {
                // Mark as processing
                await remoteRelayService.markCommandProcessing(command.id);

                // ─── Image Generation Route ──────────────────────────────
                if (command.text.startsWith('[GENERATE_IMAGE]')) {
                    const imagePrompt = command.text.replace('[GENERATE_IMAGE]', '').trim();
                    const aspectRatio = (command.metadata?.aspectRatio as string) || '1:1';

                    logger.info(`[RemoteRelay/Firestore] 🎨 Image generation: "${imagePrompt}" (${aspectRatio})`);
                    writeDiagnostic('image_generation_started', { prompt: imagePrompt.substring(0, 50), aspectRatio });

                    // Send progress indicator
                    await remoteRelayService.sendResponse(
                        command.id,
                        '🎨 Generating image on desktop…',
                        undefined,
                        true
                    );

                    // Call ImageGenerationService directly
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                    const results = await ImageGeneration.generateImages({
                        prompt: imagePrompt,
                        aspectRatio,
                        count: 1,
                        model: 'pro',
                    });

                    if (results.length > 0) {
                        const imageUrls = results.map(r => r.url);
                        await remoteRelayService.sendResponse(
                            command.id,
                            `✅ Generated ${results.length} image${results.length > 1 ? 's' : ''}.`,
                            'creative-director',
                            false,
                            imageUrls
                        );
                        writeDiagnostic('image_generation_done', { count: results.length });
                    } else {
                        await remoteRelayService.sendResponse(
                            command.id,
                            'ERROR: Image generation returned no results. Try a different prompt.',
                            undefined,
                            false
                        );
                    }

                    await remoteRelayService.markCommandCompleted(command.id);
                    isProcessing.current = false;
                    return;
                }

                // ─── Navigation Route ──────────────────────────────
                if (command.text.startsWith('[NAVIGATE]')) {
                    const targetModule = command.text.replace('[NAVIGATE]', '').trim();
                    logger.info(`[RemoteRelay/Firestore] 🧭 Navigate to: "${targetModule}"`);
                    writeDiagnostic('navigation_started', { module: targetModule });

                    useStore.getState().setModule(targetModule as import('@/core/constants').ModuleId);

                    await remoteRelayService.sendResponse(
                        command.id,
                        `🧭 Navigated to ${targetModule}`,
                        undefined,
                        false
                    );

                    await remoteRelayService.markCommandCompleted(command.id);
                    isProcessing.current = false;
                    return;
                }

                // ─── Agent Action Route ──────────────────────────────
                if (command.text.startsWith('[AGENT_ACTION]')) {
                    const action = command.text.replace('[AGENT_ACTION]', '').trim();
                    logger.info(`[RemoteRelay/Firestore] 🤖 Agent Action: "${action}"`);
                    writeDiagnostic('agent_action_started', { action });

                    if (action === 'open_chat') {
                        // RightPanel only mounts at ≥768px — fall back to agent module on narrow viewports
                        const canMountPanel = typeof window !== 'undefined' && window.innerWidth >= 768;
                        if (canMountPanel) {
                            useStore.setState({
                                isRightPanelOpen: true,
                                rightPanelTab: 'agent',
                                rightPanelView: 'messages'
                            });
                        } else {
                            useStore.setState({ currentModule: 'agent' as import('@/core/constants').ModuleId });
                        }
                    }

                    await remoteRelayService.sendResponse(
                        command.id,
                        `⚡ Agent action executed: ${action}`,
                        undefined,
                        false
                    );

                    await remoteRelayService.markCommandCompleted(command.id);
                    isProcessing.current = false;
                    return;
                }

                // ─── Standard Agent Chat Route ───────────────────────────
                // Send "processing" indicator
                await remoteRelayService.sendResponse(
                    command.id,
                    '⏳ Processing...',
                    undefined,
                    true
                );
                writeDiagnostic('chat_processing_sent', { commandId: command.id });

                // Pre-check: is the agent service available?
                const agentBusy = (agentService as unknown as { isProcessing: boolean }).isProcessing;
                if (agentBusy) {
                    writeDiagnostic('agent_busy_reset', { commandId: command.id });
                    // Force-reset the agent's processing lock — it may be stale from a previous crash
                    (agentService as unknown as { isProcessing: boolean }).isProcessing = false;
                }

                // Run through the FULL agent pipeline with targeted agent
                const historyLengthBefore = useStore.getState().agentHistory.length;
                writeDiagnostic('agent_send_start', { commandId: command.id, historyLengthBefore, agent: targetAgent || 'auto' });

                try {
                    // Race the agent call against a 45s timeout
                    // If Gemini API or warmup hangs, we abort and tell the phone
                    let callTimeoutId: ReturnType<typeof setTimeout>;
                    const timeoutPromise = new Promise((_, reject) => {
                        callTimeoutId = setTimeout(() => reject(new Error('Agent call timed out after 45s')), 45_000);
                    });

                    await Promise.race([
                        agentService.sendMessage(command.text, undefined, targetAgent, { source: 'mobile-remote' }),
                        timeoutPromise
                    ]);
                    clearTimeout(callTimeoutId!);
                } catch (sendErr: unknown) {
                    writeDiagnostic('agent_send_error', { commandId: command.id, error: String(sendErr) });
                    // Send error response to phone so user isn't stuck forever
                    await remoteRelayService.sendResponse(
                        command.id,
                        `❌ ${sendErr instanceof Error ? sendErr.message : 'Agent call failed'}. Try again.`,
                        undefined,
                        false
                    );
                    await remoteRelayService.markCommandCompleted(command.id);
                    return; // Skip the response polling — we already sent an error
                }

                writeDiagnostic('agent_send_complete', { commandId: command.id, historyLengthAfter: useStore.getState().agentHistory.length });

                // Wait for a NEW response to appear (only entries AFTER our send)
                // Increased to 30 attempts × 1s = 30s max wait
                let lastResponse: { text?: string; agentId?: string } | undefined;
                for (let attempt = 0; attempt < 30; attempt++) {
                    const state = useStore.getState();
                    const newEntries = state.agentHistory.slice(historyLengthBefore);
                    const candidate = newEntries
                        .filter(m => m.role === 'model' && m.text && !m.isStreaming)
                        .slice(-1)[0];
                    if (candidate && candidate.text && candidate.text.length > 5) {
                        lastResponse = candidate;
                        break;
                    }
                    if (attempt === 10) {
                        writeDiagnostic('response_wait_slow', {
                            commandId: command.id,
                            newEntriesCount: newEntries.length,
                            totalHistory: state.agentHistory.length
                        });
                    }
                    await delay(1000);
                }

                if (lastResponse) {
                    await remoteRelayService.sendResponse(
                        command.id,
                        lastResponse.text || 'No response',
                        lastResponse.agentId,
                        false
                    );
                    logger.info(`[RemoteRelay/Firestore] 🖥️→📱 Response sent (${lastResponse.text?.length} chars)`);
                } else {
                    logger.warn('[RemoteRelay/Firestore] No response found in agentHistory after 10s');
                    await remoteRelayService.sendResponse(
                        command.id,
                        '⚠️ Agent processed but no response was captured. Please try again.',
                        undefined,
                        false
                    );
                }

                // Mark command as completed
                await remoteRelayService.markCommandCompleted(command.id);
            } catch (error: unknown) {
                logger.error('[RemoteRelay/Firestore] Command failed:', error);
                await remoteRelayService.sendResponse(
                    command.id,
                    `❌ Error: ${error instanceof Error ? error.message : 'Processing failed'}`,
                    undefined,
                    false
                );
                await remoteRelayService.markCommandCompleted(command.id);
            } finally {
                if (processingTimeout) clearTimeout(processingTimeout);
                isProcessing.current = false;
            }
        });

        return () => {
            unsubscribe();
            if (processingTimeout) clearTimeout(processingTimeout);
        };
    }, [enabled]);

    // Periodic cleanup of old relay data (every 30 min)
    useEffect(() => {
        if (!enabled) return;
        let active = true;

        const cleanup = () => remoteRelayService.cleanupOld(24).catch(() => { });

        const loop = async () => {
            cleanup();
            while (active) {
                await delay(30 * 60 * 1000);
                if (active) cleanup();
            }
        };
        loop();

        return () => { active = false; };
    }, [enabled]);
}

// ---------------------------------------------------------------------------
// Main Hook — auto-selects Firestore or HTTP based on auth
// ---------------------------------------------------------------------------
export function useRemoteCommandListener() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        logger.info('[RemoteRelay] 🔐 Setting up auth listener...');
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            logger.info(`[RemoteRelay] 🔐 Auth state changed: ${user ? 'SIGNED IN (' + user.uid.substring(0, 8) + ')' : 'SIGNED OUT'}`);
            setIsAuthenticated(!!user);
        });
        return unsubscribe;
    }, []);

    // Use Firestore relay when authenticated, HTTP fallback when not
    useFirestoreRelay(isAuthenticated);
    useHttpRelayFallback(!isAuthenticated);
}
