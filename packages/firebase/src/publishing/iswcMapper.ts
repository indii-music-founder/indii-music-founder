/**
 * ISWC Mapper — PandaDoc → Composition Registration
 *
 * Cloud Function triggered by the PandaDoc webhook when a self-publishing
 * agreement is signed. Extracts writer information (IPI, legal name, splits)
 * from the document tokens and creates an ISWC work registration record
 * in Firestore.
 *
 * This closes the loop: Legal agreement signed → Composition registered.
 *
 * Flow:
 * 1. pandadocWebhook.ts detects document.completed for a publishing agreement
 * 2. It calls iswcMapper via Firestore event (writes to iswc_mapper_queue)
 * 3. iswcMapper reads the queue, extracts writer data, creates ISWC work record
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const REGION = "us-central1";

/** Structure of a queued mapper job */
interface ISWCMapperJob {
    /** PandaDoc document ID that triggered this */
    pandadocDocumentId: string;

    /** PandaDoc document name */
    documentName: string;

    /** User who signed the document */
    userId: string;

    /** Writer/composer information extracted from PandaDoc tokens */
    writers: {
        legalName: string;
        ipiNumber?: string;
        pro?: string;
        share: number;
        role: "C" | "A" | "CA"; // Composer, Author, Both
    }[];

    /** Publisher information */
    publisher?: {
        name: string;
        ipiNumber?: string;
        share: number;
    };

    /** Associated track/release data */
    trackTitle: string;
    isrc?: string;
    releaseId?: string;

    /** ISO 8601 timestamp of when the agreement was signed */
    signedAt: string;
}

/**
 * Firestore-triggered function that processes ISWC mapping jobs.
 *
 * Listens for new documents in `iswc_mapper_queue/{docId}`.
 * When a PandaDoc publishing agreement is completed, the webhook
 * writes a job to this queue, and this function processes it.
 */
export const processISWCMapping = onDocumentCreated(
    {
        document: "iswc_mapper_queue/{jobId}",
        region: REGION,
        timeoutSeconds: 60,
        memory: "256MiB",
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            console.error("[ISWC Mapper] No data in event");
            return;
        }

        const job = snapshot.data() as ISWCMapperJob;
        const db = admin.firestore();

        console.log(`[ISWC Mapper] Processing: "${job.trackTitle}" from PandaDoc ${job.pandadocDocumentId}`);

        try {
            // 1. Validate writer shares total 100% (ISSUE-865).
            // Invalid splits must never silently pass through as if correct —
            // normalize explicitly and record the original figures so
            // downstream registration knows they need review.
            const totalWriterShare = job.writers.reduce((sum, w) => sum + w.share, 0);
            const publisherShare = job.publisher?.share || 0;
            const originalTotalShare = totalWriterShare + publisherShare;
            const splitsValid = originalTotalShare === 100;

            let composers = job.writers.map((writer) => ({
                name: writer.legalName,
                ipiNumber: writer.ipiNumber || null,
                share: writer.share,
                role: writer.role,
                pro: writer.pro || "None",
            }));
            let normalizedPublisherShare = job.publisher?.share ?? null;

            if (!splitsValid && originalTotalShare > 0) {
                // Proportionally normalize to 100 so downstream records are usable,
                // but the record stays clearly marked as normalized-not-verified.
                const scale = 100 / originalTotalShare;
                composers = composers.map((c) => ({ ...c, share: Math.round(c.share * scale * 100) / 100 }));
                normalizedPublisherShare = job.publisher ? Math.round(job.publisher.share * scale * 100) / 100 : null;
                console.warn(`[ISWC Mapper] Share total was ${originalTotalShare}%, expected 100%. Normalized proportionally; original figures preserved for review.`);
            } else if (!splitsValid) {
                console.warn(`[ISWC Mapper] Share total was ${originalTotalShare}% (degenerate, cannot normalize). Recording as invalid splits requiring correction.`);
            }

            // 2. Build the ISWC work record
            const workRef = db.collection("iswc_works").doc();

            const workRecord = {
                id: workRef.id,
                iswc: null, // Null until CISAC confirms registration
                status: splitsValid ? "draft" : (originalTotalShare > 0 ? "draft_splits_normalized" : "draft_invalid_splits"),
                title: job.trackTitle,
                composers,
                publisher: job.publisher
                    ? {
                        name: job.publisher.name,
                        ipiNumber: job.publisher.ipiNumber || null,
                        share: normalizedPublisherShare,
                    }
                    : null,
                splitsValid,
                originalTotalShare,
                associatedISRCs: job.isrc ? [job.isrc] : [],
                releaseId: job.releaseId || null,
                isInstrumental: false,
                userId: job.userId,
                source: "pandadoc_agreement",
                pandadocDocumentId: job.pandadocDocumentId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await workRef.set(workRecord);
            console.log(`[ISWC Mapper] Created ISWC work record: ${workRef.id} for "${job.trackTitle}"`);

            // 3. Record a career event for the memory pipeline.
            // ISSUE-865: this is a DRAFT internal record, not a PRO/CISAC/MLC
            // registration — the event type and summary must never claim
            // "registered" until an external registration confirms an ISWC.
            await db.collection("career_events").add({
                type: "composition_draft_created",
                userId: job.userId,
                workId: workRef.id,
                trackTitle: job.trackTitle,
                composerCount: composers.length,
                splitsValid,
                pandadocDocumentId: job.pandadocDocumentId,
                summary: splitsValid
                    ? `Draft composition record created for "${job.trackTitle}" from signed publishing agreement — not yet registered with a PRO/CISAC.`
                    : `Draft composition record created for "${job.trackTitle}" with invalid splits (${originalTotalShare}%, expected 100%) — requires correction before registration.`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 4. Mark the mapper job as processed
            await snapshot.ref.update({
                status: "processed",
                workId: workRef.id,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[ISWC Mapper] Job complete for "${job.trackTitle}"`);
        } catch (error) {
            console.error("[ISWC Mapper] Error:", error);

            // Mark job as failed
            await snapshot.ref.update({
                status: "failed",
                error: String(error),
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
);
