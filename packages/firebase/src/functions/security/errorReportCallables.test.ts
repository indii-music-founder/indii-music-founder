import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const userGet = vi.fn();
    const queryGet = vi.fn();
    const reportGet = vi.fn();
    const reportUpdate = vi.fn();
    const orderBy = vi.fn(() => ({ limit: vi.fn(() => ({ get: queryGet })) }));
    const firestore = Object.assign(
        vi.fn(() => ({
            collection: vi.fn((name: string) =>
                name === "users"
                    ? { doc: vi.fn(() => ({ get: userGet })) }
                    : { orderBy, doc: vi.fn(() => ({ get: reportGet, update: reportUpdate })) }
            ),
        })),
    );
    return { userGet, queryGet, reportGet, reportUpdate, orderBy, firestore };
});

vi.mock("firebase-admin", () => ({ firestore: mocks.firestore }));

vi.mock("firebase-functions/v2/https", () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((optsOrHandler: unknown, maybeHandler?: unknown) =>
            typeof optsOrHandler === "function" ? optsOrHandler : maybeHandler),
    };
});

import {
    listErrorReports,
    updateErrorReportStatus,
    validateListErrorReportsRequest,
    validateUpdateErrorReportStatusRequest,
} from "./errorReportCallables";

// The vi.mock replaces onCall so the exported symbols ARE the handlers at
// runtime; tsc still sees the framework signature (request, callOptions).
// These casters keep the tests honest without weakening the validators.
type ListHandler = (req: unknown) => Promise<{ reports: Array<Record<string, unknown>>; count: number }>;
type UpdateHandler = (req: unknown) => Promise<{ reportId: string; status: string }>;
const callList = listErrorReports as unknown as ListHandler;
const callUpdate = updateErrorReportStatus as unknown as UpdateHandler;
type ListReq = Parameters<typeof validateListErrorReportsRequest>[0];
type UpdateReq = Parameters<typeof validateUpdateErrorReportStatusRequest>[0];

const founderAuth = { auth: { uid: "founder-uid" }, data: {} };
const subscriberAuth = { auth: { uid: "sub-uid" }, data: {} };

function founderDoc(overrides: Record<string, unknown> = {}) {
    return { exists: true, data: () => ({ isFounder: true, ...overrides }) };
}

describe("listErrorReports (ISSUE-1446 triage)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userGet.mockResolvedValue(founderDoc());
        mocks.queryGet.mockResolvedValue({
            docs: [
                { id: "er_1", data: () => ({ reportId: "er_1", status: "open", summary: "s1" }) },
                { id: "er_2", data: () => ({ reportId: "er_2", status: "resolved", summary: "s2" }) },
            ],
        });
    });

    it("denies unauthenticated callers", async () => {
        await expect(callList({ auth: undefined, data: {} })).rejects.toThrow("authenticated");
    });

    it("denies non-founders even when authenticated", async () => {
        mocks.userGet.mockResolvedValue({ exists: true, data: () => ({ subscriptionTier: "pro" }) });
        await expect(callList(subscriberAuth)).rejects.toThrow("Founder access required.");
        expect(mocks.queryGet).not.toHaveBeenCalled();
    });

    it("accepts founder tier via subscriptionTier when the flag is absent", async () => {
        mocks.userGet.mockResolvedValue({ exists: true, data: () => ({ subscriptionTier: "founder" }) });
        const result = await callList({ ...founderAuth, data: {} });
        expect(result.count).toBe(2);
    });

    it("lists reports newest-first payload and applies the status filter in memory", async () => {
        const result = await callList({ ...founderAuth, data: { status: "open" } });
        expect(result.count).toBe(1);
        expect(result.reports[0]["summary"]).toBe("s1");
        expect(mocks.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("rejects invalid status filters and limits", async () => {
        await expect(validateListErrorReportsRequest({ status: "closed" } as unknown as ListReq)).rejects.toThrow("Invalid status");
        await expect(validateListErrorReportsRequest({ limit: 5000 } as unknown as ListReq)).rejects.toThrow("Invalid limit");
    });
});

describe("updateErrorReportStatus (ISSUE-1446 triage)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userGet.mockResolvedValue(founderDoc());
        mocks.reportGet.mockResolvedValue({ exists: true, data: () => ({ status: "open" }) });
        mocks.reportUpdate.mockResolvedValue(undefined);
    });

    it("records the reviewer and new status via the Admin SDK", async () => {
        const result = await callUpdate({
            ...founderAuth,
            data: { reportId: "er_1758851550000_ab12cd", status: "acknowledged" },
        });
        expect(result.status).toBe("acknowledged");
        expect(mocks.reportUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ status: "acknowledged", reviewedBy: "founder-uid" }),
        );
    });

    it("rejects malformed report IDs and unknown statuses", async () => {
        await expect(validateUpdateErrorReportStatusRequest({ reportId: "not-a-report", status: "open" } as unknown as UpdateReq))
            .rejects.toThrow("Invalid report ID");
        await expect(validateUpdateErrorReportStatusRequest({ reportId: "er_1758851550000_ab12cd", status: "zapped" } as unknown as UpdateReq))
            .rejects.toThrow("Invalid status");
    });

    it("reports a missing document as not-found", async () => {
        mocks.reportGet.mockResolvedValue({ exists: false, data: () => ({}) });
        await expect(callUpdate({
            ...founderAuth,
            data: { reportId: "er_1758851550000_ab12cd", status: "resolved" },
        })).rejects.toThrow("not found");
        expect(mocks.reportUpdate).not.toHaveBeenCalled();
    });
});
