import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore mock: in-memory doc store keyed by path (mirrors
// AssetVersionService.test.ts pattern) -------------------------------------

type Stored = Record<string, unknown>;
const store = new Map<string, Stored>();

vi.mock('firebase/firestore', () => ({
    doc: (_db: unknown, ...segs: string[]) => ({ __path: segs.join('/') }),
    setDoc: vi.fn(async (ref: { __path: string }, data: Stored) => {
        store.set(ref.__path, { ...data });
    }),
}));

let currentUid: string | null = 'user_test';

vi.mock('@/services/firebase', () => ({
    auth: {
        get currentUser() {
            return currentUid ? { uid: currentUid } : null;
        },
    },
    db: {},
}));

import { ErrorReportTools } from '../ErrorReportTools';
import { setDoc } from 'firebase/firestore';

describe('ErrorReportTools.report_error (ISSUE-1446)', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        currentUid = 'user_test';
    });

    it('files a report under errorReports/{reportId} pinned to the caller uid and returns the reference ID', async () => {
        const result = await ErrorReportTools.report_error({
            agentId: 'generalist',
            summary: 'Finalizing an asset failed',
            detail: 'raw firestore permission-denied stack for the fix team',
            surface: 'creative director chat',
        });

        expect(result.success).toBe(true);
        const data = result.data as { reportId: string; status: string };
        expect(data.reportId).toMatch(/^er_\d+_[a-z0-9]+$/);
        expect(data.status).toBe('open');

        const stored = store.get(`errorReports/${data.reportId}`);
        expect(stored).toBeDefined();
        expect(stored?.userId).toBe('user_test');
        expect(stored?.agentId).toBe('generalist');
        expect(stored?.summary).toBe('Finalizing an asset failed');
        expect(stored?.detail).toContain('permission-denied');
        expect(stored?.status).toBe('open');
        expect(typeof stored?.createdAt).toBe('number');
    });

    it('rejects an empty summary instead of filing a blank report', async () => {
        const result = await ErrorReportTools.report_error({ agentId: 'generalist', summary: '   ' });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('SUMMARY_REQUIRED');
        expect(store.size).toBe(0);
    });

    it('fails closed when the user is not signed in', async () => {
        currentUid = null;
        const result = await ErrorReportTools.report_error({ agentId: 'generalist', summary: 'something broke' });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
        expect(store.size).toBe(0);
    });

    it('truncates oversized detail so a hostile stack cannot bloat the document', async () => {
        const result = await ErrorReportTools.report_error({
            agentId: 'generalist',
            summary: 'big failure',
            detail: 'x'.repeat(20000),
        });
        expect(result.success).toBe(true);
        const stored = [...store.values()][0] as { detail: string };
        expect(stored.detail.length).toBeLessThanOrEqual(5000);
        expect(setDoc).toHaveBeenCalledTimes(1);
    });
});
