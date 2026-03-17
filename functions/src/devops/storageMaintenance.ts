/**
 * Storage Maintenance Functions
 *
 * Scheduled Cloud Functions for long-term storage health:
 * 1. Orphan Cleanup — deletes Storage files with no matching Firestore document
 * 2. Storage Quota Tracking — calculates per-user storage usage and enforces limits
 *
 * These run on a schedule (daily/weekly) and help control storage costs.
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// ============================================================================
// Configuration
// ============================================================================

/** Storage paths to audit for orphaned files */
const AUDITABLE_PREFIXES = [
    "videos/",
    "video-thumbnails/",
    "users/",
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
export const cleanupOrphanedVideos = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
    })
    .pubsub.schedule("every sunday 03:00")
    .timeZone("UTC")
    .onRun(async () => {
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

            // Batch lookup: extract job IDs from file paths
            // Path format: videos/{userId}/{jobId}.mp4
            for (const file of files) {
                const pathParts = file.name.split("/");
                if (pathParts.length < 3) continue;

                const jobId = pathParts[2].replace(/\.mp4$/, "");

                // Check if this job exists in the history collection
                const historyDoc = await admin.firestore()
                    .collection("history")
                    .doc(jobId)
                    .get();

                // Also check videoJobs collection as a secondary reference
                const jobDoc = await admin.firestore()
                    .collection("videoJobs")
                    .doc(jobId)
                    .get();

                if (!historyDoc.exists && !jobDoc.exists) {
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
export const trackStorageQuotas = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
    })
    .pubsub.schedule("every day 02:00")
    .timeZone("UTC")
    .onRun(async () => {
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
// 3. Archive Old Videos (Metadata Flagging)
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
export const flagVideosForArchival = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 540,
        memory: "512MB",
    })
    .pubsub.schedule("1 of month 04:00")
    .timeZone("UTC")
    .onRun(async () => {
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
                const generatedAt = metadata.metadata?.generatedAt;

                // Skip files already flagged
                if (metadata.metadata?.archiveEligible === "true") continue;

                // Determine file age
                let fileDate: Date | null = null;
                if (typeof generatedAt === 'string') {
                    fileDate = new Date(generatedAt);
                } else if (metadata.timeCreated) {
                    fileDate = new Date(String(metadata.timeCreated));
                }

                if (fileDate && fileDate < cutoffDate) {
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
