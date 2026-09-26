import type { IndiiMcpTool } from '../types.js';
import { failedOperationResult, operationResult, toolResponse } from '../helpers.js';
import * as admin from 'firebase-admin';

/**
 * audit_catalog_gaps — read-only view of the caller's administrative task
 * queue (Post-Mastering Administrative Engine P3 mirror; plan §2.3).
 *
 * The queue is populated by the deterministic audit worker (catalog-admin-audit)
 * and carries pre-filled reconciliation drafts. This tool NEVER mutates.
 */

const SEVERITIES = ['info', 'warning', 'critical', 'blocking'];
const STATUSES = ['open', 'action_ready', 'awaiting_confirmation', 'executed', 'dismissed', 'failed'];
const ENTITY_TYPES = ['master', 'track', 'release', 'composition', 'collaborator'];

export const auditCatalogGaps: IndiiMcpTool = {
    name: 'audit_catalog_gaps',
    description: 'Read-only: list administrative audit gaps, staged registration drafts, and outstanding split invitations for the authenticated catalog owner. Never mutates.',
    inputSchema: {
        type: 'object',
        properties: {
            severity: { type: 'string', enum: SEVERITIES, description: 'Optional severity filter.' },
            status: { type: 'string', enum: STATUSES, description: 'Optional status filter (default: all).' },
            entityType: { type: 'string', enum: ENTITY_TYPES, description: 'Optional entity type filter.' },
            limit: { type: 'number', description: 'Max tasks returned (1-100, default 25).' },
        },
        required: [],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        try {
            const cappedLimit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 25, 1), 100);

            // Equality-only conjunctions (no composite index required); order client-side.
            let query: admin.firestore.Query = admin.firestore()
                .collection('users')
                .doc(actorUid)
                .collection('administrative_tasks');
            if (typeof args.status === 'string' && STATUSES.includes(args.status)) {
                query = query.where('status', '==', args.status);
            }
            if (typeof args.severity === 'string' && SEVERITIES.includes(args.severity)) {
                query = query.where('severity', '==', args.severity);
            }
            if (typeof args.entityType === 'string' && ENTITY_TYPES.includes(args.entityType)) {
                query = query.where('entityType', '==', args.entityType);
            }
            const snapshot = await query.limit(100).get();

            const page: Array<Record<string, unknown>> = snapshot.docs
                .map((document) => {
                    const data = document.data() as Record<string, unknown>;
                    return { ...data, id: document.id } as Record<string, unknown>;
                });
            const tasks = page
                .sort((a, b) => String(b['createdAt'] ?? '').localeCompare(String(a['createdAt'] ?? '')))
                .slice(0, cappedLimit);

            const bySeverity: Record<string, number> = {};
            const byStatus: Record<string, number> = {};
            for (const task of tasks) {
                const severity = String(task['severity'] ?? 'info');
                const status = String(task['status'] ?? 'open');
                bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
                byStatus[status] = (byStatus[status] ?? 0) + 1;
            }

            return toolResponse(operationResult({
                tool: 'audit_catalog_gaps',
                actorUid,
                status: 'succeeded',
                resourceType: 'administrative_task',
                resourceId: `users/${actorUid}/administrative_tasks`,
                data: {
                    tasks,
                    counts: { bySeverity, byStatus, scanned: tasks.length },
                    note: 'Counts reflect the scanned page. The queue is the source of truth for catalog readiness.',
                },
            }));
        } catch (error: unknown) {
            return toolResponse(failedOperationResult({
                tool: 'audit_catalog_gaps',
                actorUid,
                resourceType: 'administrative_task',
                resourceId: `users/${actorUid}/administrative_tasks`,
                code: 'QUERY_FAILED',
                message: error instanceof Error ? error.message : 'Failed to query administrative tasks.',
                retryable: true,
            }));
        }
    },
};
