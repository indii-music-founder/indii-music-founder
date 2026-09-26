import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Founder-gated triage callables for agent error reports (ISSUE-1446).
 *
 * Why callables instead of client reads: the errorReports Firestore rules
 * allow read-all only via the `admin` token claim, which browser sessions do
 * not carry. These callables verify the caller's founder status server-side
 * (from the authoritative user document, not client assertions) and then use
 * the Admin SDK, which intentionally bypasses rules. Clients can never widen
 * this: the gate is the user document, not the request payload.
 *
 * Report documents themselves stay immutable to clients (rules: update/delete
 * false); status transitions happen here, through the Admin SDK, with the
 * reviewer's uid recorded.
 */

const REPORT_ID_PATTERN = /^er_[0-9]{12,16}_[a-z0-9]{2,12}$/;
const ALLOWED_STATUSES = new Set(["open", "acknowledged", "resolved"]);
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

interface ListErrorReportsRequest {
    status?: "open" | "acknowledged" | "resolved";
    limit?: number;
}

interface UpdateErrorReportStatusRequest {
    reportId: string;
    status: "open" | "acknowledged" | "resolved";
}

function requireAuthenticatedUid(request: CallableRequest): string {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    return request.auth.uid;
}

/**
 * Founder gate — reads the caller's own user document with the Admin SDK and
 * requires an explicit founder signal. Never trusts client-sent identity.
 */
async function requireFounderUid(request: CallableRequest): Promise<string> {
    const uid = requireAuthenticatedUid(request);
    const snap = await admin.firestore().collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError("permission-denied", "Founder access required.");
    }
    const data = snap.data() ?? {};
    const isFounder = data["isFounder"] === true ||
        data["subscriptionTier"] === "founder";
    if (!isFounder) {
        throw new HttpsError("permission-denied", "Founder access required.");
    }
    return uid;
}

export async function validateListErrorReportsRequest(
    data: ListErrorReportsRequest,
): Promise<{ status: string | null; limit: number }> {
    const status = data?.status ?? null;
    if (status !== null && !ALLOWED_STATUSES.has(status)) {
        throw new HttpsError("invalid-argument", "Invalid status filter.");
    }
    const rawLimit = data?.limit ?? DEFAULT_LIST_LIMIT;
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIST_LIMIT) {
        throw new HttpsError("invalid-argument", "Invalid limit.");
    }
    return { status, limit: rawLimit };
}

export async function validateUpdateErrorReportStatusRequest(
    data: UpdateErrorReportStatusRequest,
): Promise<{ reportId: string; status: string }> {
    if (
        typeof data?.reportId !== "string" ||
        !REPORT_ID_PATTERN.test(data.reportId)
    ) {
        throw new HttpsError("invalid-argument", "Invalid report ID.");
    }
    if (typeof data?.status !== "string" || !ALLOWED_STATUSES.has(data.status)) {
        throw new HttpsError("invalid-argument", "Invalid status.");
    }
    return { reportId: data.reportId, status: data.status };
}

/**
 * List agent error reports for founder triage. Newest first. The optional
 * status filter is applied server-side in memory so no composite index is
 * required; report volume is small and bounded by the limit.
 */
export const listErrorReports = onCall(
    { memory: "512MiB", cpu: "gcf_gen1", concurrency: 1 },
    async (request) => {
        await requireFounderUid(request);
        const validated = await validateListErrorReportsRequest(
            (request.data ?? {}) as ListErrorReportsRequest,
        );

        const query = admin
            .firestore()
            .collection("errorReports")
            .orderBy("createdAt", "desc")
            .limit(validated.limit) as admin.firestore.Query;
        const snap = await query.get();

        const reports: Array<Record<string, unknown> & { id: string }> = snap.docs
            .map((d): Record<string, unknown> & { id: string } => ({
                id: d.id,
                ...(d.data() as Record<string, unknown>),
            }))
            .filter((r) => !validated.status || r["status"] === validated.status);

        return { reports, count: reports.length };
    },
);

/**
 * Transition an error report's status (founder triage). Admin SDK write with
 * the reviewer recorded; the document is otherwise untouched.
 */
export const updateErrorReportStatus = onCall(
    { memory: "512MiB", cpu: "gcf_gen1", concurrency: 1 },
    async (request) => {
        const reviewerUid = await requireFounderUid(request);
        const validated = await validateUpdateErrorReportStatusRequest(
            (request.data ?? {}) as UpdateErrorReportStatusRequest,
        );

        const ref = admin
            .firestore()
            .collection("errorReports")
            .doc(validated.reportId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new HttpsError("not-found", "Error report not found.");
        }

        await ref.update({
            status: validated.status,
            reviewedAt: Date.now(),
            reviewedBy: reviewerUid,
        });

        return { reportId: validated.reportId, status: validated.status };
    },
);
