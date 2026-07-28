import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

type IdentifierType = "isrc" | "upc";

interface AssignIdentifierRequest {
    type: IdentifierType;
    assignedTo: string;
    releaseId?: string;
    trackTitle?: string;
    artistName?: string;
    releaseTitle?: string;
    metadataSnapshot?: Record<string, unknown>;
}

interface RecordIdentifierRequest {
    type: IdentifierType;
    isrc?: string;
    upc?: string;
    releaseId: string;
    trackTitle?: string;
    artistName?: string;
    releaseTitle?: string;
    metadataSnapshot?: Record<string, unknown>;
}

interface RecordDistributionAuditRequest {
    releaseId: string;
    kind: "metadata_snapshot" | "event";
    snapshot?: Record<string, unknown>;
    event?: {
        type: string;
        status: string;
        detail?: string;
    };
}

interface RequestDistributionTakedownRequest {
    releaseId: string;
    distributorId?: string;
    reason?: string;
}

interface CreateSftpIngestionRequest {
    targetDSP: string;
    releaseFolder: string;
}

interface UpdateSftpIngestionRequest {
    ingestionId: string;
    status: string;
    filesTransferred?: number;
}

const RELEASE_COLLECTIONS = ["proprietaryIngestionReleases", "ddexReleases", "releases"];

// ISRC: 2-letter country, 3-char registrant, 2-digit year, 5-digit designation (ISO 3901)
const ISRC_FORMAT = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;
// UPC-A (12 digits) or EAN-13 (13 digits)
const UPC_FORMAT = /^\d{12,13}$/;

function normalizeIdentifier(type: IdentifierType, raw: string): string {
    const code = raw.replace(/[\s-]/g, "").toUpperCase();
    const format = type === "isrc" ? ISRC_FORMAT : UPC_FORMAT;
    if (!format.test(code)) {
        throw new HttpsError(
            "invalid-argument",
            type === "isrc"
                ? "ISRC must be 12 characters: 2-letter country, 3-char registrant, 2-digit year, 5-digit designation (ISO 3901)."
                : "UPC must be 12 digits (UPC-A) or 13 digits (EAN-13).",
        );
    }
    return code;
}

/**
 * Fails if the code already exists in the registry (any status). Runs inside
 * the caller's transaction so concurrent duplicate writes cannot both commit.
 */
async function assertIdentifierUnique(
    tx: FirebaseFirestore.Transaction,
    registryCollection: string,
    codeField: string,
    code: string,
): Promise<void> {
    const dup = await tx.get(
        admin.firestore().collection(registryCollection).where(codeField, "==", code).limit(1),
    );
    if (!dup.empty) {
        throw new HttpsError(
            "already-exists",
            `${codeField.toUpperCase()} ${code} is already recorded in the registry.`,
        );
    }
}

function requireAuth(request: CallableRequest): string {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    return request.auth.uid;
}

function requireString(value: unknown, field: string, maxLength = 240): string {
    if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
        throw new HttpsError("invalid-argument", `${field} is required.`);
    }
    return value.trim();
}

function assertRecord(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new HttpsError("invalid-argument", `${field} must be an object.`);
    }
    return value as Record<string, unknown>;
}

function memberListIncludes(members: unknown, uid: string): boolean {
    if (Array.isArray(members)) return members.includes(uid);
    return !!members && typeof members === "object" && (members as Record<string, unknown>)[uid] != null;
}

async function userCanAccessOrg(orgId: unknown, uid: string): Promise<boolean> {
    if (typeof orgId !== "string" || orgId.trim().length === 0) return false;

    const orgSnap = await admin.firestore().doc(`organizations/${orgId}`).get();
    if (!orgSnap.exists) return false;

    const org = orgSnap.data() || {};
    return org.ownerId === uid || memberListIncludes(org.members, uid);
}

/** Exported for reuse by other trust boundaries that need the same release-ownership check (e.g. pandadocWebhook, ISSUE-864). */
export async function findWritableReleaseRef(releaseId: string, uid: string): Promise<FirebaseFirestore.DocumentReference> {
    const db = admin.firestore();

    for (const collectionName of RELEASE_COLLECTIONS) {
        const ref = db.doc(`${collectionName}/${releaseId}`);
        const snap = await ref.get();
        if (!snap.exists) continue;

        const data = snap.data() || {};
        if (
            data.userId === uid ||
            data.ownerId === uid ||
            data.createdBy === uid ||
            await userCanAccessOrg(data.orgId, uid)
        ) {
            return ref;
        }
    }

    throw new HttpsError(
        "permission-denied",
        "Release was not found for this user.",
    );
}

async function assignIdentifier(
    type: IdentifierType,
    assignedTo: string,
    uid: string,
    registryData: Record<string, unknown>,
): Promise<{ code: string; registryId: string }> {
    const db = admin.firestore();
    const poolCollection = type === "isrc" ? "isrc_pool" : "upc_pool";
    const registryCollection = type === "isrc" ? "isrc_registry" : "upc_registry";
    const codeField = type;

    const available = await db.collection(poolCollection)
        .where("status", "==", "available")
        .limit(1)
        .get();

    if (available.empty) {
        throw new HttpsError(
            "failed-precondition",
            `${type.toUpperCase()} pool is exhausted.`,
        );
    }

    const poolDoc = available.docs[0]!;
    const code = poolDoc.get(codeField);
    if (typeof code !== "string" || code.trim().length === 0) {
        throw new HttpsError(
            "failed-precondition",
            `${type.toUpperCase()} pool record is missing its code.`,
        );
    }

    const registryRef = db.collection(registryCollection).doc();
    await db.runTransaction(async (tx) => {
        const freshPool = await tx.get(poolDoc.ref);
        if (!freshPool.exists || freshPool.get("status") !== "available") {
            throw new HttpsError(
                "aborted",
                `${type.toUpperCase()} was already assigned. Try again.`,
            );
        }
        await assertIdentifierUnique(tx, registryCollection, codeField, code);

        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.update(poolDoc.ref, {
            status: "assigned",
            assignedTo,
            assignedAt: now,
            assignedBy: uid,
        });
        tx.set(registryRef, {
            ...registryData,
            [codeField]: code,
            userId: uid,
            // Allocated from the platform's own verified pool — provenance is the pool doc.
            status: "ALLOCATED_FROM_POOL",
            provenance: {
                source: "verified_pool",
                poolDocId: poolDoc.id,
                poolCollection,
            },
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
        });
    });

    return { code, registryId: registryRef.id };
}

export const assignDistributionIdentifier = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as AssignIdentifierRequest;
        if (data.type !== "isrc" && data.type !== "upc") {
            throw new HttpsError("invalid-argument", "Identifier type is invalid.");
        }

        const assignedTo = requireString(data.assignedTo, "assignedTo");
        const registryData: Record<string, unknown> = {};

        if (data.releaseId) {
            const releaseId = requireString(data.releaseId, "releaseId");
            // Ownership gate: never attach identifiers to another user's release.
            await findWritableReleaseRef(releaseId, uid);
            registryData.releaseId = releaseId;
        }
        if (data.trackTitle) registryData.trackTitle = requireString(data.trackTitle, "trackTitle");
        if (data.artistName) registryData.artistName = requireString(data.artistName, "artistName");
        if (data.releaseTitle) registryData.releaseTitle = requireString(data.releaseTitle, "releaseTitle");
        if (data.metadataSnapshot) registryData.metadataSnapshot = assertRecord(data.metadataSnapshot, "metadataSnapshot");

        const result = await assignIdentifier(data.type, assignedTo, uid, registryData);
        return {
            id: result.registryId,
            [data.type]: result.code,
        };
    },
);

export const recordDistributionIdentifier = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as RecordIdentifierRequest;
        if (data.type !== "isrc" && data.type !== "upc") {
            throw new HttpsError("invalid-argument", "Identifier type is invalid.");
        }

        const codeField = data.type;
        const code = normalizeIdentifier(data.type, requireString(data[codeField], codeField));
        const releaseId = requireString(data.releaseId, "releaseId");
        // Ownership gate: the release must exist and belong to the caller.
        await findWritableReleaseRef(releaseId, uid);

        const now = admin.firestore.FieldValue.serverTimestamp();
        const payload: Record<string, unknown> = {
            [codeField]: code,
            releaseId,
            userId: uid,
            // User-supplied code — provenance is external and unverified. Never
            // "REGISTERED": this endpoint has no authority evidence.
            status: "RECORDED_EXTERNAL",
            provenance: {
                source: "user_supplied",
                recordedBy: uid,
            },
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
        };

        if (data.trackTitle) payload.trackTitle = requireString(data.trackTitle, "trackTitle");
        if (data.artistName) payload.artistName = requireString(data.artistName, "artistName");
        if (data.releaseTitle) payload.releaseTitle = requireString(data.releaseTitle, "releaseTitle");
        if (data.metadataSnapshot) payload.metadataSnapshot = assertRecord(data.metadataSnapshot, "metadataSnapshot");

        const registryCollection = data.type === "isrc" ? "isrc_registry" : "upc_registry";
        const db = admin.firestore();
        const docRef = db.collection(registryCollection).doc();
        await db.runTransaction(async (tx) => {
            await assertIdentifierUnique(tx, registryCollection, codeField, code);
            tx.set(docRef, payload);
        });
        return { id: docRef.id, [codeField]: code };
    },
);

export const recordDistributionAuditEvent = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as RecordDistributionAuditRequest;
        const releaseId = requireString(data.releaseId, "releaseId");
        await findWritableReleaseRef(releaseId, uid);

        const db = admin.firestore();
        const now = admin.firestore.FieldValue.serverTimestamp();

        if (data.kind === "metadata_snapshot") {
            const snapshot = assertRecord(data.snapshot, "snapshot");
            const docRef = await db.collection("distribution_audit")
                .doc(releaseId)
                .collection("metadata_history")
                .add({
                    snapshot,
                    timestamp: now,
                    userId: uid,
                });
            return { id: docRef.id };
        }

        if (data.kind === "event") {
            const event = assertRecord(data.event, "event");
            const type = requireString(event.type, "event.type", 120);
            const status = requireString(event.status, "event.status", 80);
            const detail = event.detail === undefined ? undefined : requireString(event.detail, "event.detail", 8000);
            const docRef = await db.collection("distribution_audit")
                .doc(releaseId)
                .collection("events")
                .add({
                    type,
                    status,
                    ...(detail !== undefined ? { detail } : {}),
                    timestamp: now,
                    userId: uid,
                });
            return { id: docRef.id };
        }

        throw new HttpsError("invalid-argument", "Distribution audit kind is invalid.");
    },
);

export const requestDistributionTakedown = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as RequestDistributionTakedownRequest;
        const releaseId = requireString(data.releaseId, "releaseId");
        const distributorId = data.distributorId ? requireString(data.distributorId, "distributorId") : "all";
        const reason = data.reason ? requireString(data.reason, "reason", 1000) : "voluntary_withdrawal";
        const releaseRef = await findWritableReleaseRef(releaseId, uid);

        const db = admin.firestore();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const takedownRef = db.collection("takedown_requests").doc();
        const distributionRequestRef = db.collection("distribution_takedowns")
            .doc(releaseId)
            .collection("requests")
            .doc();

        await db.runTransaction(async (tx) => {
            tx.set(takedownRef, {
                releaseId,
                distributorId,
                reason,
                requestedBy: uid,
                status: "PENDING_NOTIFICATION",
                manualRequired: true,
                createdAt: now,
            });
            tx.set(distributionRequestRef, {
                releaseId,
                distributorId,
                reason,
                requestedBy: uid,
                status: "pending_notification",
                manualRequired: true,
                recordedAt: now,
            });
            tx.set(releaseRef, {
                takedownStatus: "pending_notification",
                takedownNotificationStatus: "manual_required",
                takedownReason: reason,
                takedownRecordedAt: now,
                takedownRecordedBy: uid,
            }, { merge: true });
        });

        return {
            takedownId: takedownRef.id,
            distributionRequestId: distributionRequestRef.id,
            releaseId,
            distributorId,
            status: "PENDING_NOTIFICATION",
            manualRequired: true,
        };
    },
);

export const createSftpIngestionRecord = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as CreateSftpIngestionRequest;
        const targetDSP = requireString(data.targetDSP, "targetDSP", 160);
        const releaseFolder = requireString(data.releaseFolder, "releaseFolder", 1000);
        const now = admin.firestore.FieldValue.serverTimestamp();

        const docRef = await admin.firestore().collection("sftp_ingestions").add({
            userId: uid,
            targetDSP,
            releaseFolder,
            status: "INITIATED",
            createdAt: now,
            updatedAt: now,
        });

        return { ingestionId: docRef.id };
    },
);

export const updateSftpIngestionRecord = onCall(
    async (request) => {
        const uid = requireAuth(request);
        const data = (request.data ?? {}) as UpdateSftpIngestionRequest;
        const ingestionId = requireString(data.ingestionId, "ingestionId");
        const status = requireString(data.status, "status", 80);
        const filesTransferred = data.filesTransferred;
        if (filesTransferred !== undefined && (!Number.isInteger(filesTransferred) || filesTransferred < 0)) {
            throw new HttpsError("invalid-argument", "filesTransferred must be a non-negative integer.");
        }

        const ref = admin.firestore().collection("sftp_ingestions").doc(ingestionId);
        await admin.firestore().runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists || snap.data()?.userId !== uid) {
                throw new HttpsError("permission-denied", "SFTP ingestion was not found for this user.");
            }

            tx.set(ref, {
                status,
                ...(filesTransferred !== undefined ? { filesTransferred } : {}),
                ...(status === "TRANSFERRED" ? { completedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });

        return { ingestionId, status };
    },
);
