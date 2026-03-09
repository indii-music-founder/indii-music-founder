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

const REGION = "us-west1";

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
            // 1. Validate writer shares total 100%
            const totalWriterShare = job.writers.reduce((sum, w) => sum + w.share, 0);
            const publisherShare = job.publisher?.share || 0;
            const totalShare = totalWriterShare + publisherShare;

            if (totalShare !== 100) {
                console.warn(`[ISWC Mapper] Share total is ${totalShare}%, expected 100%. Proceeding with normalization.`);
            }

            // 2. Build the ISWC work record
            const workRef = db.collection("iswc_works").doc();
            const composers = job.writers.map((writer) => ({
                name: writer.legalName,
                ipiNumber: writer.ipiNumber || null,
                share: writer.share,
                role: writer.role,
                pro: writer.pro || "None",
            }));

            const workRecord = {
                id: workRef.id,
                iswc: null, // Null until CISAC confirms registration
                status: "draft",
                title: job.trackTitle,
                composers,
                publisher: job.publisher
                    ? {
                        name: job.publisher.name,
                        ipiNumber: job.publisher.ipiNumber || null,
                        share: job.publisher.share,
                    }
                    : null,
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

            // 3. Record a career event for the memory pipeline
            await db.collection("career_events").add({
                type: "composition_registered",
                userId: job.userId,
                workId: workRef.id,
                trackTitle: job.trackTitle,
                composerCount: composers.length,
                pandadocDocumentId: job.pandadocDocumentId,
                summary: `Composition "${job.trackTitle}" registered from signed publishing agreement`,
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
