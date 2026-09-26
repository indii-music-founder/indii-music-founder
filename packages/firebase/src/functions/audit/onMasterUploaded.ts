import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { queueVerifiedAudioIngestion } from '../../distribution/ingestion';

/**
 * T1 — onMasterUploaded (P4; plan §3): closes gap A-1. A canonical master
 * landing at `masters/{uid}/{hash}/original.*` now starts verification and
 * DSP profiling AUTONOMOUSLY — the old flow required a user to open a UI
 * panel that called `processAudioIngestion`.
 *
 * Idempotency: the trigger is a no-op when the master already has a
 * verification proof or an analysis receipt (any generation) — the callable
 * path and this trigger converge on the same deduped pipeline, and the
 * engine-dsp receipt lease rejects double-processing.
 */

const MASTER_PATH = /^masters\/([^/]+)\/([0-9a-f]{64})\/original\.(wav|flac)$/;

export const onMasterUploaded = onObjectFinalized(
    { retry: false },
    async (event) => {
        const path = event.data.name;
        if (!path) return;
        const match = MASTER_PATH.exec(path);
        if (!match) return;
        const [, userId, contentHash] = match;

        const db = getFirestore();

        // 1. Already verified by the callable path? Verification proof exists.
        const verificationId = `master_${createVerificationHash(userId, path)}`;
        const verification = await db.collection('master_verifications').doc(verificationId).get();
        const verificationData = verification.data() as { status?: string } | undefined;
        if (verification.exists && verificationData?.['status'] === 'verified') {
            console.log(`[onMasterUploaded] ${path}: already verified — checking analysis state.`);
        }

        // 2. Already analyzed (or analyzing)? Skip — the receipt lease owns it.
        const receipts = await db
            .collection('audio_analysis_receipts')
            .where('userId', '==', userId)
            .where('contentHash', '==', contentHash)
            .limit(1)
            .get();
        if (!receipts.empty) {
            console.log(`[onMasterUploaded] ${path}: analysis receipt already exists — nothing to do.`);
            return;
        }

        // 3. Autonomous verification + DSP enqueue (reuses the canonical pipeline).
        try {
            const result = await queueVerifiedAudioIngestion(userId, {
                storagePath: path,
                masterFingerprint: `AUTOMATED-${contentHash.slice(0, 32)}`,
            });
            console.log(`[onMasterUploaded] ${path}: queued for DSP profiling (${result.status}).`);
        } catch (error: unknown) {
            // Configuration gaps (emulators, missing ENGINE_DSP_URL) must not
            // put the trigger in a crash loop — log loudly and yield.
            if (error instanceof HttpsError && error.code === 'failed-precondition') {
                console.error(`[onMasterUploaded] ${path}: ingestion pipeline not configured — ${error.message}`);
                return;
            }
            throw error;
        }
    },
);

function createVerificationHash(userId: string, storagePath: string): string {
    // Mirrors verificationId() in functions/storage/verifyMasterAudio.ts.
    return createHash('sha256').update(`${userId}\0${storagePath}`).digest('hex').slice(0, 48);
}
