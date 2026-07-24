import { describe, expect, it } from 'vitest';
import { ApprovalReceiptSchema } from './approvalReceipt';
describe('ApprovalReceipt Schema Validation', () => {
    const validApproval = {
        schemaVersion: 'approval-receipt.v1',
        approvalReceiptId: 'app-1',
        sessionId: 'session-1',
        planId: 'plan-1',
        ownerUid: 'user-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceGeneration: '9876543210',
        masterGeneration: '1234567890',
        decisions: [
            {
                segmentId: 'seg-1',
                action: 'keep',
                acknowledgedLowConfidence: true,
            },
            {
                segmentId: 'seg-2',
                action: 'reject',
                acknowledgedLowConfidence: false,
            },
        ],
        approvedAt: new Date().toISOString(),
        approverUid: 'user-1',
    };
    it('validates a correct ApprovalReceipt payload', () => {
        const result = ApprovalReceiptSchema.safeParse(validApproval);
        expect(result.success).toBe(true);
    });
    it('rejects an approval receipt where approverUid is not the ownerUid', () => {
        const invalid = { ...validApproval, approverUid: 'different-user' };
        const result = ApprovalReceiptSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });
});
