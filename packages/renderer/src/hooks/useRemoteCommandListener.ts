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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { entryCommandService } from '@/services/commands/EntryCommandService';
import { remoteRelayService, type RemoteCommand, type AgentDispatchTask } from '@/services/agent/RemoteRelayService';
import { parseRemoteCommand } from '@/hooks/remoteCommandSecurity';
import { auth, db } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { getRealAuthenticatedUserId, isAnonymousOrDemoUser } from '@/utils/authGuards';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import type { HistoryItem } from '@/core/types/history';

export function buildLiveMomentNote(noteText: string) {
    const content = noteText.trim();
    const firstLine = content.split(/\r?\n/).map(line => line.trim()).find(Boolean) || 'Live Moment';
    const title = firstLine.length > 56 ? `${firstLine.slice(0, 53)}...` : firstLine;

    return {
        title,
        content,
        attachments: [],
        tags: ['live-moment', 'mobile-remote'],
    };
}

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

/**
 * Pure decision logic for the `[SHOW]` ("show me") remote route.
 *
 * Extracted from the Firestore relay route so the branch logic can be exercised
 * deterministically without the live phone↔desktop round-trip. Given the
 * current `generatedHistory`, it resolves what the phone should receive:
 *   - happy path: the most-recent image artifact's thumbnail/full url + caption
 *   - empty state: an honest text-only fallback (no imageUrls)
 *
 * This must stay behaviorally identical to the inline route it replaced.
 */
export interface ShowMeResponse {
    text: string;
    agentId: string;
    imageUrls?: string[];
}

export function resolveShowMeResponse(history: HistoryItem[] | undefined): ShowMeResponse {
    const latestVisual = (history ?? []).find(item => item.type === 'image' && !!item.url);

    if (latestVisual) {
        return {
            text: latestVisual.prompt
                ? `🖼️ Here's the latest: "${latestVisual.prompt}"`
                : '🖼️ Here\'s the latest visual.',
            agentId: 'creative',
            imageUrls: [latestVisual.thumbnailUrl || latestVisual.url],
        };
    }

    // Honest empty state — never a silent no-op or a raw error.
    return {
        text: 'Nothing to show yet — generate or open an asset first, then say "show me".',
        agentId: 'creative',
    };
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

    // Track enabled ref to allow loop to see changes without re-triggering effect cleanup
    const enabledRef = useRef(enabled);
    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    // Diagnostic: log every enabled transition
    useEffect(() => {
        if (!enabled) return;
        logger.info(`[RemoteRelay/Firestore] ⚡ Hook enabled state: ${enabled}`);
        writeDiagnostic('hook_enabled_changed', { enabled });
    }, [enabled]);

    const { currentModule, isAgentProcessing, activeSessionId, isSleeping, setIsSleeping } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
            activeSessionId: state.activeSessionId,
            isSleeping: state.isSleeping,
            setIsSleeping: state.setIsSleeping,
        }))
    );

    // Push desktop state to Firestore
    const currentModuleRef = useRef(currentModule);
    const isAgentProcessingRef = useRef(isAgentProcessing);
    const activeSessionIdRef = useRef(activeSessionId);
    const isSleepingRef = useRef(isSleeping);

    useEffect(() => {
        currentModuleRef.current = currentModule;
        isAgentProcessingRef.current = isAgentProcessing;
        activeSessionIdRef.current = activeSessionId;
        isSleepingRef.current = isSleeping;
    }, [currentModule, isAgentProcessing, activeSessionId, isSleeping]);

    /**
     * Wake the desktop: show the window (Electron) and clear the sleep flag.
     * Safe no-op in the web/PWA build where electronAPI is undefined.
     * Used by both the explicit [WAKE] command and automatic wake-on-task.
     */
    const wakeDesktop = useCallback(() => {
        if (isSleepingRef.current) {
            setIsSleeping(false);
            isSleepingRef.current = false;
        }
        window.electronAPI?.window?.show?.().catch((err: unknown) => {
            logger.warn('[RemoteRelay] window.show failed during wake:', err);
        });
    }, [setIsSleeping]);

    // 1. Loop effect - runs every 5 seconds, mount-once to avoid unmount cleanup online:false flip-flops on navigation
    useEffect(() => {
        let active = true;

        const pushState = async () => {
            if (!enabledRef.current) return;
            try {
                await remoteRelayService.pushDesktopState({
                    currentModule: currentModuleRef.current || 'dashboard',
                    isAgentProcessing: isAgentProcessingRef.current,
                    activeSessionId: activeSessionIdRef.current || '',
                    online: true,
                    sleepMode: isSleepingRef.current,
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

        // Background tabs throttle the 5s loop to ~1/min, so the phone can briefly see a
        // stale heartbeat. Push immediately when the tab regains visibility so the phone
        // reconnects instantly instead of waiting for the next throttled tick.
        const onVisible = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                pushState();
            }
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisible);
        }

        return () => {
            active = false;
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisible);
            }
            remoteRelayService.pushDesktopState({
                currentModule: currentModuleRef.current || 'dashboard',
                isAgentProcessing: false,
                activeSessionId: activeSessionIdRef.current || '',
                online: false,
            }).catch((err: unknown) => {
                logger.warn('[RemoteRelay] Failed to push offline status during cleanup:', err);
            });
        };
    }, []);

    // 1b. Write online:false when enabled transitions to false
    useEffect(() => {
        if (!enabled) {
            remoteRelayService.pushDesktopState({
                currentModule: currentModuleRef.current || 'dashboard',
                isAgentProcessing: false,
                activeSessionId: activeSessionIdRef.current || '',
                online: false,
            }).catch((err: unknown) => {
                logger.warn('[RemoteRelay] Failed to push offline status during disable:', err);
            });
        }
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
                    sleepMode: isSleeping,
                });
            } catch (error: unknown) {
                logger.warn('[RemoteRelay/Firestore] Immediate state push failed:', error);
            }
        };

        pushStateImmediate();
    }, [enabled, currentModule, isAgentProcessing, activeSessionId, isSleeping]);

    const processSingleCommand = async (command: RemoteCommand & { id: string }) => {
        if (isProcessing.current) return;

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
        const processingTimeout = setTimeout(() => {
            if (isProcessing.current) {
                isProcessing.current = false;
                writeDiagnostic('processing_timeout_reset', { commandId: command.id });
                scanAndProcessPendingCommands();
            }
        }, 120_000);

        logger.info(`[RemoteRelay/Firestore] 📱→🖥️ Processing command: "${command.text?.substring(0, 50)}"`);
        writeDiagnostic('command_received', { commandId: command.id, text: command.text?.substring(0, 50) });
        try {
            const parsed = parseRemoteCommand(command.text);

            if (parsed.kind === 'rejected') {
                logger.warn(`[RemoteRelay/Firestore] ⚠️ Rejected command: ${parsed.reason}`);
                writeDiagnostic('command_rejected', { commandId: command.id, reason: parsed.reason });
                await remoteRelayService.sendResponse(
                    command.id,
                    `⚠️ This action could not be handled: ${parsed.reason}`,
                    undefined,
                    false
                );
                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            if (parsed.kind === 'wake') {
                logger.info('[RemoteRelay/Firestore] ⏰ Wake command received');
                writeDiagnostic('wake_command', { commandId: command.id });
                wakeDesktop();
                await remoteRelayService.sendResponse(
                    command.id,
                    'INDII is awake.',
                    'generalist',
                    false
                );
                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            if (parsed.kind === 'navigate') {
                const targetModule = parsed.module;
                logger.info(`[RemoteRelay/Firestore] 🧭 Navigate to: "${targetModule}"`);
                writeDiagnostic('navigation_started', { module: targetModule });

                useStore.getState().setModule(targetModule);

                await remoteRelayService.sendResponse(
                    command.id,
                    `🧭 Navigated to ${targetModule}`,
                    undefined,
                    false
                );

                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            if (parsed.kind === 'generate_image') {
                const imagePrompt = parsed.prompt;
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
                return;
            }

            // ─── Show Me Route (on-demand visual return channel) ──────────────────────────────
            // ISSUE-REMOTE-SHOW-20260622 Phase 1: surface the most recent visual artifact on the
            // phone by reusing the same imageUrls channel that [GENERATE_IMAGE] already uses.
            if (parsed.kind === 'show') {
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
                return;
            }

            // ─── Show Me Route (on-demand visual return channel) ──────────────────────────────
            // ISSUE-REMOTE-SHOW-20260622 Phase 1: surface the most recent visual artifact on the
            // phone by reusing the same imageUrls channel that [GENERATE_IMAGE] already uses.
            if (command.text.startsWith('[SHOW]')) {
                logger.info('[RemoteRelay/Firestore] 🖼️ Show me: surfacing latest visual artifact');
                writeDiagnostic('show_me_started', { commandId: command.id });

                const history = useStore.getState().generatedHistory;
                const resolved = resolveShowMeResponse(history);

                await remoteRelayService.sendResponse(
                    command.id,
                    resolved.text,
                    resolved.agentId,
                    false,
                    resolved.imageUrls
                );

                if (resolved.imageUrls) {
                    writeDiagnostic('show_me_done', { commandId: command.id, imageUrl: resolved.imageUrls[0] });
                } else {
                    writeDiagnostic('show_me_empty', { commandId: command.id });
                }

                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            // ─── Agent Action Route ──────────────────────────────
            if (parsed.kind === 'agent_action') {
                const action = parsed.action;
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
                return;
            }

            if (parsed.kind === 'daw_control') {
                const action = parsed.action;
                logger.info(`[RemoteRelay/Firestore] 🎛️ DAW Control: "${action}"`);
                writeDiagnostic('daw_control_started', { action });

                const store = useStore.getState();
                if (action === 'toggle_playback') {
                    if (store.isPlaying) {
                        store.pauseTrack();
                    } else {
                        store.resumeTrack();
                    }
                } else if (action === 'play' || action === 'resume') {
                    store.resumeTrack();
                } else if (action === 'pause') {
                    store.pauseTrack();
                } else if (action === 'stop') {
                    store.stopTrack();
                }

                await remoteRelayService.sendResponse(
                    command.id,
                    `🎛️ DAW Control: ${action} executed`,
                    undefined,
                    false
                );

                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            if (parsed.kind === 'media_playback') {
                const action = parsed.action;
                logger.info(`[RemoteRelay/Firestore] 🎬 Media Playback: "${action}"`);
                writeDiagnostic('media_playback_started', { action });

                const store = useStore.getState();
                if (action === 'toggle_playback') {
                    if (store.isPlaying) {
                        store.pauseTrack();
                    } else {
                        store.resumeTrack();
                    }
                } else if (action === 'play' || action === 'resume') {
                    store.resumeTrack();
                } else if (action === 'pause') {
                    store.pauseTrack();
                } else if (action === 'stop') {
                    store.stopTrack();
                }

                await remoteRelayService.sendResponse(
                    command.id,
                    `🎬 Media Playback: ${action} executed`,
                    undefined,
                    false
                );

                await remoteRelayService.markCommandCompleted(command.id);
                return;
            }

            if (parsed.kind === 'chat') {
                const text = parsed.text;
                const startedAt = Date.now();
                logger.info(`[RemoteRelay/Firestore] 💬 Agent chat: "${text.substring(0, 50)}"`);
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

                const commandResult = await entryCommandService.handleInput(text, {
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
                    return;
                }

                await agentService.sendMessage(
                    text,
                    undefined,
                    command.targetAgentId,
                    { source: 'mobile-remote' }
                );

                const response = findLatestRemoteAgentResponse(startedAt);
                await remoteRelayService.sendResponse(
                    command.id,
                    response?.text?.trim() || 'Done.',
                    response?.agentId || command.targetAgentId || 'generalist',
                    false,
                    undefined,
                    response?.id
                );
                await remoteRelayService.markCommandCompleted(command.id);
                writeDiagnostic('agent_chat_done', { commandId: command.id });
                return;
            }
        }} catch (error: unknown) {
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
            // Scan for any missed/backlogged commands
            scanAndProcessPendingCommands();
        }
    };

    const scanAndProcessPendingCommands = async () => {
        const uid = getRealAuthenticatedUserId(auth.currentUser);
        if (!uid || isProcessing.current) return;

        try {
            const { getDocs, query, where, collection } = await import('firebase/firestore');
            const cmdsRef = collection(db, 'users', uid, 'remote-relay-commands');
            const q = query(cmdsRef, where('status', '==', 'pending'));
            const querySnap = await getDocs(q);

            for (const docSnap of querySnap.docs) {
                if (isProcessing.current) break;
                const data = docSnap.data() as RemoteCommand;
                await processSingleCommand({ ...data, id: docSnap.id });
            }
        } catch (err) {
            logger.warn('[RemoteRelay] Failed to scan pending commands:', err);
        }
    };

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

        const unsubscribe = remoteRelayService.onCommand(async (command: RemoteCommand & { id: string }) => {
            if (!command.text) {
                logger.info(`[RemoteRelay/Firestore] ⏭️ Ignoring empty command ${command.id}`);
                return;
            }

            if (isProcessing.current) {
                writeDiagnostic('command_skipped_busy', { commandId: command.id });
                return;
            }

            await processSingleCommand(command);
        });

        // Scan once when enabled/mounted to catch any backlogged commands immediately
        scanAndProcessPendingCommands();

        // ─── AGENT DISPATCH QUEUE LISTENER (Phase 2) ───
        logger.info('[RemoteRelay/Firestore] 🚀 Registering dispatch task listener NOW...');
        const unsubscribeDispatch = remoteRelayService.onDispatchTask(async (task: AgentDispatchTask & { id: string }) => {
            logger.info(`[RemoteRelay/Firestore] 📱→🖥️ Processing Dispatch Task: [${task.type}] ${task.id}`);

            // Automatic wake: any task from the phone surfaces a sleeping desktop
            // before processing, so results are visible when the user looks.
            wakeDesktop();

            try {
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'processing');
                
                // Switch based on the dispatch task type
                switch (task.type) {
                    case 'voice_memo':
                    case 'quick_contact':
                    case 'receipt_log':
                    case 'live_moment':
                    case 'media_capture':
                    case 'document_scan':
                    case 'venue_log':
                    case 'agent_command': {
                        // Fallback simple handler for Phase 2: Route directly to agent
                        let text = task.payload.commandText || task.payload.transcription;
                        if (!text) {
                            if (task.type === 'live_moment' && task.payload.noteText) {
                                useStore.getState().addNote(buildLiveMomentNote(task.payload.noteText));
                                break;
                            } else if (task.type === 'live_moment') {
                                throw new Error('Missing live moment text');
                            } else if (task.type === 'receipt_log' && task.payload.imageUrl) {
                                text = `Please process this receipt image. Use your tools to extract data, and CALL the \`save_media_note\` tool to attach it to my Notes: ${task.payload.imageUrl}`;
                            } else if (task.type === 'document_scan' && task.payload.imageUrl) {
                                text = `Please analyze and file this scanned document. CALL the \`save_media_note\` tool with url="${task.payload.imageUrl}" and a description of the document.`;
                            } else if (task.type === 'venue_log' && task.payload.lat && task.payload.lng) {
                                // 1. Add user's pin directly to the map
                                useStore.getState().addUserPin({ lat: task.payload.lat, lng: task.payload.lng });
                                
                                // 2. Formulate explicit instruction for Scout Agent
                                text = `I just dropped a pin at Latitude ${task.payload.lat}, Longitude ${task.payload.lng}. 
Please act as my Scout. Use your search tools to find 3-5 live music venues, clubs, or relevant music businesses within a 5-mile radius of this coordinate. 
Format the findings and then CALL the \`save_scout_leads_to_map\` tool to plot them directly on my studio map. Ensure you include coordinates (lat/lng) for each venue you find.`;
                            } else if (task.type === 'media_capture' && task.payload.imageUrl) {
                                text = `I captured a photo. CALL the \`save_media_note\` tool with url="${task.payload.imageUrl}" to save it to my Notes.`;
                            } else if (task.type === 'media_capture' && task.payload.videoUrl) {
                                text = `I captured a video. CALL the \`save_media_note\` tool with url="${task.payload.videoUrl}" to save it to my Notes.`;
                            } else if ((task.type === 'voice_memo' || task.type === 'quick_contact') && task.payload.audioUrl) {
                                text = `I captured a voice memo. If there's a transcription available, please summarize it and CALL \`save_note\`. If it's just audio, CALL \`save_media_note\` with url="${task.payload.audioUrl}".`;
                            } else {
                                text = `I captured a ${task.type}. Please act on it and CALL \`save_note\` or \`save_media_note\` to save it to my Notes.`;
                            }
                        } else {
                            // If text is provided but it also has media attachments, append them
                            if (task.payload.imageUrl) text += `\n\nImage Attachment: ${task.payload.imageUrl}`;
                            if (task.payload.videoUrl) text += `\n\nVideo Attachment: ${task.payload.videoUrl}`;
                            if (task.payload.audioUrl) text += `\n\nAudio Attachment: ${task.payload.audioUrl}`;
                        }
                        
                        logger.info(`[RemoteRelay/Firestore] Dispatching to Agent Service: "${text}"`);
                        await agentService.sendMessage(text, undefined, 'generalist', {
                            source: 'mobile-remote'
                        });
                        break;
                    }
                    default:
                        logger.warn(`[RemoteRelay/Firestore] Unknown dispatch task type: ${task.type}`);
                        break;
                }
                
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed');
                writeDiagnostic('dispatch_task_done', { taskId: task.id, type: task.type });
            } catch (error: unknown) {
                logger.error('[RemoteRelay/Firestore] Dispatch task failed:', error);
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'failed', {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Processing failed'
                });
            }
        });

        return () => {
            unsubscribe();
            unsubscribeDispatch();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Periodic cleanup of old relay data (every 30 min)
    useEffect(() => {
        if (!enabled) return;
        let active = true;

        const cleanup = () => remoteRelayService.cleanupOld(24).catch((err: unknown) => {
            logger.warn('[RemoteRelay] Periodic old command cleanup failed:', err);
        });

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
