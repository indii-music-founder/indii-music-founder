/**
 * Storage Maintenance Functions
 *
 * Scheduled Cloud Functions for long-term storage health:
 * 1. Orphan Cleanup — deletes Storage files with no matching Firestore document
 * 2. Storage Quota Tracking — calculates per-user storage usage and enforces limits
 *
 * These run on a schedule (daily/weekly) and help control storage costs.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// ============================================================================
// Configuration
// ============================================================================

/** Storage paths to audit for orphaned files */
const AUDITABLE_PREFIXES = [
    "videos/",
    "video-thumbnails/",
    "users/",
    "creative/",
];

/** Per-tier storage limits in bytes (referenced by client-side StorageQuotaService) */
const _STORAGE_LIMITS: Record<string, number> = {
    free: 5 * 1024 * 1024 * 1024,          // 5 GB
    pro: 100 * 1024 * 1024 * 1024,          // 100 GB
    enterprise: 1024 * 1024 * 1024 * 1024,  // 1 TB
};
void _STORAGE_LIMITS; // Exported as documentation — used by client-side quota display

/** Max age (in days) before a video is flagged for archival */
const ARCHIVE_THRESHOLD_DAYS = 90;

/** Max age (in days) before temp creative video assets are deleted */
const TEMP_VIDEO_TTL_DAYS = 1;

type StorageFileMetadata = {
    metadata?: Record<string, string | undefined>;
    timeCreated?: string;
};

function parseStorageFileDate(metadata: StorageFileMetadata): Date | null {
    const generatedAt = metadata.metadata?.generatedAt;
    if (typeof generatedAt === 'string') {
        const parsed = new Date(generatedAt);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (metadata.timeCreated) {
        const parsed = new Date(metadata.timeCreated);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function isExpiredStorageFile(cutoffDate: Date, metadata: StorageFileMetadata): boolean {
    const fileDate = parseStorageFileDate(metadata);
    return !!fileDate && fileDate < cutoffDate;
}

function isCreativeVideoTempPath(path: string): boolean {
    const pathParts = path.split("/");
    return pathParts.length >= 6 &&
        pathParts[0] === "creative" &&
        pathParts[2] === "video" &&
        pathParts[3] === "tmp";
}

// ============================================================================
// 1. Orphan Cleanup (Scheduled — runs weekly)
// ============================================================================

/**
 * cleanupOrphanedVideos
 *
 * Scans the `videos/{userId}/` prefix in Firebase Storage and cross-references
 * each file against the `history` Firestore collection. If a Storage file has
 * no matching Firestore document, it is orphaned and can be safely deleted.
 *
 * Safety mechanisms:
 * - DRY RUN by default (logs orphans without deleting)
 * - Configurable via Firestore `config/storageMaintenance.enableDeletion`
 * - Writes an audit log to `admin/storageMaintenance/runs/{timestamp}`
 * - Processes in batches to avoid memory pressure
 *
 * Schedule: Every Sunday at 3:00 AM UTC
 */
export const cleanupOrphanedVideos = onSchedule(
    {
        region: "us-central1",
        schedule: "every sunday 03:00",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "1GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async () => {
        const startTime = Date.now();
        console.log("[StorageMaintenance] Starting orphan cleanup scan...");

        // Check if deletion is enabled (default: dry run only)
        const configDoc = await admin.firestore()
            .collection("admin")
            .doc("storageMaintenance")
            .get();
        const enableDeletion = configDoc.data()?.enableDeletion === true;

        if (!enableDeletion) {
            console.log("[StorageMaintenance] Running in DRY RUN mode. Set admin/storageMaintenance.enableDeletion=true to enable.");
        }

        const bucket = admin.storage().bucket();
        let totalFiles = 0;
        let orphanCount = 0;
        let deletedCount = 0;
        let errorCount = 0;
        const orphanPaths: string[] = [];

        // Process the videos/ prefix
        try {
            const [files] = await bucket.getFiles({ prefix: "videos/", maxResults: 5000 });
            totalFiles = files.length;
            console.log(`[StorageMaintenance] Found ${totalFiles} files in videos/`);

            // Process files in batches to avoid N+1 queries
            const CHUNK_SIZE = 100;
            for (let i = 0; i < files.length; i += CHUNK_SIZE) {
                const chunkFiles = files.slice(i, i + CHUNK_SIZE);

                // Extract valid job IDs and their corresponding files
                // Path format: videos/{userId}/{jobId}.mp4
                const fileInfos: { file: typeof files[0]; jobId: string }[] = [];
                for (const file of chunkFiles) {
                    const pathParts = file.name.split("/");
                    if (pathParts.length < 3) continue;

                    const jobId = pathParts[2].replace(/\.mp4$/, "");
                    fileInfos.push({ file, jobId });
                }

                if (fileInfos.length === 0) continue;

                // Create document references for batch fetch
                // Deduplicate job IDs to avoid fetching the same document multiple times
                const uniqueJobIds = Array.from(new Set(fileInfos.map((info) => info.jobId)));

                const historyRefs = uniqueJobIds.map((jobId) =>
                    admin.firestore().collection("history").doc(jobId)
                );
                const jobRefs = uniqueJobIds.map((jobId) =>
                    admin.firestore().collection("videoJobs").doc(jobId)
                );

                // Fetch documents in batch
                const [historyDocs, jobDocs] = await Promise.all([
                    admin.firestore().getAll(...historyRefs),
                    admin.firestore().getAll(...jobRefs),
                ]);

                // Create lookup maps for fast access
                const historyExists = new Set(historyDocs.filter((doc) => doc.exists).map((doc) => doc.id));
                const jobExists = new Set(jobDocs.filter((doc) => doc.exists).map((doc) => doc.id));

                for (const { file, jobId } of fileInfos) {
                    if (!historyExists.has(jobId) && !jobExists.has(jobId)) {
                        orphanCount++;
                        orphanPaths.push(file.name);

                        if (enableDeletion) {
                            try {
                                await file.delete();
                                deletedCount++;
                                console.log(`[StorageMaintenance] Deleted orphan: ${file.name}`);
                            } catch (delErr) {
                                errorCount++;
                                console.error(`[StorageMaintenance] Failed to delete ${file.name}:`, delErr);
                            }
                        } else {
                            console.log(`[StorageMaintenance] [DRY RUN] Would delete: ${file.name}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[StorageMaintenance] Error scanning videos/:", err);
            errorCount++;
        }

        // Write audit log
        const runId = new Date().toISOString().replace(/[:.]/g, "-");
        await admin.firestore()
            .collection("admin")
            .doc("storageMaintenance")
            .collection("runs")
            .doc(runId)
            .set({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                durationMs: Date.now() - startTime,
                totalFiles,
                orphanCount,
                deletedCount,
                errorCount,
                dryRun: !enableDeletion,
                orphanPaths: orphanPaths.slice(0, 100), // Cap at 100 for Firestore doc size
            });

        console.log(`[StorageMaintenance] Cleanup complete. 
            Total: ${totalFiles}, Orphans: ${orphanCount}, Deleted: ${deletedCount}, Errors: ${errorCount}
            Duration: ${Date.now() - startTime}ms`);
    });


// ============================================================================
// 2. Storage Quota Tracking (Scheduled — runs daily)
// ============================================================================

/**
 * trackStorageQuotas
 *
 * Calculates per-user storage usage by scanning Firebase Storage prefixes
 * and writes the totals to `users/{userId}/usage/storage`.
 *
 * This enables:
 * - Dashboard display of "X GB of Y GB used"
 * - Pre-upload quota checks on the client
 * - Alerting when users approach their limit
 *
 * Schedule: Every day at 2:00 AM UTC
 */
export const trackStorageQuotas = onSchedule(
    {
        region: "us-central1",
        schedule: "every day 02:00",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "1GiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async () => {
        const startTime = Date.now();
        console.log("[StorageQuota] Starting daily quota scan...");

        const bucket = admin.storage().bucket();
        const userUsage: Record<string, { totalBytes: number; fileCount: number; videoCount: number; imageCount: number }> = {};

        // Scan each auditable prefix
        for (const prefix of AUDITABLE_PREFIXES) {
            try {
                const [files] = await bucket.getFiles({ prefix, maxResults: 10000 });

                for (const file of files) {
                    // Extract userId from the path
                    // videos/{userId}/... → userId at index 1
                    // users/{userId}/... → userId at index 1
                    // video-thumbnails/{userId}/... → userId at index 1
                    // creative/{userId}/... → userId at index 1
                    const pathParts = file.name.split("/");
                    if (pathParts.length < 2) continue;

                    const userId = pathParts[1];
                    if (!userId) continue;

                    if (!userUsage[userId]) {
                        userUsage[userId] = { totalBytes: 0, fileCount: 0, videoCount: 0, imageCount: 0 };
                    }

                    const metadata = file.metadata;
                    const size = parseInt(String(metadata.size || "0"), 10);
                    userUsage[userId].totalBytes += size;
                    userUsage[userId].fileCount++;

                    // Categorize by type
                    const contentType = String(metadata.contentType || "");
                    if (contentType.startsWith("video/")) {
                        userUsage[userId].videoCount++;
                    } else if (contentType.startsWith("image/")) {
                        userUsage[userId].imageCount++;
                    }
                }
            } catch (err) {
                console.error(`[StorageQuota] Error scanning ${prefix}:`, err);
            }
        }

        // Write per-user usage to Firestore
        const batch = admin.firestore().batch();
        let userCount = 0;

        for (const [userId, usage] of Object.entries(userUsage)) {
            const usageRef = admin.firestore()
                .collection("users")
                .doc(userId)
                .collection("usage")
                .doc("storage");

            batch.set(usageRef, {
                totalBytes: usage.totalBytes,
                totalMB: Math.round(usage.totalBytes / (1024 * 1024)),
                totalGB: parseFloat((usage.totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
                fileCount: usage.fileCount,
                videoCount: usage.videoCount,
                imageCount: usage.imageCount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                scanDate: new Date().toISOString().split("T")[0],
            }, { merge: true });

            userCount++;
        }

        await batch.commit();

        console.log(`[StorageQuota] Quota scan complete. 
            Users: ${userCount}, Duration: ${Date.now() - startTime}ms`);
    });


// ============================================================================
// 3. Temp Creative Video Cleanup
// ============================================================================

/**
 * cleanupExpiredVideoTemps
 *
 * Deletes temp creative video assets older than TEMP_VIDEO_TTL_DAYS.
 * Temp assets are expected under creative/{userId}/video/tmp/{sessionId}/...
 *
 * Schedule: Every day at 1:30 AM UTC
 */
export const cleanupExpiredVideoTemps = onSchedule(
    {
        region: "us-central1",
        schedule: "every day 01:30",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async () => {
        const startTime = Date.now();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TEMP_VIDEO_TTL_DAYS);

        console.log(`[TempVideoCleanup] Removing temp creative video assets older than ${TEMP_VIDEO_TTL_DAYS} day(s)...`);

        const bucket = admin.storage().bucket();
        let scanned = 0;
        let deleted = 0;
        let errorCount = 0;

        try {
            const [files] = await bucket.getFiles({ prefix: "creative/", maxResults: 10000 });
            scanned = files.length;

            for (const file of files) {
                if (!isCreativeVideoTempPath(file.name)) continue;
                if (!isExpiredStorageFile(cutoffDate, file.metadata as StorageFileMetadata)) continue;

                try {
                    await file.delete();
                    deleted++;
                } catch (err) {
                    errorCount++;
                    console.error(`[TempVideoCleanup] Failed to delete ${file.name}:`, err);
                }
            }
        } catch (err) {
            errorCount++;
            console.error("[TempVideoCleanup] Error scanning creative/:", err);
        }

        console.log(`[TempVideoCleanup] Complete. Scanned: ${scanned}, Deleted: ${deleted}, Errors: ${errorCount}, Duration: ${Date.now() - startTime}ms`);
    });


// ============================================================================
// 4. Archive Old Videos (Metadata Flagging)
// ============================================================================

/**
 * flagVideosForArchival
 *
 * Scans the `videos/` prefix and flags files older than ARCHIVE_THRESHOLD_DAYS
 * by setting a custom metadata field `archiveEligible: "true"`.
 *
 * This metadata field can then be used by a GCS Object Lifecycle Policy
 * to automatically transition files to Nearline or Coldline storage class.
 *
 * Schedule: First of each month at 4:00 AM UTC
 */
export const flagVideosForArchival = onSchedule(
    {
        region: "us-central1",
        schedule: "1 of month 04:00",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async () => {
        const startTime = Date.now();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS);

        console.log(`[ArchiveFlag] Flagging videos older than ${ARCHIVE_THRESHOLD_DAYS} days (before ${cutoffDate.toISOString()})...`);

        const bucket = admin.storage().bucket();
        let scanned = 0;
        let flagged = 0;

        try {
            const [files] = await bucket.getFiles({ prefix: "videos/", maxResults: 10000 });
            scanned = files.length;

            for (const file of files) {
                const metadata = file.metadata;

                // Skip files already flagged
                if (metadata.metadata?.archiveEligible === "true") continue;

                if (isExpiredStorageFile(cutoffDate, metadata as StorageFileMetadata)) {
                    try {
                        await file.setMetadata({
                            metadata: {
                                ...metadata.metadata,
                                archiveEligible: "true",
                                archiveFlaggedAt: new Date().toISOString(),
                            },
                        });
                        flagged++;
                    } catch (err) {
                        console.error(`[ArchiveFlag] Failed to flag ${file.name}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error("[ArchiveFlag] Error scanning videos/:", err);
        }

        console.log(`[ArchiveFlag] Complete. Scanned: ${scanned}, Flagged: ${flagged}, Duration: ${Date.now() - startTime}ms`);
    });
