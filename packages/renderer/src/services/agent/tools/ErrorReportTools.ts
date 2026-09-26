/**
 * ErrorReportTools.ts
 *
 * The subscriber-facing error-report path (ISSUE-1446). Raw technical
 * diagnostics are founder-only in chat; every paying user must still be able
 * to REPORT a failure. `report_error` files a durable report with a short
 * reference ID the agent can hand back to the user, while the technical
 * detail stays in the report document for the fix team — never relayed into
 * the conversation.
 *
 * Persistence: top-level `errorReports/{reportId}`, owner-created
 * (`userId == auth.uid`), owner-readable, admin-readable. The matching
 * Firestore rule ships in the same change set (ISSUE-1444 prevention:
 * never introduce a Firestore path without its rule + emulator test).
 */

import { auth, db } from '@/services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';

// Type alias (not interface) so the object literal type carries an implicit
// index signature and satisfies wrapTool's `TArgs extends ToolFunctionArgs`.
export type ErrorReportInput = {
    agentId: string;
    summary: string;
    detail?: string;
    surface?: string;
};

export const ErrorReportTools = {
    /**
     * File an error report. Returns the short report ID the agent should give
     * the user. The raw technical detail (if provided) is stored in the
     * report document only — it is the agent's job (execution contract) to
     * keep it out of the subscriber-facing chat.
     */
    report_error: wrapTool('report_error', async (args: ErrorReportInput) => {
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError('You must be signed in to file an error report.', 'AUTH_REQUIRED');
            }
            const summary = (args.summary || '').trim();
            if (!summary) {
                return toolError('A one-sentence plain-language summary is required to file an error report.', 'SUMMARY_REQUIRED');
            }
            const reportId = `er_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const report = {
                reportId,
                userId: uid,
                agentId: args.agentId || 'unknown',
                summary: summary.slice(0, 500),
                detail: (args.detail || '').slice(0, 5000) || null,
                surface: (args.surface || '').slice(0, 200) || null,
                status: 'open',
                createdAt: Date.now(),
            };
            await setDoc(doc(db, 'errorReports', reportId), report);
            logger.info('[ErrorReportTools]', `Filed error report ${reportId} for user ${uid} (agent ${report.agentId})`);
            return toolSuccess(
                { reportId, status: report.status },
                `Error report filed. Give the user this reference ID: ${reportId}`
            );
        } catch (e: unknown) {
            logger.error('[ErrorReportTools] report_error failed:', e);
            return toolError(
                'Could not file the error report right now.',
                'ERROR_REPORT_FAILED',
            );
        }
    }),
};
