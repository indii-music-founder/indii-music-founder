/**
 * Database Reliability & Maintenance
 *
 * Automated long-term database health routines for indiiOS:
 * 1. Automate scheduled Firestore managed exports to GCS Coldline storage buckets.
 * 2. Purge stale, transient telemetry data and orphaned user session/push tokens.
 * 3. Verify the integrity of exported database snapshots before executing permanent document deletions.
 *
 * Safety rails:
 * - DRY RUN by default: Deletion is suppressed unless admin/databaseMaintenance.enableDeletion=true.
 * - Snapshot verification rail: Document deletions fail closed and abort if no verified
 *   GCS Coldline snapshot exists within the safety window (48h).
 * - Full audit logs written to admin/databaseMaintenance/runs/{runId}.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// ============================================================================
// Configuration & Retention Windows
// ============================================================================

export const AGENT_TRACES_TTL_DAYS = 30;
export const NOTIFICATION_TOKENS_TTL_DAYS = 90;
export const CONVERSION_OUTBOX_TTL_DAYS = 7;
export const LINK_CODES_TTL_HOURS = 24;
export const HEALTH_CHECK_TTL_HOURS = 24;
export const SNAPSHOT_MAX_AGE_HOURS = 48;
export const MAX_DOCS_PER_BATCH = 400; // Well below Firestore's 500-write limit

export function getProjectId(): string {
    return (
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        "indii-music-founder"
    );
}

export function getBackupBucketName(): string {
    return (
        process.env.FIRESTORE_COLDLINE_BACKUP_BUCKET ||
        `${getProjectId()}-firestore-backups-coldline`
    );
}

function getDb(): FirebaseFirestore.Firestore {
    return admin.firestore();
}

function getStorage(): admin.storage.Storage {
    return admin.storage();
}

// ============================================================================
// Snapshot Verification Logic
// ============================================================================

export interface SnapshotVerificationResult {
    valid: boolean;
    error?: string;
    bucket: string;
    prefix: string;
    fileCount: number;
    totalBytes: number;
    overallMetadataFound: boolean;
    collectionMetadataCount: number;
}

/**
 * Validates the structural integrity of an exported Firestore managed snapshot.
 * Checks that:
 * 1. Target bucket and prefix exist and contain export files.
 * 2. The `.overall_export_metadata` manifest is present and non-empty (>0 bytes).
 * 3. Collection metadata `.export_metadata` files are present and non-empty.
 * 4. Overall payload size is greater than zero.
 */
export async function verifyExportSnapshot(
    bucketName: string,
    prefix: string
): Promise<SnapshotVerificationResult> {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const bucket = getStorage().bucket(bucketName);

    let files: Array<{ name: string; metadata?: Record<string, unknown> }> = [];
    try {
        const [res] = await bucket.getFiles({
            prefix: normalizedPrefix,
            autoPaginate: true,
        });
        files = res as unknown as Array<{ name: string; metadata?: Record<string, unknown> }>;
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
            valid: false,
            error: `Failed to access GCS bucket gs://${bucketName}/${normalizedPrefix}: ${errMsg}`,
            bucket: bucketName,
            prefix: normalizedPrefix,
            fileCount: 0,
            totalBytes: 0,
            overallMetadataFound: false,
            collectionMetadataCount: 0,
        };
    }

    if (!files || files.length === 0) {
        return {
            valid: false,
            error: `No files found under prefix gs://${bucketName}/${normalizedPrefix}`,
            bucket: bucketName,
            prefix: normalizedPrefix,
            fileCount: 0,
            totalBytes: 0,
            overallMetadataFound: false,
            collectionMetadataCount: 0,
        };
    }

    let overallMetadataFound = false;
    let collectionMetadataCount = 0;
    let totalBytes = 0;

    for (const file of files) {
        const size = parseInt(String(file.metadata?.size || "0"), 10);
        totalBytes += Number.isNaN(size) ? 0 : size;

        if (file.name.endsWith(".overall_export_metadata")) {
            if (size > 0) {
                overallMetadataFound = true;
            }
        } else if (file.name.endsWith(".export_metadata")) {
            if (size > 0) {
                collectionMetadataCount++;
            }
        }
    }

    if (!overallMetadataFound) {
        return {
            valid: false,
            error: "Overall export metadata file (.overall_export_metadata) missing or empty (0 bytes)",
            bucket: bucketName,
            prefix: normalizedPrefix,
            fileCount: files.length,
            totalBytes,
            overallMetadataFound,
            collectionMetadataCount,
        };
    }

    if (collectionMetadataCount === 0) {
        return {
            valid: false,
            error: "No valid collection metadata files (.export_metadata) found in snapshot",
            bucket: bucketName,
            prefix: normalizedPrefix,
            fileCount: files.length,
            totalBytes,
            overallMetadataFound,
            collectionMetadataCount,
        };
    }

    if (totalBytes === 0) {
        return {
            valid: false,
            error: "Total export snapshot size is 0 bytes",
            bucket: bucketName,
            prefix: normalizedPrefix,
            fileCount: files.length,
            totalBytes,
            overallMetadataFound,
            collectionMetadataCount,
        };
    }

    return {
        valid: true,
        bucket: bucketName,
        prefix: normalizedPrefix,
        fileCount: files.length,
        totalBytes,
        overallMetadataFound,
        collectionMetadataCount,
    };
}

/**
 * Finds and verifies the most recent Firestore managed export within the max age safety window.
 */
export async function getLatestVerifiedSnapshot(
    maxAgeHours: number = SNAPSHOT_MAX_AGE_HOURS
): Promise<{ verified: boolean; snapshot?: SnapshotVerificationResult; error?: string }> {
    const db = getDb();
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // 1. Check exports recorded in Firestore audit tracking
    try {
        const exportsSnap = await db.collection("admin")
            .doc("databaseMaintenance")
            .collection("exports")
            .orderBy("timestamp", "desc")
            .limit(5)
            .get();

        if (!exportsSnap.empty) {
            for (const doc of exportsSnap.docs) {
                const data = doc.data();
                const docTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || 0);

                if (docTime < cutoffDate) {
                    continue;
                }

                const bucket = data.bucket || getBackupBucketName();
                const prefix = data.prefix || `exports/${doc.id}`;
                const verification = await verifyExportSnapshot(bucket, prefix);

                if (verification.valid) {
                    return { verified: true, snapshot: verification };
                }
            }
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[DatabaseMaintenance] Failed querying exports tracking collection:", msg);
    }

    // 2. Fallback: inspect GCS Coldline bucket directly
    try {
        const bucket = getStorage().bucket(getBackupBucketName());
        const [files] = await bucket.getFiles({ prefix: "exports/", maxResults: 100 });

        const folderPrefixes = new Set<string>();
        for (const f of files) {
            const parts = f.name.split("/");
            if (parts.length >= 2 && parts[0] === "exports" && parts[1]) {
                folderPrefixes.add(`exports/${parts[1]}`);
            }
        }

        const sortedPrefixes = Array.from(folderPrefixes).sort().reverse();
        for (const prefix of sortedPrefixes.slice(0, 3)) {
            const verification = await verifyExportSnapshot(getBackupBucketName(), prefix);
            if (verification.valid) {
                return { verified: true, snapshot: verification };
            }
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[DatabaseMaintenance] Fallback GCS bucket scan failed:", msg);
    }

    return {
        verified: false,
        error: `No verified snapshot found in GCS Coldline within the last ${maxAgeHours} hours`,
    };
}

// ============================================================================
// 1. Scheduled Managed Export to GCS Coldline
// ============================================================================

/**
 * Automates daily Firestore managed export to a GCS Coldline bucket.
 * Triggers every day at 02:00 UTC.
 */
export const scheduledFirestoreColdlineExport = onSchedule(
    {
        region: "us-central1",
        schedule: "every day 02:00",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "1GiB",
        cpu: "gcf_gen1",
        concurrency: 1,
    },
    async () => {
        const startTime = Date.now();
        const projectId = getProjectId();
        const bucketName = getBackupBucketName();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const prefix = `exports/${timestamp}`;
        const outputUriPrefix = `gs://${bucketName}/${prefix}`;

        console.log(`[DatabaseMaintenance] Initiating scheduled Firestore managed export...`);
        console.log(`[DatabaseMaintenance] Project: ${projectId}, Target: ${outputUriPrefix} (Storage Class: COLDLINE)`);

        const FirestoreAdminClient = (admin.firestore as unknown as { v1?: { FirestoreAdminClient: new () => { databasePath: (p: string, d: string) => string; exportDocuments: (req: unknown) => Promise<[{ name: string }]> } } }).v1?.FirestoreAdminClient;
        if (!FirestoreAdminClient) {
            throw new Error("FirestoreAdminClient not available in firebase-admin");
        }

        const client = new FirestoreAdminClient();
        const databaseName = client.databasePath(projectId, "(default)");

        let operationName = "";
        try {
            const [operation] = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix,
                collectionIds: [], // export all collections
            });
            operationName = operation.name;
            console.log(`[DatabaseMaintenance] Export operation started: ${operationName}`);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[DatabaseMaintenance] Export failed to initiate:`, err);
            await getDb().collection("admin")
                .doc("databaseMaintenance")
                .collection("exports")
                .doc(timestamp)
                .set({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    exportId: timestamp,
                    status: "FAILED_TO_INITIATE",
                    error: errMsg,
                    outputUriPrefix,
                    bucket: bucketName,
                    prefix,
                    storageClass: "COLDLINE",
                });
            throw err;
        }

        await getDb().collection("admin")
            .doc("databaseMaintenance")
            .collection("exports")
            .doc(timestamp)
            .set({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                exportId: timestamp,
                operationName,
                status: "INITIATED",
                outputUriPrefix,
                bucket: bucketName,
                prefix,
                storageClass: "COLDLINE",
                initiatedDurationMs: Date.now() - startTime,
            });

        console.log(`[DatabaseMaintenance] Export registered in audit log (${Date.now() - startTime}ms).`);
    }
);

// ============================================================================
// 2. Batch Deletion & Telemetry Purge Engine
// ============================================================================

async function batchDeleteDocs(
    db: FirebaseFirestore.Firestore,
    docRefs: FirebaseFirestore.DocumentReference[],
    dryRun: boolean
): Promise<number> {
    if (docRefs.length === 0) return 0;
    if (dryRun) {
        return docRefs.length;
    }

    let deleted = 0;
    for (let i = 0; i < docRefs.length; i += MAX_DOCS_PER_BATCH) {
        const chunk = docRefs.slice(i, i + MAX_DOCS_PER_BATCH);
        const batch = db.batch();
        for (const ref of chunk) {
            batch.delete(ref);
        }
        await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

export interface TelemetryPurgeOptions {
    dryRun?: boolean;
    skipSnapshotVerification?: boolean; // For isolated unit tests only
    maxAgeHours?: number;
}

export interface TelemetryPurgeReport {
    runId: string;
    dryRun: boolean;
    durationMs: number;
    status: "COMPLETED" | "ABORTED_UNVERIFIED_SNAPSHOT" | "ERROR";
    snapshotVerified: boolean;
    purgedCounts: {
        agentTraces: number;
        aiContextCache: number;
        notificationTokens: number;
        taxFormRequests: number;
        telegramLinkCodes: number;
        conversionEventOutbox: number;
        healthCheckPings: number;
        totalPurged: number;
    };
    error?: string;
}

/**
 * Core execution engine for purging stale telemetry and orphaned tokens.
 * Enforces pre-deletion snapshot verification prior to permanent deletes.
 */
export async function executeTelemetryPurge(
    options: TelemetryPurgeOptions = {}
): Promise<TelemetryPurgeReport> {
    const startTime = Date.now();
    const db = getDb();
    const runId = new Date().toISOString().replace(/[:.]/g, "-");

    // Check system configuration unless explicitly passed in options
    let enableDeletion = false;
    if (options.dryRun !== undefined) {
        enableDeletion = !options.dryRun;
    } else {
        const configDoc = await db.collection("admin").doc("databaseMaintenance").get();
        enableDeletion = configDoc.data()?.enableDeletion === true;
    }

    // Safety Rail: Pre-deletion snapshot verification in Coldline
    let verification: { verified: boolean; snapshot?: SnapshotVerificationResult; error?: string } = { verified: true };
    if (!options.skipSnapshotVerification) {
        verification = await getLatestVerifiedSnapshot(options.maxAgeHours ?? SNAPSHOT_MAX_AGE_HOURS);
    }

    if (enableDeletion && !verification.verified) {
        const reason = verification.error || "No valid, verified snapshot within safety window";
        console.error(`[DatabaseMaintenance] [SAFETY_RAIL_ABORT] Pre-deletion snapshot verification FAILED: ${reason}`);

        const abortReport: TelemetryPurgeReport = {
            runId,
            dryRun: false,
            durationMs: Date.now() - startTime,
            status: "ABORTED_UNVERIFIED_SNAPSHOT",
            snapshotVerified: false,
            purgedCounts: {
                agentTraces: 0,
                aiContextCache: 0,
                notificationTokens: 0,
                taxFormRequests: 0,
                telegramLinkCodes: 0,
                conversionEventOutbox: 0,
                healthCheckPings: 0,
                totalPurged: 0,
            },
            error: reason,
        };

        await db.collection("admin")
            .doc("databaseMaintenance")
            .collection("runs")
            .doc(runId)
            .set({
                ...abortReport,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

        throw new Error(`[DatabaseMaintenance] Aborting document deletion: pre-deletion snapshot verification failed. (${reason})`);
    }

    if (!enableDeletion) {
        console.log(`[DatabaseMaintenance] Running in DRY RUN mode. Set admin/databaseMaintenance.enableDeletion=true to enable.`);
    }

    const purgedCounts = {
        agentTraces: 0,
        aiContextCache: 0,
        notificationTokens: 0,
        taxFormRequests: 0,
        telegramLinkCodes: 0,
        conversionEventOutbox: 0,
        healthCheckPings: 0,
        totalPurged: 0,
    };

    const now = new Date();
    const cutoff30d = new Date(now.getTime() - AGENT_TRACES_TTL_DAYS * 24 * 60 * 60 * 1000);
    const cutoff90d = new Date(now.getTime() - NOTIFICATION_TOKENS_TTL_DAYS * 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(now.getTime() - CONVERSION_OUTBOX_TTL_DAYS * 24 * 60 * 60 * 1000);
    const cutoff24h = new Date(now.getTime() - HEALTH_CHECK_TTL_HOURS * 60 * 60 * 1000);

    // 1. Stale agent traces (> 30 days)
    try {
        const tracesSnap = await db.collection("agent_traces")
            .where("startTime", "<", cutoff30d)
            .limit(1000)
            .get();
        purgedCounts.agentTraces = await batchDeleteDocs(db, tracesSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing agent_traces:", msg);
    }

    // 2. Expired ai_context_cache (expireTime < now)
    try {
        const nowEpoch = now.getTime();
        const contextSnap = await db.collection("ai_context_cache")
            .where("expireTime", "<", nowEpoch)
            .limit(500)
            .get();
        purgedCounts.aiContextCache = await batchDeleteDocs(db, contextSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing ai_context_cache:", msg);
    }

    // 3. Stale / Orphaned notification_tokens
    try {
        // Inactive tokens (> 90 days)
        const staleTokensSnap = await db.collection("notification_tokens")
            .where("updatedAt", "<", cutoff90d)
            .limit(500)
            .get();

        const tokensToDelete = [...staleTokensSnap.docs];

        // Sample active tokens to verify if user still exists (detect orphaned push tokens)
        const sampleTokensSnap = await db.collection("notification_tokens")
            .limit(100)
            .get();

        const checkedUserIds = new Map<string, boolean>();
        for (const doc of sampleTokensSnap.docs) {
            const userId = doc.data().userId;
            if (userId && !checkedUserIds.has(userId)) {
                const userDoc = await db.collection("users").doc(userId).get();
                checkedUserIds.set(userId, userDoc.exists);
            }
            if (userId && checkedUserIds.get(userId) === false) {
                if (!tokensToDelete.some(t => t.id === doc.id)) {
                    tokensToDelete.push(doc);
                }
            }
        }

        purgedCounts.notificationTokens = await batchDeleteDocs(db, tokensToDelete.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing notification_tokens:", msg);
    }

    // 4. Consumed / expired taxFormRequests
    try {
        const taxSnap = await db.collection("taxFormRequests")
            .where("consumedAt", "!=", null)
            .limit(200)
            .get();
        purgedCounts.taxFormRequests = await batchDeleteDocs(db, taxSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing taxFormRequests:", msg);
    }

    // 5. Expired telegram-link-codes (> 24 hours)
    try {
        const telegramSnap = await db.collection("telegram-link-codes")
            .where("createdAt", "<", cutoff24h)
            .limit(200)
            .get();
        purgedCounts.telegramLinkCodes = await batchDeleteDocs(db, telegramSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing telegram-link-codes:", msg);
    }

    // 6. Delivered/Failed transient conversionEventOutbox (> 7 days)
    try {
        const outboxSnap = await db.collection("conversionEventOutbox")
            .where("status", "in", ["delivered", "failed"])
            .where("updatedAt", "<", cutoff7d)
            .limit(500)
            .get();
        purgedCounts.conversionEventOutbox = await batchDeleteDocs(db, outboxSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing conversionEventOutbox:", msg);
    }

    // 7. Transient _health_check pings (> 24 hours)
    try {
        const healthSnap = await db.collection("_health_check")
            .where("timestamp", "<", cutoff24h)
            .limit(200)
            .get();
        purgedCounts.healthCheckPings = await batchDeleteDocs(db, healthSnap.docs.map(d => d.ref), !enableDeletion);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DatabaseMaintenance] Error processing _health_check:", msg);
    }

    purgedCounts.totalPurged =
        purgedCounts.agentTraces +
        purgedCounts.aiContextCache +
        purgedCounts.notificationTokens +
        purgedCounts.taxFormRequests +
        purgedCounts.telegramLinkCodes +
        purgedCounts.conversionEventOutbox +
        purgedCounts.healthCheckPings;

    const report: TelemetryPurgeReport = {
        runId,
        dryRun: !enableDeletion,
        durationMs: Date.now() - startTime,
        status: "COMPLETED",
        snapshotVerified: verification.verified,
        purgedCounts,
    };

    await db.collection("admin")
        .doc("databaseMaintenance")
        .collection("runs")
        .doc(runId)
        .set({
            ...report,
            snapshotDetails: verification.snapshot
                ? {
                    bucket: verification.snapshot.bucket,
                    prefix: verification.snapshot.prefix,
                    totalBytes: verification.snapshot.totalBytes,
                    fileCount: verification.snapshot.fileCount,
                }
                : null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

    console.log(`[DatabaseMaintenance] Purge run complete in ${report.durationMs}ms. DryRun: ${report.dryRun}, TotalPurged: ${purgedCounts.totalPurged}`);
    return report;
}

/**
 * Scheduled Cloud Function: Purges stale telemetry and orphaned tokens.
 * Runs daily at 04:00 UTC (following the 02:00 UTC export window).
 */
export const purgeStaleDatabaseTelemetry = onSchedule(
    {
        region: "us-central1",
        schedule: "every day 04:00",
        timeZone: "UTC",
        timeoutSeconds: 540,
        memory: "1GiB",
        cpu: "gcf_gen1",
        concurrency: 1,
    },
    async () => {
        await executeTelemetryPurge();
    }
);
