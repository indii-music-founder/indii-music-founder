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
import { auth } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logger } from '@/utils/logger';

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

        const interval = setInterval(pushState, 3000);
        pushState();
        return () => clearInterval(interval);
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
                    } catch (error) {
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

        const interval = setInterval(pollAndProcess, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [enabled]);
}

// ---------------------------------------------------------------------------
// Firestore Cloud Relay (primary)
// ---------------------------------------------------------------------------
function useFirestoreRelay(enabled: boolean) {
    const isProcessing = useRef(false);

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

        const pushState = async () => {
            try {
                await remoteRelayService.pushDesktopState({
                    currentModule: currentModule || 'dashboard',
                    isAgentProcessing,
                    activeSessionId: activeSessionId || '',
                    online: true,
                });
            } catch (error) {
                logger.warn('[RemoteRelay/Firestore] State push failed:', error);
            }
        };

        pushState();
        const interval = setInterval(pushState, 5000);

        // Mark offline on unmount
        return () => {
            clearInterval(interval);
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
        if (!enabled) return;

        const unsubscribe = remoteRelayService.onCommand(async (command: RemoteCommand & { id: string }) => {
            if (isProcessing.current) return;
            isProcessing.current = true;

            const targetAgent = command.targetAgentId || undefined;
            logger.info(`[RemoteRelay/Firestore] 📱→🖥️ Processing: "${command.text}" → agent: ${targetAgent || 'auto'}`);

            try {
                // Mark as processing
                await remoteRelayService.markCommandProcessing(command.id);

                // Send "processing" indicator
                await remoteRelayService.sendResponse(
                    command.id,
                    '⏳ Processing...',
                    undefined,
                    true
                );

                // Run through the FULL agent pipeline with targeted agent
                await agentService.sendMessage(command.text, undefined, targetAgent, { source: 'mobile-remote' });

                // Grab the latest agent response
                const state = useStore.getState();
                const lastResponse = state.agentHistory
                    .filter(m => m.role === 'model' && m.text)
                    .slice(-1)[0];

                if (lastResponse) {
                    await remoteRelayService.sendResponse(
                        command.id,
                        lastResponse.text || 'No response',
                        lastResponse.agentId,
                        false
                    );
                    logger.info(`[RemoteRelay/Firestore] 🖥️→📱 Response sent (${lastResponse.text?.length} chars)`);
                }

                // Mark command as completed
                await remoteRelayService.markCommandCompleted(command.id);
            } catch (error) {
                logger.error('[RemoteRelay/Firestore] Command failed:', error);
                await remoteRelayService.sendResponse(
                    command.id,
                    `❌ Error: ${error instanceof Error ? error.message : 'Processing failed'}`,
                    undefined,
                    false
                );
                await remoteRelayService.markCommandCompleted(command.id);
            } finally {
                isProcessing.current = false;
            }
        });

        return unsubscribe;
    }, [enabled]);

    // Periodic cleanup of old relay data (every 30 min)
    useEffect(() => {
        if (!enabled) return;

        const cleanup = () => remoteRelayService.cleanupOld(24).catch(() => { });
        cleanup();
        const interval = setInterval(cleanup, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [enabled]);
}

// ---------------------------------------------------------------------------
// Main Hook — auto-selects Firestore or HTTP based on auth
// ---------------------------------------------------------------------------
export function useRemoteCommandListener() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
        });
        return unsubscribe;
    }, []);

    // Use Firestore relay when authenticated, HTTP fallback when not
    useFirestoreRelay(isAuthenticated);
    useHttpRelayFallback(!isAuthenticated);
}
