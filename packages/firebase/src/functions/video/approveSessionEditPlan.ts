import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
    ApprovalReceipt,
    ApprovalReceiptSchema,
    SegmentApprovalDecisionSchema,
    SessionEditPlan,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const ApproveSessionEditPlanRequestSchema = z.object({
    sessionId: z.string().trim().min(1).max(256),
    planId: z.string().trim().min(1).max(256),
    decisions: z.array(SegmentApprovalDecisionSchema).min(1),
}).strict();

export function createApproveSessionEditPlanHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = ApproveSessionEditPlanRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The approval request payload is malformed.');
        }

        const { sessionId, planId, decisions } = parseResult.data;

        const sessionRef = db.collection('videoSessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            throw new HttpsError('not-found', 'The specified video session does not exist.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = sessionSnap.data() as Record<string, any>;
        if (session.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner video session access is prohibited.');
        }

        if (session.status !== 'completed') {
            throw new HttpsError('failed-precondition', 'The session must be completed before approving an edit plan.');
        }

        const planRef = sessionRef.collection('editPlans').doc(planId);
        const planSnap = await planRef.get();
        if (!planSnap.exists) {
            throw new HttpsError('not-found', 'The specified session edit plan does not exist.');
        }

        const plan = planSnap.data() as SessionEditPlan;

        // Check if segment decisions contain low-confidence items requiring explicit acknowledgement
        for (const decision of decisions) {
            const segment = plan.segments.find((s) => s.segmentId === decision.segmentId);
            if (segment && segment.confidence < 0.70 && !decision.acknowledgedLowConfidence) {
                throw new HttpsError(
                    'failed-precondition',
                    `Segment ${decision.segmentId} has low confidence (${segment.confidence}) and requires explicit user acknowledgement.`,
                );
            }
        }

        const decisionsHash = createHash('sha256').update(JSON.stringify(decisions)).digest('hex').slice(0, 16);
        const approvalReceiptId = `receipt-app-${createHash('sha256').update(`${sessionId}:${planId}:${decisionsHash}`).digest('hex').slice(0, 24)}`;

        const approvalRef = sessionRef.collection('approvals').doc(approvalReceiptId);
        const existingSnap = await approvalRef.get();
        if (existingSnap.exists) {
            const existing = existingSnap.data() as ApprovalReceipt;
            return { receipt: existing, reused: true };
        }

        const now = new Date().toISOString();
        const newReceipt: ApprovalReceipt = {
            schemaVersion: 'approval-receipt.v1',
            approvalReceiptId,
            sessionId,
            planId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            sourceGeneration: session.original.generation,
            decisions,
            approvedAt: now,
            approverUid: authUid,
        };

        const validated = ApprovalReceiptSchema.parse(newReceipt);
        await approvalRef.set(validated);

        return { receipt: validated, reused: false };
    };
}

export const approveSessionEditPlan = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createApproveSessionEditPlanHandler();
    return await handler(request.data, request.auth.uid);
});
