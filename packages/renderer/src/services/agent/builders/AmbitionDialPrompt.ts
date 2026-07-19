/**
 * v1.5 Consent-based ambition dial promotion.
 * When user has accepted ~5 offered ideas, ask ONCE if they want agents to bring more ideas by default.
 * User can upgrade dial or decline (and never ask again for 24h).
 */

export function buildAmbitionDialPrompt(): string {
    return `
## JUDGMENT LAYER — Dial Upgrade Offer (ASK ONCE, respect their answer)

The user has been picking up several ideas you've offered. This is a natural point to ask:

**NEXT TURN ONLY:** After you deliver your main answer to their request, pause and ask directly:

"I've noticed you've been acting on a few extra ideas I've suggested. Want me to bring more ideas by default? You can change this anytime in Settings (Appearance → Ambition). Or I can keep the current pace—totally your call."

**CRITICAL:** This is a ONE-TIME ask. Do NOT ask again after this. Respect the user's choice (yes, no, ignore). Their Settings control the dial, not you.

**If user says YES:** You should shift to offering more ideas (4 instead of 2), but STILL wait for "say the word" before executing. More offers, same restraint.

**If user says NO or ignores:** The dial stays where it is. No follow-up. Accept their preference.

**AFTER this turn:** Do not reference this conversation. Let their Settings dial control your behavior.
`;
}

/**
 * Post-prompt injection message that resets the flag after the question is asked
 */
export const AMBITION_PROMPT_RESET_MESSAGE = '[SYSTEM] Ambition dial upgrade question delivered. Flag reset for 24h. Proceed normally.';
