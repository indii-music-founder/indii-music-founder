/**
 * EditorTools.ts — Agent -> Video Editor Bridge (ISSUE-1416, MIG-011)
 *
 * Implements the 4-tool sequence for conductor agents (Creative Director, Conductor, Video Director)
 * to discover real user assets, plan beat-snapped timelines, and submit authentic stitch renders
 * through RenderService without external browser hacks or mock stubs:
 * 1. video_list_renderable_assets (read-only — reads real generatedHistory + completed videoJobs)
 * 2. video_plan_sequence / video_plan_chain (read-only, beat-snapped, fail-closed validation)
 * 3. video_render_stitch / video_render_chain (high-risk, billable, cost-gated & approval-gated -> RenderService)
 * 4. video_get_render_status (read-only -> real RenderService receipt polling)
 */

import { wrapTool, toolSuccess, toolError } from '@/services/agent/utils/ToolUtils';
import type { AnyToolFunction } from '@/services/agent/types';
import { calculateBeatSnappedTimeline } from '@indii/video-compiler';
import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';
import { CostControlService } from '@/services/billing/CostControlService';
import { execApprovalService } from '@/services/security/ExecApprovalService';
import { renderService } from '@/services/video/RenderService';
import { auth, db } from '@/services/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

export type SupportedStitchAspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface RenderableAsset {
    id: string;
    name: string;
    url: string;
    canonicalSourceUri?: string;
    durationSeconds: number | null;
    aspectRatio: SupportedStitchAspectRatio;
    createdAt?: string;
    source: 'history' | 'videoJobs';
}

export interface SequenceSlot {
    order: number;
    assetId: string;
    url: string;
    canonicalSourceUri?: string;
    startSeconds: number;
    durationSeconds: number;
    timelineDropSeconds?: number;
}

export interface SequencePlan {
    planId: string;
    aspectRatio: SupportedStitchAspectRatio;
    bpm: number;
    bpmSource: 'measured' | 'default';
    beatSnapped: boolean;
    slots: SequenceSlot[];
    totalDurationSeconds: number;
    validation: {
        isValid: boolean;
        errors: string[];
    };
}

// In-memory registry for planned sequences and discovered assets within the session
const sequencePlanCache = new Map<string, SequencePlan>();
const discoveredAssetCache = new Map<string, RenderableAsset>();

/** Estimated cost for a multi-segment stitch render in USD */
const BASE_RENDER_COST_ESTIMATE_USD = 0.15;

const DIMENSIONS_BY_ASPECT: Record<SupportedStitchAspectRatio, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
};

function normalizeAspectRatio(value: unknown): SupportedStitchAspectRatio {
    if (value === '9:16' || value === '1:1' || value === '4:5' || value === '16:9') {
        return value;
    }
    return '16:9';
}

function parseFiniteDuration(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Discovers real, user-owned completed video assets from the local store history
 * and Firestore `videoJobs` collection. Never fabricates mock assets or durations.
 */
async function discoverUserVideoAssets(uid: string): Promise<RenderableAsset[]> {
    const byId = new Map<string, RenderableAsset>();

    // 1. Read local renderer history if available
    try {
        const { useStore } = await import('@/core/store');
        const history = useStore.getState().generatedHistory ?? [];
        for (const item of history) {
            if (item.type !== 'video' || !item.url) continue;
            const record = item as unknown as Record<string, unknown>;
            const canonicalSourceUri = typeof record.resultUri === 'string' && record.resultUri.startsWith('gs://')
                ? record.resultUri
                : item.url.startsWith('gs://')
                    ? item.url
                    : undefined;
            const asset: RenderableAsset = {
                id: item.id,
                name: item.prompt?.slice(0, 64) || `Video ${item.id.slice(0, 8)}`,
                url: item.url,
                ...(canonicalSourceUri ? { canonicalSourceUri } : {}),
                durationSeconds: parseFiniteDuration(record.durationSeconds ?? record.duration),
                aspectRatio: normalizeAspectRatio(record.aspectRatio),
                createdAt: item.timestamp ? new Date(item.timestamp).toISOString() : undefined,
                source: 'history',
            };
            byId.set(asset.id, asset);
        }
    } catch {
        // Store unavailable in headless test context; continue to Firestore lookup.
    }

    // 2. Query Firestore completed videoJobs owned by uid
    try {
        const jobsQuery = query(
            collection(db, 'videoJobs'),
            where('userId', '==', uid),
            where('status', '==', 'completed'),
            limit(50),
        );
        const snapshot = await getDocs(jobsQuery);
        snapshot.forEach(docSnap => {
            const data = docSnap.data() as Record<string, unknown>;
            const output = (data.output && typeof data.output === 'object' ? data.output : {}) as Record<string, unknown>;
            const url = (typeof data.videoUrl === 'string' && data.videoUrl)
                || (typeof output.url === 'string' && output.url)
                || (typeof data.resultUri === 'string' && data.resultUri)
                || '';
            if (!url) return;
            const canonicalSourceUri = typeof data.resultUri === 'string' && data.resultUri.startsWith('gs://')
                ? data.resultUri
                : url.startsWith('gs://')
                    ? url
                    : undefined;
            const existing = byId.get(docSnap.id);
            byId.set(docSnap.id, {
                id: docSnap.id,
                name: typeof data.prompt === 'string' && data.prompt.trim()
                    ? data.prompt.trim().slice(0, 64)
                    : existing?.name ?? `Video Job ${docSnap.id.slice(0, 8)}`,
                url,
                ...(canonicalSourceUri ? { canonicalSourceUri } : existing?.canonicalSourceUri ? { canonicalSourceUri: existing.canonicalSourceUri } : {}),
                durationSeconds: parseFiniteDuration(data.durationSeconds ?? data.duration ?? output.durationSeconds) ?? existing?.durationSeconds ?? null,
                aspectRatio: normalizeAspectRatio(data.aspectRatio ?? existing?.aspectRatio),
                createdAt: typeof data.createdAt === 'string' ? data.createdAt : existing?.createdAt,
                source: 'videoJobs',
            });
        });
    } catch {
        // Firestore offline or mocked without getDocs; rely on discovered history items.
    }

    const list = Array.from(byId.values());
    for (const asset of list) {
        discoveredAssetCache.set(asset.id, asset);
    }
    return list;
}

/**
 * Snaps transition drop points to the nearest measured beat timestamp when available.
 */
function snapTimeToMeasuredBeat(targetSec: number, beatTimestampsSec: number[] | undefined, toleranceSec = 0.5): number {
    if (!beatTimestampsSec || beatTimestampsSec.length === 0) return targetSec;
    let closest = targetSec;
    let bestDelta = toleranceSec;
    for (const beat of beatTimestampsSec) {
        const delta = Math.abs(beat - targetSec);
        if (delta <= bestDelta) {
            bestDelta = delta;
            closest = beat;
        }
    }
    return Math.round(closest * 1000) / 1000;
}

const planSequenceHandler = async (args: {
    assetIds: string[];
    bpm?: number;
    beatTimestampsSec?: number[];
    beatSnapped?: boolean;
    aspectRatio?: SupportedStitchAspectRatio;
    transitionDurationSeconds?: number;
}) => {
    try {
        if (!args.assetIds || args.assetIds.length < 2) {
            return toolError('At least 2 asset IDs are required to plan a sequence.');
        }

        const uid = auth.currentUser?.uid;
        if (uid) {
            await discoverUserVideoAssets(uid);
        }

        const hasMeasuredBpm = typeof args.bpm === 'number' && Number.isFinite(args.bpm) && args.bpm > 0;
        const bpm = hasMeasuredBpm ? args.bpm! : 120;
        const beatSnapped = args.beatSnapped ?? true;
        const transitionDuration = args.transitionDurationSeconds ?? 1.0;
        const aspectRatio = args.aspectRatio ?? '16:9';

        const validationErrors: string[] = [];
        const resolvedAssets = args.assetIds.map(id => {
            const found = discoveredAssetCache.get(id);
            if (!found) {
                validationErrors.push(`Asset '${id}' was not found in your renderable library. Run video_list_renderable_assets first.`);
                return null;
            }
            if (found.durationSeconds === null) {
                validationErrors.push(`Asset '${id}' has an unknown duration and cannot be stitched until probed.`);
            }
            return found;
        });

        // Calculate beat-snapped offsets
        const timelineResult = calculateBeatSnappedTimeline({
            bpm,
            segmentCount: args.assetIds.length,
            transitionDurationSeconds: transitionDuration,
            targetTotalSeconds: args.assetIds.length * 8,
        });

        const slots: SequenceSlot[] = args.assetIds.map((id, index) => {
            const segDuration = timelineResult.segmentDurations[index]!;
            const asset = resolvedAssets[index];
            const snappedDrop = beatSnapped
                ? snapTimeToMeasuredBeat(segDuration.timelineDropSeconds, args.beatTimestampsSec)
                : segDuration.timelineDropSeconds;
            return {
                order: index,
                assetId: id,
                url: asset?.url ?? '',
                ...(asset?.canonicalSourceUri ? { canonicalSourceUri: asset.canonicalSourceUri } : {}),
                startSeconds: segDuration.timelineStartSeconds,
                durationSeconds: segDuration.durationSeconds,
                timelineDropSeconds: snappedDrop,
            };
        });

        const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const plan: SequencePlan = {
            planId,
            aspectRatio,
            bpm,
            bpmSource: hasMeasuredBpm ? 'measured' : 'default',
            beatSnapped,
            slots,
            totalDurationSeconds: timelineResult.totalMasterDurationSeconds,
            validation: {
                isValid: validationErrors.length === 0,
                errors: validationErrors,
            },
        };

        sequencePlanCache.set(planId, plan);

        return toolSuccess({
            plan,
            spec: timelineResult.spec,
            summary: validationErrors.length === 0
                ? `Planned ${slots.length}-clip sequence totaling ${plan.totalDurationSeconds.toFixed(1)}s, beat-snapped to ${bpm} BPM (${plan.bpmSource}).`
                : `Planned ${slots.length}-clip sequence with ${validationErrors.length} validation issue(s) that must be resolved before rendering.`,
        }, `Sequence plan ${planId} generated.`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`Failed to plan sequence: ${message}`);
    }
};

function buildStitchVideoProject(plan: SequencePlan, projectId: string): IndiiVideoProject {
    const fps = 30;
    const { width, height } = DIMENSIONS_BY_ASPECT[plan.aspectRatio] ?? DIMENSIONS_BY_ASPECT['16:9'];
    const videoTrackId = 'agent-stitch-video';
    let currentFrame = 0;

    const clips: IndiiVideoClip[] = plan.slots.map((slot, index) => {
        const durationInFrames = Math.max(1, Math.round(slot.durationSeconds * fps));
        const clip: IndiiVideoClip = {
            id: `stitch-slot-${index}-${slot.assetId}`,
            type: 'video',
            src: slot.url,
            ...(slot.canonicalSourceUri ? { canonicalSourceUri: slot.canonicalSourceUri } : {}),
            startFrame: currentFrame,
            durationInFrames,
            trackId: videoTrackId,
            name: `Segment ${index + 1}`,
        };
        currentFrame += durationInFrames;
        return clip;
    });

    return {
        id: projectId,
        name: `Agent Stitch ${plan.planId}`,
        fps,
        durationInFrames: Math.max(1, currentFrame),
        width,
        height,
        tracks: [{ id: videoTrackId, name: 'Stitched Video', type: 'video' }],
        clips,
    };
}

const renderStitchHandler = async (args: {
    planId?: string;
    assetIds?: string[];
    projectId?: string;
    organizationId?: string;
    aspectRatio?: SupportedStitchAspectRatio;
    bpm?: number;
}) => {
    try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            return toolError('Authentication required to submit stitch render.', 'UNAUTHENTICATED');
        }

        let targetPlan: SequencePlan | undefined;
        if (args.planId) {
            targetPlan = sequencePlanCache.get(args.planId);
        }

        if (!targetPlan && args.assetIds && args.assetIds.length >= 2) {
            await discoverUserVideoAssets(uid);
            const validationErrors: string[] = [];
            const resolvedAssets = args.assetIds.map(id => {
                const found = discoveredAssetCache.get(id);
                if (!found) {
                    validationErrors.push(`Asset '${id}' was not found in your renderable library.`);
                    return null;
                }
                if (found.durationSeconds === null) {
                    validationErrors.push(`Asset '${id}' has an unknown duration and cannot be stitched.`);
                }
                return found;
            });
            const hasMeasuredBpm = typeof args.bpm === 'number' && Number.isFinite(args.bpm) && args.bpm > 0;
            const bpm = hasMeasuredBpm ? args.bpm! : 120;
            const timeline = calculateBeatSnappedTimeline({
                bpm,
                segmentCount: args.assetIds.length,
                transitionDurationSeconds: 1.0,
            });
            targetPlan = {
                planId: `implicit_${Date.now()}`,
                aspectRatio: args.aspectRatio ?? '16:9',
                bpm,
                bpmSource: hasMeasuredBpm ? 'measured' : 'default',
                beatSnapped: true,
                slots: args.assetIds.map((id, i) => ({
                    order: i,
                    assetId: id,
                    url: resolvedAssets[i]?.url ?? '',
                    ...(resolvedAssets[i]?.canonicalSourceUri ? { canonicalSourceUri: resolvedAssets[i]!.canonicalSourceUri } : {}),
                    startSeconds: timeline.segmentDurations[i]!.timelineStartSeconds,
                    durationSeconds: timeline.segmentDurations[i]!.durationSeconds,
                })),
                totalDurationSeconds: timeline.totalMasterDurationSeconds,
                validation: {
                    isValid: validationErrors.length === 0,
                    errors: validationErrors,
                },
            };
        }

        if (!targetPlan) {
            return toolError('Valid planId or list of at least 2 assetIds is required to render stitch.', 'INVALID_PLAN');
        }

        // Fail closed on missing assets or unknown durations before reserving cost
        if (!targetPlan.validation.isValid) {
            return toolError(
                `Sequence plan failed validation: ${targetPlan.validation.errors.join(' ')}`,
                'INVALID_SEQUENCE_PLAN',
            );
        }

        // HARD GATE 1: Server Cost Reservation (enforceOperationCost)
        const costCheck = await CostControlService.checkAndReserve({
            operationType: 'video',
            estimatedCost: BASE_RENDER_COST_ESTIMATE_USD,
            userId: uid,
            metadata: {
                planId: targetPlan.planId,
                segmentCount: targetPlan.slots.length,
                totalDurationSeconds: targetPlan.totalDurationSeconds,
            },
        });

        if (!costCheck.allowed) {
            return toolError(
                `Cost reservation denied: ${costCheck.reason || 'Insufficient credit/budget balance.'}`,
                'RESOURCE_EXHAUSTED',
            );
        }

        // HARD GATE 2: User / ExecApprovalService Authorization
        const approval = await execApprovalService.requestApproval({
            commandPattern: `video_render_stitch:${targetPlan.planId}`,
            category: 'agent',
            description: `Submit billable stitch render (${targetPlan.slots.length} segments, ${targetPlan.totalDurationSeconds.toFixed(1)}s runtime) for ~$${BASE_RENDER_COST_ESTIMATE_USD.toFixed(2)}`,
            requestedScope: 'once',
            isSandboxed: false,
        });

        if (!approval.approved) {
            return toolError(
                `Execution approval denied: ${approval.reason || 'User did not grant permission for billable video render.'}`,
                'APPROVAL_DENIED',
            );
        }

        // Resolve active project & organization identifiers from store if omitted
        let projectId = args.projectId;
        let organizationId = args.organizationId;
        if (!projectId || !organizationId) {
            try {
                const { useStore } = await import('@/core/store');
                const state = useStore.getState();
                projectId = projectId || state.currentProjectId || 'default-project';
                organizationId = organizationId || state.currentOrganizationId || 'default-org';
            } catch {
                projectId = projectId || 'default-project';
                organizationId = organizationId || 'default-org';
            }
        }

        // Build real IndiiVideoProject and submit to the server-authoritative RenderService
        const project = buildStitchVideoProject(targetPlan, projectId);
        const queuedReceipt = await renderService.queueComposition({
            compositionId: 'AgentStitch',
            inputProps: { project },
            outputLocation: `${targetPlan.planId}.mp4`,
            projectId,
            organizationId,
            useCloudQueue: true,
        });

        return toolSuccess({
            renderId: queuedReceipt.renderId,
            status: queuedReceipt.status,
            progress: queuedReceipt.progress,
            projectId: queuedReceipt.projectId,
            planId: targetPlan.planId,
            aspectRatio: targetPlan.aspectRatio,
            operationId: costCheck.operationId,
            estimatedDurationSeconds: targetPlan.totalDurationSeconds,
            outputUrl: null,
            message: 'Stitch render job cost-reserved, approved, and submitted to RenderService.',
        }, `Stitch job ${queuedReceipt.renderId} queued.`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`Failed to submit stitch render: ${message}`, 'RENDER_SUBMISSION_FAILED');
    }
};

export const EditorTools = {
    /**
     * 1. Discover: List user's finished, owned video assets with duration & aspect ratio metadata.
     */
    video_list_renderable_assets: wrapTool('video_list_renderable_assets', async (args: {
        aspectRatio?: SupportedStitchAspectRatio;
        minDuration?: number;
    }) => {
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError('Authentication required to list renderable assets.', 'UNAUTHENTICATED');
            }

            const assets = await discoverUserVideoAssets(uid);
            const filtered = assets.filter(asset => {
                if (args.aspectRatio && asset.aspectRatio !== args.aspectRatio) return false;
                if (args.minDuration && (asset.durationSeconds === null || asset.durationSeconds < args.minDuration)) return false;
                return true;
            });

            return toolSuccess({
                count: filtered.length,
                assets: filtered,
            }, `Found ${filtered.length} renderable video asset(s).`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return toolError(`Failed to list renderable assets: ${message}`);
        }
    }),

    /**
     * 2. Plan: Compose an ordered sequence with beat snapping and strict validation (No render, no cost).
     */
    video_plan_sequence: wrapTool('video_plan_sequence', planSequenceHandler),
    video_plan_chain: wrapTool('video_plan_chain', planSequenceHandler),

    /**
     * 3. Execute: Billable render submission for an approved sequence plan (Cost + Approval gated -> RenderService).
     */
    video_render_stitch: wrapTool('video_render_stitch', renderStitchHandler),
    video_render_chain: wrapTool('video_render_chain', renderStitchHandler),

    /**
     * 4. Report: Honest status check on a queued or active stitch job via RenderService.
     */
    video_get_render_status: wrapTool('video_get_render_status', async (args: { renderId: string }) => {
        try {
            if (!args.renderId) {
                return toolError('renderId is required.');
            }

            const receipt = await renderService.getRenderReceipt(args.renderId);
            const outputUrl = receipt.status === 'completed' ? receipt.asset.url : null;
            const stage = receipt.status === 'running'
                ? receipt.phase ?? 'Rendering composition'
                : receipt.status === 'completed'
                    ? 'Completed'
                    : receipt.status === 'failed'
                        ? receipt.error
                        : 'Queued for cloud render';

            return toolSuccess({
                renderId: receipt.renderId,
                projectId: receipt.projectId,
                status: receipt.status,
                progress: receipt.progress,
                stage,
                outputUrl,
                ...(receipt.status === 'failed' ? { error: receipt.error } : {}),
            }, `Job ${receipt.renderId} status: ${receipt.status} (${receipt.progress}%).`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return toolError(`Failed to get render status: ${message}`, 'RENDER_STATUS_FAILED');
        }
    }),
} as const satisfies Record<string, AnyToolFunction>;

export const {
    video_list_renderable_assets,
    video_plan_sequence,
    video_plan_chain,
    video_render_stitch,
    video_render_chain,
    video_get_render_status,
} = EditorTools;

/** Test helper to clear in-memory plan/asset caches between unit tests. */
export function __resetEditorToolsCacheForTests(): void {
    sequencePlanCache.clear();
    discoveredAssetCache.clear();
}
