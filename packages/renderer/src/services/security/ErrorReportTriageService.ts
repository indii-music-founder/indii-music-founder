/**
 * ErrorReportTriageService.ts
 *
 * Founder-side triage client for agent error reports (ISSUE-1446). Thin
 * wrapper over the founder-gated Admin SDK callables — all access control
 * happens server-side (see packages/firebase/src/functions/security/
 * errorReportCallables.ts); this service only carries the request/response
 * shapes and surfaces callable failures verbatim to the caller (founder
 * diagnostics are by-design for this surface).
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export type ErrorReportStatus = 'open' | 'acknowledged' | 'resolved';

interface ListErrorReportsRequest {
    status?: ErrorReportStatus;
    limit?: number;
}

export interface ErrorReportRecord {
    id: string;
    reportId?: string;
    userId?: string;
    agentId?: string;
    summary?: string;
    detail?: string | null;
    surface?: string | null;
    status?: ErrorReportStatus;
    createdAt?: number;
    reviewedAt?: number | null;
    reviewedBy?: string | null;
}

interface ListErrorReportsResponse {
    reports: ErrorReportRecord[];
    count: number;
}

function requireFunctions(): NonNullable<typeof functions> {
    if (!functions) throw new Error('Error report triage is unavailable.');
    return functions;
}

class ErrorReportTriageServiceImpl {
    async list(status?: ErrorReportStatus, limit = 50): Promise<ErrorReportRecord[]> {
        try {
            const callable = httpsCallable<ListErrorReportsRequest, ListErrorReportsResponse>(
                requireFunctions(),
                'listErrorReports',
            );
            const result = await callable({ status, limit });
            return result.data.reports;
        } catch (err: unknown) {
            logger.error('[ErrorReportTriageService] list failed:', err);
            throw err;
        }
    }

    async setStatus(reportId: string, status: ErrorReportStatus): Promise<void> {
        try {
            const callable = httpsCallable<
                { reportId: string; status: ErrorReportStatus },
                { reportId: string; status: ErrorReportStatus }
            >(requireFunctions(), 'updateErrorReportStatus');
            await callable({ reportId, status });
        } catch (err: unknown) {
            logger.error('[ErrorReportTriageService] setStatus failed:', err);
            throw err;
        }
    }
}

export const ErrorReportTriageService = new ErrorReportTriageServiceImpl();
