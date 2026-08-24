/**
 * rendererExecutionAdapter — the StudioExecutionAdapter implementation that
 * binds the Studio Executor Core to the EXISTING Indii execution layer.
 *
 * Every route body here was moved verbatim from the pre-extraction
 * useRemoteCommandListener hook (Phase 2/3 of REMOTE_EXECUTOR_CORE_PLAN).
 * Nothing new is implemented: AgentService, EntryCommandService, generation
 * services, Notes tools, and store actions are reused exactly as before.
 * Transport (responses/completion) stays in the Core; this file only
 * produces content through the lent `respond` channel.
 */

import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';
import { entryCommandService } from '@/services/commands/EntryCommandService';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { NotesTools } from '@/services/agent/tools/NotesTools';
import { logger } from '@/utils/logger';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import type { HistoryItem } from '@/core/types/history';
import { auth } from '@/services/firebase';
import { loadVideoProject } from '@/modules/creative/video/services/VideoProjectPersistenceService';
import { renderVideoProjectLocally } from '@/services/video/LocalVideoProjectRenderer';
import {
    MAX_REMOTE_AGENT_RESPONSES,
    type RelayRespond,
    type StudioExecutionAdapter,
} from './studioExecutorContracts';

// ---------------------------------------------------------------------------
// Pure helpers (re-exported by useRemoteCommandListener for compatibility)
// ---------------------------------------------------------------------------

/**
 * ISSUE-988: `lat && lng` truthiness rejects valid zero coordinates (equator
 * or prime meridian) — validate as finite numbers within real latitude/
 * longitude range instead.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
    return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
        typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * ISSUE-983: for capture types where the correct Notes action is unambiguous
 * (a plain image/video/audio attachment, no text needing summarization or
 * an explicit command), call the Notes tool directly and return its real
 * receipt. Returns null when the task genuinely needs agent judgment.
 */
export async function saveCaptureNoteDirectly(
    task: Pick<import('@/services/agent/RemoteRelayService').AgentDispatchTask, 'type' | 'payload'>
): Promise<{ noteId: string; assetUrl?: string } | null> {
    const { type, payload } = task;
    if (payload.commandText || payload.transcription) return null;

    let url: string | undefined;
    let description: string;
    if (type === 'document_scan' && payload.imageUrl) {
        url = payload.imageUrl;
        description = 'Scanned document';
    } else if (type === 'receipt_log' && payload.imageUrl) {
        url = payload.imageUrl;
        description = 'Receipt';
    } else if (type === 'media_capture' && payload.imageUrl) {
        url = payload.imageUrl;
        description = 'Captured photo';
    } else if (type === 'media_capture' && payload.videoUrl) {
        url = payload.videoUrl;
        description = 'Captured video';
    } else if ((type === 'voice_memo' || type === 'quick_contact') && payload.audioUrl) {
        url = payload.audioUrl;
        description = 'Voice memo';
    } else {
        return null;
    }

    const result = await NotesTools.save_media_note({ url, description });
    if (!result.success || !result.data?.id) {
        throw new Error(result.error || 'Failed to save media note');
    }
    return { noteId: result.data.id as string, assetUrl: result.data.url as string | undefined };
}

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

/** Builds the natural-language instruction routed through agentService for a computer_task. */
export function buildComputerTaskInstruction(task: Pick<import('@/services/agent/RemoteRelayService').AgentDispatchTask, 'payload'>): string {
    let text = `Use the computer_drive tool to achieve this goal on the desktop: ${task.payload.goal}`;
    if (task.payload.constraints) {
        text += `\n\nConstraints: ${task.payload.constraints}`;
    }
    return text;
}

/**
 * Pure preflight for the `computer_task` dispatch branch (CE-4, ISSUE-1113).
 */
export function validateComputerTaskDispatch(
    task: Pick<import('@/services/agent/RemoteRelayService').AgentDispatchTask, 'payload'>,
    hasComputerApi: boolean
): string | null {
    if (!hasComputerApi) {
        return 'Computer control requires the indii desktop app — this Studio session cannot execute computer_task.';
    }
    if (!task.payload.goal || !task.payload.goal.trim()) {
        return 'computer_task is missing a goal';
    }
    return null;
}

interface VideoRenderDispatchDependencies {
    hasDesktopVideo: () => boolean;
    currentUid: () => string | undefined;
    organizationId: () => string | undefined;
    loadProject: typeof loadVideoProject;
    renderProject: typeof renderVideoProjectLocally;
    complete: typeof remoteRelayService.updateDispatchTaskStatus;
}

const videoRenderDispatchDependencies = (): VideoRenderDispatchDependencies => ({
    hasDesktopVideo: () => typeof window !== 'undefined' && !!window.electronAPI?.video?.render,
    currentUid: () => auth.currentUser?.uid,
    organizationId: () => useStore.getState().currentOrganizationId,
    loadProject: loadVideoProject,
    renderProject: renderVideoProjectLocally,
    complete: remoteRelayService.updateDispatchTaskStatus.bind(remoteRelayService),
});

/** Execute the durable MCP/remote render request through the same local entry as the editor. */
export async function executeVideoRenderDispatch(
    task: import('@/services/agent/RemoteRelayService').AgentDispatchTask,
    dependencies: VideoRenderDispatchDependencies = videoRenderDispatchDependencies(),
): Promise<void> {
    const projectId = task.payload.projectId?.trim();
    if (!projectId) throw new Error('video_render is missing projectId');
    if (!dependencies.hasDesktopVideo()) {
        throw new Error('Video rendering requires the indii desktop app.');
    }
    const uid = dependencies.currentUid();
    if (!uid) throw new Error('Video rendering requires an authenticated desktop session.');

    const loaded = await dependencies.loadProject(projectId, uid);
    if (loaded.status === 'error') throw new Error(`Could not load video project ${projectId}.`);
    if (loaded.status === 'absent') throw new Error(`Video project ${projectId} was not found.`);

    const receipt = await dependencies.renderProject(loaded.project, {
        outputName: task.payload.outputName,
        organizationId: dependencies.organizationId(),
    });
    await dependencies.complete(task.id, 'completed', undefined, {
        assetUrl: receipt.asset.url,
        renderId: receipt.renderId,
        projectId: receipt.projectId,
    });
}

/**
 * Pure decision logic for the `[SHOW]` ("show me") remote route.
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

/** All final model messages produced since startedAt, oldest first. */
export function collectRemoteAgentResponses(startedAt: number): AgentMessage[] {
    const state = useStore.getState();
    return state.agentHistory
        .filter(message =>
            message.role === 'model' &&
            Boolean(message.text?.trim()) &&
            message.timestamp >= startedAt &&
            !message.isStreaming
        )
        .sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export function createRendererExecutionAdapter(): StudioExecutionAdapter {
    const wakeStudio = () => {
        const storeState = useStore.getState();
        if (storeState.isSleeping) {
            storeState.setIsSleeping(false);
        }
        window.electronAPI?.window?.show?.().catch((err: unknown) => {
            logger.warn('[RemoteAdapter] window.show failed during wake:', err);
        });
    };

    const executeCommand: StudioExecutionAdapter['executeCommand'] = async ({ command, parsed, respond }) => {
        switch (parsed.kind) {
            case 'wake': {
                logger.info('[RemoteAdapter] ⏰ Wake command received');
                wakeStudio();
                return { relays: [{ text: 'INDII is awake.', agentId: 'generalist' }], queuedBehindActiveRun: false };
            }

            case 'navigate': {
                const targetModule = parsed.module;
                logger.info(`[RemoteAdapter] 🧭 Navigate to: "${targetModule}"`);
                useStore.getState().setModule(targetModule);
                return { relays: [{ text: `🧭 Navigated to ${targetModule}` }], queuedBehindActiveRun: false };
            }

            case 'generate_image': {
                const imagePrompt = parsed.prompt;
                const aspectRatio = (command.metadata?.aspectRatio as string) || '1:1';
                logger.info(`[RemoteAdapter] 🎨 Image generation: "${imagePrompt}" (${aspectRatio})`);
                await respond('🎨 Generating image on desktop…', { isStreaming: true });

                const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                const results = await ImageGeneration.generateImages({ prompt: imagePrompt, aspectRatio, count: 1, model: 'pro' });

                if (results.length > 0) {
                    const imageUrls = results.map(r => r.url);
                    return {
                        relays: [{ text: `✅ Generated ${results.length} image${results.length > 1 ? 's' : ''}.`, agentId: 'creative', imageUrls }],
                        queuedBehindActiveRun: false,
                    };
                }
                return { relays: [{ text: 'ERROR: Image generation returned no results. Try a different prompt.' }], queuedBehindActiveRun: false };
            }

            case 'generate_video': {
                const videoPrompt = parsed.prompt;
                const aspectRatio = command.metadata?.aspectRatio === '9:16' ? '9:16' : '16:9';
                const requestedDuration = Number(command.metadata?.durationSeconds ?? 8);
                const duration = [4, 6, 8].includes(requestedDuration) ? requestedDuration : 8;

                logger.info(`[RemoteAdapter] 🎬 Video generation: "${videoPrompt}" (${aspectRatio}, ${duration}s)`);
                await respond('🎬 Generating video on desktop…', { isStreaming: true });

                const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
                const results = await VideoGeneration.generateVideo({ prompt: videoPrompt, aspectRatio, duration, model: 'fast' });

                if (results.length > 0) {
                    const completed = results[0]!.url
                        ? { videoUrl: results[0]!.url }
                        : await VideoGeneration.waitForJob(results[0]!.id);
                    const videoUrl = completed.videoUrl || '';
                    if (!videoUrl) throw new Error('Video generation completed without an output URL.');
                    return {
                        relays: [{ text: '✅ Generated video.', agentId: 'creative', videoUrls: [videoUrl] }],
                        queuedBehindActiveRun: false,
                    };
                }
                return { relays: [{ text: 'ERROR: Video generation returned no result.' }], queuedBehindActiveRun: false };
            }

            case 'show': {
                logger.info('[RemoteAdapter] 🖼️ Show me: surfacing latest visual artifact');
                const resolved = resolveShowMeResponse(useStore.getState().generatedHistory);
                return {
                    relays: [{
                        text: resolved.text,
                        agentId: resolved.agentId,
                        ...(resolved.imageUrls ? { imageUrls: resolved.imageUrls } : {}),
                    }],
                    queuedBehindActiveRun: false,
                };
            }

            case 'agent_action': {
                const action = parsed.action;
                logger.info(`[RemoteAdapter] 🤖 Agent Action: "${action}"`);

                if (action === 'open_chat') {
                    // RightPanel only mounts at ≥768px — fall back to agent module on narrow viewports
                    const canMountPanel = typeof window !== 'undefined' && window.innerWidth >= 768;
                    if (canMountPanel) {
                        useStore.setState({
                            isRightPanelOpen: true,
                            rightPanelTab: 'agent',
                            rightPanelView: 'messages',
                        });
                    } else {
                        useStore.setState({ currentModule: 'agent' as import('@/core/constants').ModuleId });
                    }
                }

                return { relays: [{ text: `⚡ Agent action executed: ${action}` }], queuedBehindActiveRun: false };
            }

            case 'daw_control':
            case 'media_playback': {
                const label = parsed.kind === 'daw_control' ? '🎛️ DAW Control' : '🎬 Media Playback';
                const action = parsed.action;
                logger.info(`[RemoteAdapter] ${label}: "${action}"`);

                const store = useStore.getState();
                if (action === 'toggle_playback') {
                    if (store.isPlaying) store.pauseTrack(); else store.resumeTrack();
                } else if (action === 'play' || action === 'resume') {
                    store.resumeTrack();
                } else if (action === 'pause') {
                    store.pauseTrack();
                } else if (action === 'stop') {
                    store.stopTrack();
                }

                return { relays: [{ text: `${label}: ${action} executed` }], queuedBehindActiveRun: false };
            }

            case 'chat': {
                const text = parsed.text;
                const startedAt = Date.now();
                logger.info(`[RemoteAdapter] 💬 Agent chat: "${text.substring(0, 50)}"`);
                await respond('Processing in desktop studio…', { agentId: command.targetAgentId, isStreaming: true });

                const commandResult = await entryCommandService.handleInput(text, {
                    source: 'mobile',
                    includeUserMessage: true,
                    remoteCommandId: command.id,
                });
                if (commandResult.handled) {
                    const replyText = commandResult.responseText || 'Workflow command handled.';
                    return {
                        relays: [{ text: replyText, agentId: commandResult.agentId || command.targetAgentId || 'generalist' }],
                        queuedBehindActiveRun: false,
                    };
                }

                const sendDisposition = await agentService.sendMessage(
                    text,
                    undefined,
                    command.targetAgentId,
                    {
                        source: 'mobile-remote',
                        // The Controller picks Boardroom / Department / Direct +
                        // target in its own UI; without this override the run
                        // followed whatever mode the desktop last used.
                        ...(command.metadata?.conversationMode
                            ? (() => {
                                const raw = command.metadata?.conversationMode;
                                const mode = raw === 'boardroom' || raw === 'department' || raw === 'direct' ? raw : undefined;
                                return mode ? { conversationModeOverride: mode, targetOverride: command.targetAgentId } : {};
                            })()
                            : {}),
                    }
                );

                if (sendDisposition === 'queued') {
                    logger.info('[RemoteAdapter] 💬 Chat queued behind an active desktop agent run');
                    return {
                        relays: [],
                        queuedBehindActiveRun: true,
                    };
                }

                const responses = collectRemoteAgentResponses(startedAt);

                const relays = responses.slice(0, MAX_REMOTE_AGENT_RESPONSES).map(response => ({
                    text: response.text.trim(),
                    agentId: response.agentId || command.targetAgentId || 'generalist',
                    boardroomMessageId: response.id,
                }));
                if (responses.length > MAX_REMOTE_AGENT_RESPONSES) {
                    logger.warn(`[RemoteAdapter] Relaying first ${MAX_REMOTE_AGENT_RESPONSES} of ${responses.length} agent responses for ${command.id}`);
                }
                return { relays, queuedBehindActiveRun: false };
            }

            default: {
                // 'rejected' is filtered by the Core before delegation; any
                // future kind without a route lands here as a safe no-op.
                logger.warn(`[RemoteAdapter] No route for parsed command kind: ${(parsed as { kind: string }).kind}`);
                return { relays: [], queuedBehindActiveRun: false };
            }
        }
    };

    const executeDispatchTask: StudioExecutionAdapter['executeDispatchTask'] = async ({ task }) => {
        // ISSUE-983 contract: sendMessage queues silently when busy; marking a
        // capture 'completed' in that state cleared the phone's only copy.
        const assertDesktopIsFree = () => {
            if (agentService.isAgentBusy) {
                throw new Error('Desktop Studio is mid-task — this request was not queued. Check the desktop app or try again shortly.');
            }
        };

        switch (task.type) {
            case 'voice_memo':
            case 'quick_contact':
            case 'receipt_log':
            case 'live_moment':
            case 'media_capture':
            case 'document_scan':
            case 'venue_log':
            case 'agent_command': {
                if (task.type === 'live_moment' && task.payload.noteText) {
                    const noteId = useStore.getState().addNote(buildLiveMomentNote(task.payload.noteText));
                    await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed', undefined, { noteId });
                    return;
                }
                if (task.type === 'live_moment') {
                    throw new Error('Missing live moment text');
                }

                const directResult = await saveCaptureNoteDirectly(task);
                if (directResult) {
                    await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed', undefined, directResult);
                    return;
                }

                let text = task.payload.commandText || task.payload.transcription;
                if (!text) {
                    if (task.type === 'venue_log' && isValidCoordinate(task.payload.lat, task.payload.lng)) {
                        useStore.getState().addUserPin({ lat: task.payload.lat!, lng: task.payload.lng! });

                        text = `I just dropped a pin at Latitude ${task.payload.lat}, Longitude ${task.payload.lng}.
Please act as my Scout. Use your search tools to find 3-5 live music venues, clubs, or relevant music businesses within a 5-mile radius of this coordinate.
Format the findings and then CALL the \`save_scout_leads_to_map\` tool to plot them directly on my studio map. Ensure you include coordinates (lat/lng) for each venue you find.`;
                    } else {
                        text = `I captured a ${task.type}. Please act on it and CALL \`save_note\` or \`save_media_note\` to save it to my Notes.`;
                    }
                } else {
                    if (task.payload.imageUrl) text += `\n\nImage Attachment: ${task.payload.imageUrl}`;
                    if (task.payload.videoUrl) text += `\n\nVideo Attachment: ${task.payload.videoUrl}`;
                    if (task.payload.audioUrl) text += `\n\nAudio Attachment: ${task.payload.audioUrl}`;
                }

                logger.info(`[RemoteAdapter] Dispatching to Agent Service: "${text}"`);
                assertDesktopIsFree();
                await agentService.sendMessage(text, undefined, 'generalist', { source: 'mobile-remote' });
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed');
                return;
            }

            case 'computer_task': {
                const hasComputerApi = typeof window !== 'undefined' && !!window.electronAPI?.computer;
                const guardError = validateComputerTaskDispatch(task, hasComputerApi);
                if (guardError) throw new Error(guardError);

                const { studioExecutorLeaseService } = await import('@/services/agent/StudioExecutorLeaseService');
                try {
                    await studioExecutorLeaseService.getLease();
                } catch (leaseErr: unknown) {
                    throw new Error(`No valid Studio executor lease — computer_task refused: ${leaseErr instanceof Error ? leaseErr.message : String(leaseErr)}`);
                }

                const instruction = buildComputerTaskInstruction(task);
                logger.info(`[RemoteAdapter] 🖱️ Dispatching computer_task to Agent Service: "${task.payload.goal}"`);
                assertDesktopIsFree();
                await agentService.sendMessage(instruction, undefined, 'generalist', { source: 'mobile-remote' });
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed');
                return;
            }

            case 'video_render': {
                await executeVideoRenderDispatch(task);
                return;
            }

            default:
                logger.warn(`[RemoteAdapter] Unknown dispatch task type: ${(task as { type: string }).type}`);
                await remoteRelayService.updateDispatchTaskStatus(task.id, 'completed');
        }
    };

    return {
        wakeStudio,
        isAgentBusy: () => agentService.isAgentBusy,
        presenceSnapshot: () => {
            const s = useStore.getState();
            const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
            return {
                currentModule: s.currentModule || 'dashboard',
                isAgentProcessing: s.isAgentProcessing,
                activeSessionId: s.activeSessionId || '',
                sleepMode: s.isSleeping,
                // Phase 5 capability advertisement: presence ≠ capability.
                // Only surfaces that actually exist on this host advertise true.
                capabilities: {
                    agent: true,
                    computer: !!api?.computer,
                    audio: !!api?.audio,
                    daw: !!api?.daw,
                    ui: !s.isSleeping,
                },
            };
        },
        executeCommand,
        executeDispatchTask,
        collectResponses: (startedAt: number) =>
            collectRemoteAgentResponses(startedAt).slice(0, MAX_REMOTE_AGENT_RESPONSES),
    };
}

export type { RelayRespond };
