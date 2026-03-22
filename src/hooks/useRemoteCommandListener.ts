/**
 * useRemoteCommandListener — Desktop-side hook.
 *
 * Polls the Vite relay for commands sent from the phone,
 * processes them through the real agentService (full auth, full agent pipeline),
 * and posts responses back to the relay for the phone to pick up.
 *
 * This hook should be mounted ONCE in the desktop app (e.g., in App.tsx or the Shell).
 * It only activates in dev mode when the relay is available.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { logger } from '@/utils/logger';

const POLL_INTERVAL = 1500; // Check for new commands every 1.5s
const BASE_URL = ''; // Same origin — Vite middleware

export function useRemoteCommandListener() {
    const lastPollTime = useRef(0);
    const isProcessing = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();

    // Read desktop state to push to phone
    const { currentModule, isAgentProcessing, isGenerating, agentHistory } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
            isGenerating: state.isGenerating,
            agentHistory: state.agentHistory,
        }))
    );

    // Push desktop state to relay periodically
    useEffect(() => {
        const pushState = async () => {
            try {
                // Get the last 5 agent messages for the phone to see
                const recentMessages = agentHistory.slice(-5).map(m => ({
                    id: m.id,
                    role: m.role,
                    text: m.text?.slice(0, 500), // Truncate for network efficiency
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
                // Non-critical — relay may not be running (production build)
            }
        };

        const stateInterval = setInterval(pushState, 3000);
        pushState(); // Initial push
        return () => clearInterval(stateInterval);
    }, [currentModule, isAgentProcessing, isGenerating, agentHistory]);

    // Poll for commands from phone and process them
    useEffect(() => {
        const pollAndProcess = async () => {
            if (isProcessing.current) return;

            try {
                const res = await fetch(`${BASE_URL}/api/remote/poll?since=${lastPollTime.current}`);
                if (!res.ok) return;

                const data = await res.json();
                const commands = data.commands as Array<{ id: string; text: string; timestamp: number }>;
                if (!commands || commands.length === 0) return;

                // Update last poll time
                lastPollTime.current = Math.max(...commands.map(c => c.timestamp));

                // Process each command through the REAL agent pipeline
                for (const cmd of commands) {
                    isProcessing.current = true;
                    logger.info(`[RemoteRelay] 📱→🖥️ Processing phone command: "${cmd.text}"`);

                    // Post "thinking" status immediately
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
                        // Run through the FULL agent pipeline (with auth, context, orchestration)
                        // Tag as mobile-remote so messages are identifiable in history
                        await agentService.sendMessage(cmd.text, undefined, undefined, { source: 'mobile-remote' });

                        // After sendMessage completes, grab the latest agent response
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
                            logger.info(`[RemoteRelay] 🖥️→📱 Response sent (${lastResponse.text?.length} chars)`);
                        }
                    } catch (error) {
                        logger.error('[RemoteRelay] Command processing failed:', error);
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
                // Relay not available — silently skip (non-dev or relay not running)
            }
        };

        intervalRef.current = setInterval(pollAndProcess, POLL_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);
}
