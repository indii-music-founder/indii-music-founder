import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { VideoProject } from '../store/videoEditorStore';

/**
 * ISSUE-1147: one persisted document per app-project ID, so refreshing or
 * switching app projects can no longer erase or cross-contaminate a timeline.
 *
 * ISSUE-1193/1195/1197 (repair-order step 1): the original version of this file
 * returned `null` both for "this project has no timeline yet" and for "the read
 * failed". Callers could not tell those apart, so a transient permission or
 * network error presented the user with a blank timeline — and their next edit
 * autosaved that blank over the real document.
 *
 * The ambiguity is now removed at the type level rather than guarded against at
 * runtime:
 *
 *   - `loadVideoProject` returns a discriminated `TimelineLoad`. The `'error'`
 *     branch carries NO `WriteToken`.
 *   - `saveVideoProject` REQUIRES a `WriteToken`, and a token can only be
 *     produced by a load that actually established what is stored.
 *
 * So "save a timeline we never successfully read" is not a bug to remember to
 * guard — it does not typecheck.
 *
 * The token also carries the `revision` that was read, and the save runs as a
 * compare-and-swap inside a transaction. That additionally closes the
 * second-tab / stale-async overwrite cases, where two writers each hold a valid
 * token but one is working from a stale baseline.
 *
 * ISSUE-1197: documents are namespaced under the owner
 * (`users/{uid}/videoProjects/{projectId}`) so one user's project-id space
 * cannot collide with another's. Whether ids are guessable stops being
 * load-bearing. Legacy top-level `videoProjects/{projectId}` docs are still
 * read (owner-checked) and migrated on first save; they are never written again.
 */

/** Proof that we established what is stored for a project. Unforgeable outside this module. */
declare const writeTokenProof: unique symbol;
export interface WriteToken {
    readonly [writeTokenProof]: true;
    readonly projectId: string;
    /** Revision observed at load time. `null` means "no document existed". */
    readonly revision: number | null;
    /** True when the content came from the pre-namespacing top-level collection. */
    readonly fromLegacy: boolean;
}

export type TimelineLoad =
    | { status: 'found'; project: VideoProject; token: WriteToken }
    | { status: 'absent'; token: WriteToken }
    | { status: 'error'; error: unknown };

export interface VideoProjectSaveResult {
    success: boolean;
    reason?: string;
    /** Advanced token to use for the next save. Only present on success. */
    token?: WriteToken;
    lastModified?: Date;
}

const LEGACY_COLLECTION = 'videoProjects';

const ownedDoc = (uid: string, projectId: string) =>
    doc(db, 'users', uid, 'videoProjects', projectId);

const legacyDoc = (projectId: string) => doc(db, LEGACY_COLLECTION, projectId);

const mintToken = (projectId: string, revision: number | null, fromLegacy: boolean): WriteToken =>
    ({ projectId, revision, fromLegacy } as WriteToken);

const isPermissionDenied = (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { code?: string }).code === 'permission-denied';

/**
 * Establish what is stored for `projectId`. Every failure is reported as
 * `'error'` — never as an empty project.
 */
export async function loadVideoProject(projectId: string, uid: string): Promise<TimelineLoad> {
    let ownedSnap;
    try {
        ownedSnap = await getDoc(ownedDoc(uid, projectId));
    } catch (error: unknown) {
        logger.error(`[VideoProjectPersistence] Failed to read owned project ${projectId}:`, error);
        return { status: 'error', error };
    }

    if (ownedSnap.exists()) {
        const data = ownedSnap.data();
        const project = data.project as VideoProject | undefined;
        if (!project) {
            // A document that exists but carries no timeline is corrupt, not empty.
            // Reporting it as absent would let the next save overwrite it.
            const error = new Error(`Project document ${projectId} has no \`project\` field.`);
            logger.error('[VideoProjectPersistence]', error);
            return { status: 'error', error };
        }
        return {
            status: 'found',
            project,
            token: mintToken(projectId, typeof data.revision === 'number' ? data.revision : 0, false),
        };
    }

    // No owned document yet — check for a pre-namespacing one to migrate.
    try {
        const legacySnap = await getDoc(legacyDoc(projectId));
        if (legacySnap.exists()) {
            const data = legacySnap.data();
            const project = data.project as VideoProject | undefined;
            if (project && data.userId === uid) {
                // Migrate on first save: the owned document does not exist yet, so the
                // baseline is `null`. The legacy document is left untouched.
                return { status: 'found', project, token: mintToken(projectId, null, true) };
            }
        }
    } catch (error: unknown) {
        if (!isPermissionDenied(error)) {
            logger.error(`[VideoProjectPersistence] Failed to read legacy project ${projectId}:`, error);
            return { status: 'error', error };
        }
        // Denied means the legacy document is not ours (ISSUE-1197 squat, or another
        // account's project of the same id). Our own namespace is authoritative and
        // empty, and we never write to the legacy path — so this is genuinely absent.
        logger.warn(`[VideoProjectPersistence] Legacy project ${projectId} is not readable by this user; starting fresh in the owned namespace.`);
    }

    return { status: 'absent', token: mintToken(projectId, null, false) };
}

/**
 * Persist a timeline. Callable only with a `WriteToken`, and only when the
 * stored revision still matches the one that token observed.
 */
export async function saveVideoProject(
    token: WriteToken,
    project: VideoProject,
    userId: string,
    orgId: string | null,
): Promise<VideoProjectSaveResult> {
    if (!userId) {
        const reason = 'Auto-save skipped: missing authenticated user.';
        logger.warn(`[VideoProjectPersistence] ${reason}`);
        return { success: false, reason };
    }
    if (token.projectId !== project.id) {
        // A token is bound to the project it was minted for. Mismatch means the
        // store switched projects mid-flight; writing here would put one
        // project's timeline into another's document.
        const reason = `Auto-save refused: token is for ${token.projectId}, project is ${project.id}.`;
        logger.error(`[VideoProjectPersistence] ${reason}`);
        return { success: false, reason };
    }

    const ref = ownedDoc(userId, project.id);

    // CAS commit against a specific revision token. Throws ConflictError when
    // the stored revision has moved on (another tab/device wrote first).
    const commit = async (currentToken: WriteToken): Promise<WriteToken> => {
        const nextRevision = await runTransaction(db, async tx => {
            const snap = await tx.get(ref);
            const storedRevision = snap.exists()
                ? (typeof snap.data().revision === 'number' ? (snap.data().revision as number) : 0)
                : null;

            if (storedRevision !== currentToken.revision) {
                throw new ConflictError(
                    `Stored revision ${storedRevision} no longer matches the loaded revision ${currentToken.revision}.`
                );
            }

            const revision = (storedRevision ?? 0) + 1;
            tx.set(
                ref,
                {
                    id: project.id,
                    userId,
                    orgId,
                    project,
                    revision,
                    lastModified: serverTimestamp(),
                    ...(storedRevision === null ? { createdAt: serverTimestamp() } : {}),
                },
                { merge: true }
            );
            return revision;
        });
        return mintToken(project.id, nextRevision, false);
    };

    try {
        return {
            success: true,
            token: await commit(token),
            lastModified: new Date(),
        };
    } catch (err: unknown) {
        // CAS conflict: another writer (second tab, another device) committed a
        // revision this token never observed. Same-instance saves are
        // serialized by the hook, so this means the stored document genuinely
        // moved on — refresh the token from the document and retry ONCE rather
        // than surfacing a failure for a save that is still perfectly writable.
        // Without this recovery the token would stay stale forever and every
        // subsequent save would conflict, permanently wedging autosave.
        if (err instanceof ConflictError) {
            logger.warn(
                `[VideoProjectPersistence] Revision conflict on save (token revision ${token.revision}); refreshing token and retrying once.`
            );
            const reload = await loadVideoProject(project.id, userId);
            if (reload.status === 'error') {
                return {
                    success: false,
                    reason: 'Could not re-read the project to resolve a save conflict.',
                };
            }
            try {
                return {
                    success: true,
                    token: await commit(reload.token),
                    lastModified: new Date(),
                };
            } catch (retryErr: unknown) {
                const retryReason = retryErr instanceof Error ? retryErr.message : 'Auto-save failed';
                logger.error(`[VideoProjectPersistence] Conflict retry failed for project ${project.id}:`, retryErr);
                return { success: false, reason: retryReason };
            }
        }
        const reason = err instanceof Error ? err.message : 'Auto-save failed';
        logger.error(`[VideoProjectPersistence] Failed to save project ${project.id}:`, err);
        return { success: false, reason };
    }
}

/** Raised when the stored revision has moved on since the token was minted. */
export class ConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConflictError';
    }
}
