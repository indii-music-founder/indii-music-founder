/**
 * StudioExecutorCore — renderer-independent remote transport / executor
 * lifecycle (REMOTE_EXECUTOR_CORE_PLAN Phases 2–3).
 *
 * Owns ONLY Category-A responsibilities: presence/heartbeat, Firestore
 * subscriptions, ownership filtering, atomic claiming, the processing lock
 * and watchdog, response/completion publishing, backlog sweeps, diagnostics,
 * and relay hygiene. All Indii execution is delegated to an injected
 * StudioExecutionAdapter; this class must never touch the store, UI state,
 * AgentService, or window.* directly.
 *
 * Lifecycle semantics (explicit, framework-free):
 *   start()   idempotent while running; re-arms heartbeat, listeners,
 *             diagnostics, cleanup cadence, and runs a fresh backlog sweep.
 *   stop()    tears everything down deterministically — timers cleared,
 *             listeners removed, presence released once if ever published.
 *
 * Single-executor invariant (plan §12): exactly one Core instance owns the
 * production listener; the React hook mounts/unmounts this instance.
 */

import { logger } from '@/utils/logger';
import type { RemoteCommand } from '@/services/agent/RemoteRelayService';
import {
    HEARTBEAT_INTERVAL_MS,
    PROCESSING_RECHECK_MS,
    PROCESSING_TIMEOUT_MS,
    RELAY_CLEANUP_INTERVAL_MS,
    type ExecutorCoreDeps,
    type ParsedRemoteCommand,
} from './studioExecutorContracts';

const QUEUED_NOTICE =
    '⏳ Queued — your desktop Studio was mid-task. This message will run there when the current task finishes; its reply will appear in the desktop app.';

export class StudioExecutorCore {
    private deps: ExecutorCoreDeps;
    private running = false;
    private processing = false;
    private studioInstanceId: string | null = null;
    private hasPublishedPresence = false;

    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private unsubscribers: Array<() => void> = [];
    private watchdogTimers = new Set<ReturnType<typeof setTimeout>>();

    constructor(deps: ExecutorCoreDeps) {
        this.deps = deps;
        this.studioInstanceId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    get instanceId(): string {
        return this.studioInstanceId!;
    }

    get isRunning(): boolean {
        return this.running;
    }

    /** Diagnostics sink preserved verbatim from the pre-extraction hook. */
    private async writeDiagnostic(stage: string, details?: Record<string, unknown>): Promise<void> {
        await this.deps.writeDiagnostic(stage, details);
    }

    private async publishPresence(): Promise<void> {
        if (!this.running || !this.studioInstanceId) return;
        try {
            const snapshot = this.deps.adapter.presenceSnapshot();
            await this.deps.relay.pushDesktopState({
                currentModule: snapshot.currentModule || 'dashboard',
                isAgentProcessing: snapshot.isAgentProcessing,
                activeSessionId: snapshot.activeSessionId,
                online: true,
                sleepMode: snapshot.sleepMode,
                role: 'studio',
                studioInstanceId: this.studioInstanceId,
                listenerReady: true,
                capabilities: snapshot.capabilities,
            });
            this.hasPublishedPresence = true;
        } catch (error: unknown) {
            logger.warn('[ExecutorCore] Presence publish failed:', error);
        }
    }

    private armHeartbeat(): void {
        // Background hosts throttle the 5s loop to ~1/min, so the phone can briefly see a
        // stale heartbeat. Push immediately when the host regains visibility so the phone
        // reconnects instantly instead of waiting for the next throttled tick. Visibility
        // sourcing is host-injected: this class has zero document/window references.
        const unsubscribeVisibility = this.deps.subscribeVisibility?.(() => {
            void this.publishPresence();
        });
        if (unsubscribeVisibility) {
            this.unsubscribers.push(unsubscribeVisibility);
        }

        void this.publishPresence();
        this.heartbeatTimer = setInterval(() => {
            void this.publishPresence();
        }, HEARTBEAT_INTERVAL_MS);
        this.unsubscribers.push(() => {
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        });
    }

    private armCleanupCadence(): void {
        const cleanup = () => {
            this.deps.relay.cleanupOld(24).catch((err: unknown) => {
                logger.warn('[ExecutorCore] Periodic old command cleanup failed:', err);
            });
        };
        cleanup();
        this.cleanupTimer = setInterval(cleanup, RELAY_CLEANUP_INTERVAL_MS);
        this.unsubscribers.push(() => {
            if (this.cleanupTimer) clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        });
    }

    /**
     * Diagnose a long-running command without weakening serialization. The
     * route promise is the ownership boundary: an AgentService busy flag can
     * settle before direct generation or adapter work finishes, so a timer
     * must never release the queue lock. The returned disposer makes this
     * watchdog command-scoped and prevents stale timers affecting later work.
     */
    private armWatchdog(commandId: string): () => void {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const schedule = (delayMs: number) => {
            timer = setTimeout(() => {
                if (timer !== null) this.watchdogTimers.delete(timer);
                timer = null;
                if (cancelled || !this.processing) return;

                const agentBusy = this.deps.adapter.isAgentBusy();
                logger.info(
                    agentBusy
                        ? '[ExecutorCore] ⏳ Command still executing in AgentService — retaining processing lock.'
                        : '[ExecutorCore] ⏳ Command route remains unresolved — retaining processing lock.',
                );
                void this.writeDiagnostic(
                    agentBusy ? 'processing_timeout_extended' : 'processing_timeout_route_unresolved',
                    { commandId },
                );
                schedule(PROCESSING_RECHECK_MS);
            }, delayMs);
            this.watchdogTimers.add(timer);
        };

        schedule(PROCESSING_TIMEOUT_MS);
        return () => {
            cancelled = true;
            if (timer !== null) {
                clearTimeout(timer);
                this.watchdogTimers.delete(timer);
                timer = null;
            }
        };
    }

    async processSingleCommand(command: RemoteCommand & { id: string }): Promise<void> {
        if (this.processing) return;
        // Take the queue lock synchronously, BEFORE the first await. The
        // atomic claim below is itself an async call; releasing the guard
        // across it let two near-simultaneous commands pass the busy check.
        this.processing = true;
        let claimedByThisCall = false;
        let disarmWatchdog: (() => void) | null = null;
        try {
            if (!this.deps.shouldProcess(command)) {
                logger.info(`[ExecutorCore] ⏭️ Command ${command.id} belongs to the cloud executor`);
                return;
            }

            const uid = this.deps.getUserId();
            if (!uid) return;

            let claimed = false;
            try {
                claimed = await this.deps.lease.claim(command.id, this.studioInstanceId!);
            } catch (err) {
                logger.warn('[ExecutorCore] Atomic claim failed:', err);
                return;
            }
            if (!claimed) {
                void this.writeDiagnostic('command_skipped_not_claimed', { commandId: command.id });
                logger.info(`[ExecutorCore] ⏭️ Command ${command.id} already claimed`);
                return;
            }
            claimedByThisCall = true;

            // Any accepted phone command is also a wake signal. Firestore keeps
            // the queue durable while Studio rests in the tray.
            this.deps.adapter.wakeStudio();

            disarmWatchdog = this.armWatchdog(command.id);

            logger.info(`[ExecutorCore] 📱→🖥️ Processing command: "${command.text?.substring(0, 50)}"`);
            void this.writeDiagnostic('command_received', { commandId: command.id, text: command.text?.substring(0, 50) });

            const parsed: ParsedRemoteCommand = this.deps.parse(command.text);

            if (parsed.kind === 'rejected') {
                logger.warn(`[ExecutorCore] ⚠️ Rejected command: ${parsed.reason}`);
                void this.writeDiagnostic('command_rejected', { commandId: command.id, reason: parsed.reason });
                await this.deps.relay.sendResponse(
                    command.id,
                    `⚠️ This action could not be handled: ${parsed.reason}`,
                    undefined,
                    false
                );
                await this.deps.relay.markCommandCompleted(command.id);
                return;
            }

            const respond = (async (
                text: string,
                opts?: { agentId?: string; isStreaming?: boolean; boardroomMessageId?: string; imageUrls?: string[]; videoUrls?: string[] }
            ) => {
                await this.deps.relay.sendResponse(
                    command.id,
                    text,
                    opts?.agentId,
                    opts?.isStreaming,
                    opts?.imageUrls,
                    opts?.boardroomMessageId,
                    opts?.videoUrls
                );
            }) as Parameters<import('./studioExecutorContracts').StudioExecutionAdapter['executeCommand']>[0]['respond'];

            let result: { relays: Array<{ text: string; agentId?: string; boardroomMessageId?: string; imageUrls?: string[]; videoUrls?: string[] }>; queuedBehindActiveRun: boolean };
            if (parsed.kind === 'chat') {
                result = await this.deps.adapter.executeCommand({ command, parsed, respond });

                if (result.queuedBehindActiveRun) {
                    logger.info('[ExecutorCore] 💬 Chat queued behind an active desktop agent run');
                    void this.writeDiagnostic('agent_chat_queued_desktop_busy', { commandId: command.id });
                    await this.deps.relay.sendResponse(command.id, QUEUED_NOTICE, command.targetAgentId || 'generalist', false);
                    await this.deps.relay.markCommandCompleted(command.id);
                    return;
                }

                for (const reply of result.relays) {
                    await this.deps.relay.sendResponse(
                        command.id,
                        reply.text,
                        reply.agentId,
                        false,
                        reply.imageUrls,
                        reply.boardroomMessageId,
                        reply.videoUrls
                    );
                }
                if (result.relays.length === 0) {
                    await this.deps.relay.sendResponse(command.id, 'Done.', command.targetAgentId || 'generalist', false);
                }
                await this.deps.relay.markCommandCompleted(command.id);
                void this.writeDiagnostic('agent_chat_done', { commandId: command.id, responsesRelayed: result.relays.length });
                return;
            }

            result = await this.deps.adapter.executeCommand({ command, parsed, respond });

            for (const reply of result.relays) {
                await this.deps.relay.sendResponse(
                    command.id,
                    reply.text,
                    reply.agentId,
                    false,
                    reply.imageUrls,
                    reply.boardroomMessageId,
                    reply.videoUrls
                );
            }
            await this.deps.relay.markCommandCompleted(command.id);
        } catch (error: unknown) {
            logger.error('[ExecutorCore] Command failed:', error);
            await this.deps.relay.sendResponse(
                command.id,
                `❌ Error: ${error instanceof Error ? error.message : 'Processing failed'}`,
                undefined,
                false
            ).catch(sendErr => logger.warn('[ExecutorCore] Error-response publish also failed:', sendErr));
            await this.deps.relay.markCommandCompleted(command.id).catch(completeErr =>
                logger.warn('[ExecutorCore] Completion publish also failed:', completeErr)
            );
        } finally {
            disarmWatchdog?.();
            // Every exit must release the synchronous queue guard. A lost or
            // failed lease claim otherwise leaves this executor wedged forever.
            this.processing = false;
            // Only a command owned by this executor needs a follow-up sweep.
            // On claim failure, an immediate rescan can hot-loop the same
            // still-pending command while the lease service is unavailable.
            if (claimedByThisCall) void this.scanAndProcessPendingCommands();
        }
    }

    async scanAndProcessPendingCommands(): Promise<void> {
        const uid = this.deps.getUserId();
        if (!this.running || !uid || this.processing) return;

        try {
            const pending = await this.deps.scanPending();
            for (const data of pending) {
                if (this.processing) break;
                if (!this.deps.shouldProcess(data)) continue;
                await this.processSingleCommand(data);
            }
        } catch (err) {
            logger.warn('[ExecutorCore] Failed to scan pending commands:', err);
        }
    }

    private wireCommandListener(): void {
        this.unsubscribers.push(
            this.deps.relay.onCommand(async (command) => {
                if (!command.text) {
                    logger.info(`[ExecutorCore] ⏭️ Ignoring empty command ${command.id}`);
                    return;
                }
                if (!this.deps.shouldProcess(command)) {
                    logger.info(`[ExecutorCore] ⏭️ Ignoring cloud-owned command ${command.id}`);
                    return;
                }
                if (this.processing) {
                    void this.writeDiagnostic('command_skipped_busy', { commandId: command.id });
                    return;
                }
                await this.processSingleCommand(command);
            })
        );

        this.unsubscribers.push(
            this.deps.relay.onDispatchTask(async (task) => {
                logger.info(`[ExecutorCore] 📱→🖥️ Processing Dispatch Task: [${task.type}] ${task.id}`);

                // Atomic claim — first listener to win processes; others bail.
                const claimed = await this.deps.relay.claimDispatchTask(task.id);
                if (!claimed) {
                    logger.info(`[ExecutorCore] ⏭️ Dispatch task ${task.id} already claimed elsewhere`);
                    return;
                }

                // Automatic wake: surface a sleeping desktop before processing.
                this.deps.adapter.wakeStudio();

                try {
                    await this.deps.adapter.executeDispatchTask({
                        task,
                        respond: async () => { /* dispatch tasks carry no chat channel */ },
                    });
                    void this.writeDiagnostic('dispatch_task_done', { taskId: task.id, type: task.type });
                } catch (error: unknown) {
                    logger.error('[ExecutorCore] Dispatch task failed:', error);
                    await this.deps.relay.updateDispatchTaskStatus(task.id, 'failed', {
                        code: 'EXECUTION_ERROR',
                        message: error instanceof Error ? error.message : 'Processing failed',
                    });
                }
            })
        );
    }

    start(): void {
        if (this.running) return;
        this.running = true;

        logger.info('[ExecutorCore] 🚀 Studio Executor Core starting...');
        void this.writeDiagnostic('listener_registering', { enabled: true });

        this.armHeartbeat();
        this.armCleanupCadence();
        this.wireCommandListener();

        // Scan once at startup to catch any backlogged commands immediately.
        void this.scanAndProcessPendingCommands();
    }

    stop(): Promise<void> {
        if (!this.running) return Promise.resolve();
        this.running = false;

        for (const unsub of this.unsubscribers.splice(0)) {
            try {
                unsub();
            } catch (err) {
                logger.warn('[ExecutorCore] Listener teardown threw:', err);
            }
        }
        for (const t of this.watchdogTimers) clearTimeout(t);
        this.watchdogTimers.clear();

        if (this.hasPublishedPresence && this.studioInstanceId) {
            return this.deps.relay.releaseStudioPresence(this.studioInstanceId).catch((err: unknown) => {
                logger.warn('[ExecutorCore] Failed to release owned Studio presence during stop:', err);
            }) as Promise<void>;
        }
        return Promise.resolve();
    }
}

