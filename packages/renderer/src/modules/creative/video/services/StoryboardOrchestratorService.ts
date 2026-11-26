import { doc, getDoc, setDoc } from 'firebase/firestore';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { auth, db } from '@/services/firebase';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { logger } from '@/utils/logger';
import {
    StoryboardProjectSchema,
    type StoryboardProject,
    type StoryboardSlot,
} from '../schemas/storyboard';

export interface StoryboardBatchRenderSummary {
    renderedSlotIds: string[];
    skippedEmptyPromptCount: number;
    alreadyCompletedCount: number;
    failedSlots: Array<{ slotId: string; index: number; error: string }>;
}

export interface RenderPendingStoryboardOptions {
    storyboard: StoryboardProject;
    onSlotUpdate: (slotId: string, patch: Partial<StoryboardSlot>) => void;
    extractLastFrame: (videoUrl: string) => Promise<string>;
    generateVideo?: typeof VideoGeneration.generateVideo;
    waitForJob?: typeof VideoGeneration.waitForJob;
    model?: string;
}

const LOCAL_KEY_PREFIX = 'indii:storyboard:';

function storageKey(uid: string, projectId: string): string {
    return `${LOCAL_KEY_PREFIX}${uid}:${projectId}`;
}

function creativeDocId(uid: string, projectId: string): string {
    return `storyboard_${uid}_${projectId}`;
}

function getAuthenticatedUid(): string {
    return auth?.currentUser?.uid || 'anonymous';
}

function hasFirestoreDb(): boolean {
    return Boolean(db && typeof db === 'object' && Object.keys(db).length > 0);
}

/**
 * Sequentially renders every pending, prompted slot in a `StoryboardProject` in
 * timeline order so each slot with `useDaisyChain: true` receives the previous
 * slot's decoded final frame as its `firstFrame` visual anchor.
 */
export async function renderPendingStoryboardSlots(
    options: RenderPendingStoryboardOptions,
): Promise<StoryboardBatchRenderSummary> {
    const generateVideoFn = options.generateVideo ?? VideoGeneration.generateVideo.bind(VideoGeneration);
    const waitForJobFn = options.waitForJob ?? VideoGeneration.waitForJob.bind(VideoGeneration);
    const model = options.model ?? INTELLIGENCE_MODELS.VIDEO.PRO;

    const workingSlots: StoryboardSlot[] = options.storyboard.slots.map(slot => ({ ...slot }));
    const renderedSlotIds: string[] = [];
    const failedSlots: StoryboardBatchRenderSummary['failedSlots'] = [];
    let skippedEmptyPromptCount = 0;
    let alreadyCompletedCount = 0;

    for (let index = 0; index < workingSlots.length; index++) {
        const slot = workingSlots[index]!;

        if (slot.videoUrl) {
            alreadyCompletedCount++;
            continue;
        }
        if (!slot.prompt.trim()) {
            skippedEmptyPromptCount++;
            continue;
        }

        options.onSlotUpdate(slot.id, { isGenerating: true, progress: 10 });

        try {
            let firstFrame: string | undefined;
            if (slot.useDaisyChain && index > 0) {
                const prevSlot = workingSlots[index - 1];
                if (prevSlot?.videoUrl) {
                    firstFrame = await options.extractLastFrame(prevSlot.videoUrl);
                }
            }

            const results = await generateVideoFn({
                prompt: slot.prompt,
                resolution: '1080p',
                aspectRatio: '16:9',
                firstFrame,
                duration: slot.durationSeconds ?? 8,
                durationSeconds: slot.durationSeconds ?? 8,
                model,
            });

            const first = results[0];
            if (!first) {
                throw new Error('Video generation returned no job result.');
            }

            let videoUrl = first.url || '';
            let canonicalVideoUri: string | undefined;

            if (!videoUrl && first.id) {
                options.onSlotUpdate(slot.id, { progress: 40 });
                const completed = await waitForJobFn(first.id);
                videoUrl = completed.videoUrl || completed.output?.url || completed.url || '';
                canonicalVideoUri = completed.resultUri?.startsWith('gs://') ? completed.resultUri : undefined;
            }

            if (!videoUrl) {
                throw new Error(`Slot ${index + 1} completed without an output URL.`);
            }

            const patch: Partial<StoryboardSlot> = {
                isGenerating: false,
                progress: 100,
                videoUrl,
                ...(canonicalVideoUri ? { canonicalVideoUri } : {}),
            };
            workingSlots[index] = { ...slot, ...patch };
            options.onSlotUpdate(slot.id, patch);
            renderedSlotIds.push(slot.id);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`[StoryboardOrchestrator] Slot ${index + 1} failed:`, err);
            options.onSlotUpdate(slot.id, { isGenerating: false, progress: 0 });
            failedSlots.push({ slotId: slot.id, index, error: message });
        }
    }

    return {
        renderedSlotIds,
        skippedEmptyPromptCount,
        alreadyCompletedCount,
        failedSlots,
    };
}

/**
 * Persists a validated `StoryboardProject` to localStorage and mirrors to
 * Firestore `creative_sessions` when authenticated.
 */
export async function saveStoryboardProject(
    projectId: string,
    storyboard: StoryboardProject,
): Promise<void> {
    if (!projectId) return;
    const parsed = StoryboardProjectSchema.safeParse(storyboard);
    if (!parsed.success) return;

    const uid = getAuthenticatedUid();
    const payload = parsed.data;

    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem(storageKey(uid, projectId), JSON.stringify(payload));
        } catch {
            // Quota or private browsing restrictions should not block UI state.
        }
    }

    if (uid !== 'anonymous' && hasFirestoreDb()) {
        try {
            await setDoc(doc(db, 'creative_sessions', creativeDocId(uid, projectId)), {
                id: creativeDocId(uid, projectId),
                userId: uid,
                projectId,
                kind: 'storyboard',
                storyboard: payload,
                updatedAt: Date.now(),
            }, { merge: true });
        } catch (err) {
            logger.warn('[StoryboardOrchestrator] Firestore mirror save skipped:', err);
        }
    }
}

/**
 * Rehydrates a previously saved `StoryboardProject` from Firestore (if authenticated)
 * or localStorage, validating with `StoryboardProjectSchema`.
 */
export async function loadStoryboardProject(
    projectId: string,
): Promise<StoryboardProject | null> {
    if (!projectId) return null;
    const uid = getAuthenticatedUid();

    if (uid !== 'anonymous' && hasFirestoreDb()) {
        try {
            const snap = await getDoc(doc(db, 'creative_sessions', creativeDocId(uid, projectId)));
            if (snap.exists()) {
                const data = snap.data() as { storyboard?: unknown };
                const parsed = StoryboardProjectSchema.safeParse(data?.storyboard);
                if (parsed.success) return parsed.data;
            }
        } catch (err) {
            logger.warn('[StoryboardOrchestrator] Firestore load failed, falling back to local cache:', err);
        }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const raw = window.localStorage.getItem(storageKey(uid, projectId));
            if (!raw) return null;
            const parsed = StoryboardProjectSchema.safeParse(JSON.parse(raw));
            return parsed.success ? parsed.data : null;
        } catch {
            return null;
        }
    }

    return null;
}
