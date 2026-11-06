/** Consent in chat must not become another model-generated proposal or authorize a tool. */
export const APPROVAL_PANEL_GUIDANCE = 'Your approval has not executed the action yet. Open the Approvals panel and approve the specific pending request there. If no request is pending, the action may already be resolved; check its recorded outcome before requesting it again.';

export function isApprovalConsentReply(text: string, previousModelText: string | undefined): boolean {
    if (!previousModelText || !(
        /^Execution paused: '[^'\n]+' requires your explicit approval \(/.test(previousModelText) ||
        previousModelText === APPROVAL_PANEL_GUIDANCE
    )) return false;
    // Whole-message matching avoids swallowing new instructions, quoted consent, or conditions.
    return /^(?:i approve|i give (?:you )?(?:my )?(?:explicit )?approval|i['’]m giving you my (?:explicit )?approval|you have my (?:explicit )?approval|approve it|approved)[.!\s]*$/i.test(text.trim());
}
