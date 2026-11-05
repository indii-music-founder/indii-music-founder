import { describe, expect, it } from 'vitest';
import { APPROVAL_PANEL_GUIDANCE, isApprovalConsentReply } from './approvalConsent';

const paused = "Execution paused: 'report_bug' requires your explicit approval (File a bug report). Check the Approvals panel to approve or deny.";

describe('approval consent routing', () => {
    it.each(["I'm giving you my approval", 'you have my explicit approval', 'I approve.', 'Approve it'])('recognizes %s only after an approval pause', text => {
        expect(isApprovalConsentReply(text, paused)).toBe(true);
        expect(isApprovalConsentReply(text, 'Here is the draft.')).toBe(false);
        expect(isApprovalConsentReply(text, undefined)).toBe(false);
    });
    it('keeps repeated consent on the existing approval guidance path', () => {
        expect(isApprovalConsentReply('I approve', APPROVAL_PANEL_GUIDANCE)).toBe(true);
    });
    it.each(['yes', 'I approve if the cost is zero', 'I approve. Also publish the release', '"I approve"', 'Do not approve it', 'I approve the new draft'])('preserves ambiguous or substantive request: %s', text => {
        expect(isApprovalConsentReply(text, paused)).toBe(false);
    });
});
