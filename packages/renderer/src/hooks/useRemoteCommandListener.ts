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
 * Requires Firebase Auth — the Firestore relay only activates when authenticated.
 * A Vite HTTP relay fallback exists (useHttpRelayFallback) but is currently disabled.
 *
 * Mount ONCE in App.tsx.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { entryCommandService } from '@/services/commands/EntryCommandService';
import { remoteRelayService, type RemoteCommand } from '@/services/agent/RemoteRelayService';
import { auth, db } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { getRealAuthenticatedUserId, isAnonymousOrDemoUser } from '@/utils/authGuards';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';

/** Write relay diagnostics to Firestore (console is stripped in prod by terser) */
async function writeDiagnostic(stage: string, details?: Record<string, unknown>) {
    const uid = getRealAuthenticatedUserId(auth.currentUser);
    if (!uid) return;
    
    // Skip diagnostics in E2E tests to prevent Firestore invalid segment errors
    // when project ID is mocked/missing
    if (isFirebaseE2EMockEnabled()) {
        return;
    }

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

function findLatestRemoteAgentResponse(startedAt: number): AgentMessage | undefined {
    const state = useStore.getState();
    const messages = state.conversationMode === 'boardroom'
        ? state.boardroomMessages
        : state.agentHistory;

    return [...messages]
        .reverse()
        .find(message =>
            message.role === 'model' &&
            Boolean(message.text?.trim()) &&
            message.timestamp >= startedAt &&
            !message.isStreaming
        );
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
        if (!enabled) return;
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
    const currentModuleRef = useRef(currentModule);
    const isAgentProcessingRef = useRef(isAgentProcessing);
    const activeSessionIdRef = useRef(activeSessionId);

    useEffect(() => {
        currentModuleRef.current = currentModule;
        isAgentProcessingRef.current = isAgentProcessing;
        activeSessionIdRef.current = activeSessionId;
    }, [currentModule, isAgentProcessing, activeSessionId]);

    // 1. Loop effect - runs every 5 seconds while enabled
    useEffect(() => {
        if (!enabled) return;
        let active = true;

        const pushState = async () => {
            try {
                await remoteRelayService.pushDesktopState({
                    currentModule: currentModuleRef.current || 'dashboard',
                    isAgentProcessing: isAgentProcessingRef.current,
                    activeSessionId: activeSessionIdRef.current || '',
                    online: true,
                });
            } catch (error: unknown) {
                logger.warn('[RemoteRelay/Firestore] Loop state push failed:', error);
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

        return () => {
            active = false;
            remoteRelayService.pushDesktopState({
                currentModule: currentModuleRef.current || 'dashboard',
                isAgentProcessing: false,
                activeSessionId: activeSessionIdRef.current || '',
                online: false,
            }).catch(() => { });
        };
    }, [enabled]);

    // 2. Immediate push effect - pushes immediately on state change, but never writes online: false
    useEffect(() => {
        if (!enabled) return;

        const pushStateImmediate = async () => {
            try {
                await remoteRelayService.pushDesktopState({
                    currentModule: currentModule || 'dashboard',
                    isAgentProcessing,
                    activeSessionId: activeSessionId || '',
                    online: true,
                });
            } catch (error: unknown) {
                logger.warn('[RemoteRelay/Firestore] Immediate state push failed:', error);
            }
        };

        pushStateImmediate();
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

        // ─── DESKTOP & CLOUD: ATOMIC FIRST-WINS CLAIM ─────────────────────
        // Both desktop and cloud try to process commands. The first one to flip
        // pending → processing wins via atomicity. This ensures:
        // - Desktop claims first if online (fast, free when you're home)
        // - Cloud claims if desktop doesn't claim fast (needed when away, requires
        //   Blaze billing)
        // - No double-spend: exactly one processor per command


        const unsubscribe = remoteRelayService.onCommand(async (command: RemoteCommand & { id: string }) => {
            if (!command.text) {
                logger.info(`[RemoteRelay/Firestore] ⏭️ Ignoring empty command ${command.id}`);
                return;
            }

            if (isProcessing.current) {
                writeDiagnostic('command_skipped_busy', { commandId: command.id });
                return;
            }

            // Atomic claim: try to flip pending → processing. First one wins.
            const uid = getRealAuthenticatedUserId(auth.currentUser);
            if (!uid) return;

            let claimed = false;
            try {
                claimed = await runTransaction(db, async (tx) => {
                    const cmdRef = doc(db, 'users', uid, 'remote-relay-commands', command.id);
                    const cmdSnap = await tx.get(cmdRef);
                    if (cmdSnap.exists() && cmdSnap.data()?.status === 'pending') {
                        tx.update(cmdRef, { status: 'processing' });
                        return true;
                    }
                    return false;
                });
            } catch (err) {
                logger.warn('[RemoteRelay] Atomic claim failed:', err);
                return;
            }

            if (!claimed) {
                writeDiagnostic('command_skipped_not_claimed', { commandId: command.id });
                logger.info(`[RemoteRelay/Firestore] ⏭️ Command ${command.id} already claimed`);
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

            logger.info(`[RemoteRelay/Firestore] 📱→🖥️ Processing command: "${command.text?.substring(0, 50)}"`);
            writeDiagnostic('command_received', { commandId: command.id, text: command.text?.substring(0, 50) });
            try {
                // ─── Standard Agent Chat Route ───────────────────────────
                if (!command.text.startsWith('[')) {
                    const startedAt = Date.now();
                    logger.info(`[RemoteRelay/Firestore] 💬 Agent chat: "${command.text.substring(0, 50)}"`);
                    writeDiagnostic('agent_chat_started', {
                        commandId: command.id,
                        targetAgentId: command.targetAgentId || 'auto',
                    });

                    await remoteRelayService.sendResponse(
                        command.id,
                        'Processing in desktop studio…',
                        command.targetAgentId,
                        true
                    );

                    const commandResult = await entryCommandService.handleInput(command.text, {
                        source: 'mobile',
                        includeUserMessage: true,
                        remoteCommandId: command.id,
                    });
                    if (commandResult.handled) {
                        await remoteRelayService.sendResponse(
                            command.id,
                            commandResult.responseText || 'Workflow command handled.',
                            commandResult.agentId || command.targetAgentId || 'generalist',
                            false
                        );
                        await remoteRelayService.markCommandCompleted(command.id);
                        writeDiagnostic('entry_command_done', { commandId: command.id });
                        isProcessing.current = false;
                        return;
                    }

                    await agentService.sendMessage(
                        command.text,
                        undefined,
                        command.targetAgentId,
                        { source: 'mobile-remote' }
                    );

                    const response = findLatestRemoteAgentResponse(startedAt);
                    await remoteRelayService.sendResponse(
                        command.id,
                        response?.text?.trim() || 'Done.',
                        response?.agentId || command.targetAgentId || 'generalist',
                        false
                    );
                    await remoteRelayService.markCommandCompleted(command.id);
                    writeDiagnostic('agent_chat_done', { commandId: command.id });
                    isProcessing.current = false;
                    return;
                }

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
                            'creative',
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

                logger.warn(`[RemoteRelay/Firestore] ⚠️ Unhandled desktop-only command prefix: ${command.text?.substring(0, 30)}`);
                writeDiagnostic('command_unhandled_prefix', {
                    commandId: command.id,
                    text: command.text?.substring(0, 50),
                });
                await remoteRelayService.sendResponse(
                    command.id,
                    '⚠️ This action could not be handled on the desktop. Please try again.',
                    undefined,
                    false
                );
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
    const { user } = useStore(useShallow(state => ({ user: state.user })));
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        logger.info('[RemoteRelay] 🔐 Setting up auth listener...');
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            logger.info(`[RemoteRelay] 🔐 Auth state changed: ${user ? 'SIGNED IN (' + user.uid.substring(0, 8) + ')' : 'SIGNED OUT'}`);
            setIsAuthenticated(!isAnonymousOrDemoUser(user));
        });
        return unsubscribe;
    }, []);

    // Disable remote command listener completely for guest sessions or mock user to prevent
    // console permission errors and unneeded firestore polling.
    const isGuest = isAnonymousOrDemoUser(user);
    const shouldEnableRelay = isAuthenticated && !isGuest;

    // Use Firestore relay when authenticated.
    useFirestoreRelay(shouldEnableRelay);
    useHttpRelayFallback(false); // HTTP relay fallback disabled to prevent 404 spam in dev
}
