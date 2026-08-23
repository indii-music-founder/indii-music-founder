/**
 * studioExecutorContracts — the boundary between the Studio Executor Core
 * (remote transport / executor lifecycle) and the existing Indii execution
 * layer, per docs/REMOTE_EXECUTOR_CORE_PLAN.md Phases 2–3.
 *
 * The Core may import ONLY this file (plus Firebase service transports it is
 * handed as dependencies). Anything that touches the Zustand store, UI
 * state, AgentService, or window.* belongs to a StudioExecutionAdapter
 * implementation, never to the Core.
 *
 * Pure decision helpers live here too so both sides share one source of
 * truth without the Core pulling in execution-layer modules.
 */

import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { resolveRemoteCommandExecutionTarget, type AgentDispatchTask, type RemoteCommand, type StudioCapabilities } from '@/services/agent/RemoteRelayService';
import type { ParsedRemoteCommand } from '@/hooks/remoteCommandSecurity';

export type { AgentDispatchTask, RemoteCommand };
export type { ParsedRemoteCommand };
export type { StudioCapabilities };

/** Controller and cloud-owned commands must never be claimed by a Studio. */
export function shouldProcessStudioCommand(command: Pick<RemoteCommand, 'text' | 'executionTarget'>): boolean {
    return resolveRemoteCommandExecutionTarget(command) === 'studio';
}

/** Upper bound on relayed responses per command so a large seated boardroom cannot fan out unbounded Firestore writes. */
export const MAX_REMOTE_AGENT_RESPONSES = 12;

/** One relayed agent reply: content plus attribution/artifacts for the phone feed. */
export interface RemoteRelayReply {
    text: string;
    agentId?: string;
    /** Boardroom message id — lets the phone rate the exact agent message. */
    boardroomMessageId?: string;
    imageUrls?: string[];
    videoUrls?: string[];
}

/** Result contract the adapter hands back to the Core after executing a chat command. */
export interface ChatExecutionResult {
    /** Final replies to relay, oldest first. Empty when nothing ran. */
    relays: RemoteRelayReply[];
    /**
     * True when sendMessage queued the request behind an active desktop run
     * (no new agent message AND the agent is still busy). The Core then
     * reports QUEUED instead of a false completion.
     */
    queuedBehindActiveRun: boolean;
}

/** Response channel the Core lends the adapter. Transport stays Core-owned. */
export interface RelayRespond {
    (text: string, opts?: { agentId?: string; isStreaming?: boolean; boardroomMessageId?: string; imageUrls?: string[]; videoUrls?: string[] }): Promise<void>;
}

/**
 * Category B/C — everything that touches the existing execution layer, the
 * store, or renderer/Electron UI capabilities. Implementations must reuse
 * existing services (AgentService, EntryCommandService, generation services,
 * Notes tools, store actions) and must not duplicate any of them.
 */
export interface StudioExecutionAdapter {
    /** Surface a sleeping desktop for any accepted piece of remote work. */
    wakeStudio(): void;
    /** True while the desktop agent run is active (drives the Core watchdog). */
    isAgentBusy(): boolean;
    /** Snapshot of renderer-owned presence fields for the heartbeat. */
    presenceSnapshot(): {
        currentModule: string;
        isAgentProcessing: boolean;
        activeSessionId: string;
        sleepMode: boolean;
        capabilities: StudioCapabilities;
    };
    /**
     * Execute a claimed, validated command. Transport (responses, completion)
     * stays in the Core; the adapter returns what should be relayed and may
     * emit streaming placeholders through the lent `respond` channel.
     */
    executeCommand(ctx: {
        command: RemoteCommand & { id: string };
        parsed: ParsedRemoteCommand;
        respond: RelayRespond;
    }): Promise<ChatExecutionResult>;
    /** Execute a claimed dispatch task; throw to fail it loudly. */
    executeDispatchTask(ctx: { task: AgentDispatchTask & { id: string }; respond: RelayRespond }): Promise<void>;
    /** Final model messages produced since startedAt, oldest first. */
    collectResponses(startedAt: number): Array<Pick<AgentMessage, 'text' | 'agentId' | 'id' | 'timestamp'>>;
}

/** Transport subset of RemoteRelayService the Core is allowed to touch. */
export interface RelayTransport {
    onCommand(cb: (command: RemoteCommand & { id: string }) => void): () => void;
    onDispatchTask(cb: (task: AgentDispatchTask & { id: string }) => void): () => void;
    sendResponse(commandId: string, text: string, agentId?: string, isStreaming?: boolean, imageUrls?: string[], boardroomMessageId?: string, videoUrls?: string[]): Promise<void>;
    markCommandCompleted(commandId: string): Promise<void>;
    claimDispatchTask(taskId: string): Promise<boolean>;
    updateDispatchTaskStatus(taskId: string, status: AgentDispatchTask['status'], error?: AgentDispatchTask['error'], result?: AgentDispatchTask['result']): Promise<void>;
    pushDesktopState(state: Record<string, unknown> & { online: boolean }): Promise<void>;
    releaseStudioPresence(studioInstanceId: string): Promise<void>;
    cleanupOld(maxAgeHours?: number): Promise<number>;
}

export interface LeaseClaimer {
    claim(commandId: string, studioInstanceId: string): Promise<boolean>;
}

export interface ExecutorCoreDeps {
    relay: RelayTransport;
    lease: LeaseClaimer;
    adapter: StudioExecutionAdapter;
    /** Ownership filter (executionTarget resolution). */
    shouldProcess: (command: Pick<RemoteCommand, 'text' | 'executionTarget'>) => boolean;
    /** Command text validation. */
    parse: (text: string) => ParsedRemoteCommand;
    /** Authenticated uid or null. */
    getUserId: () => string | null;
    /** Backlog sweep returning still-pending studio-owned commands. */
    scanPending: () => Promise<Array<RemoteCommand & { id: string }>>;
    /** Diagnostics sink (Firestore doc merge). */
    writeDiagnostic: (stage: string, details?: Record<string, unknown>) => Promise<void>;
    /**
     * Host-provided visibility hook (browser wiring supplies
     * document.visibilitychange; background runtimes supply their own or omit).
     * The Core itself must never touch `document`/`window`.
     */
    subscribeVisibility?: (cb: () => void) => () => void;
    now?: () => number;
}

/** Core watchdog cadences — preserved verbatim from the pre-extraction hook. */
export const PROCESSING_TIMEOUT_MS = 120_000;
export const PROCESSING_RECHECK_MS = 30_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
export const RELAY_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
