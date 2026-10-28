export type BoardroomIntent = 'discussion' | 'capability' | 'action';

/** A model result authorizes execution only with a well-formed, confident decision. */
export function parseBoardroomIntentDecision(value: unknown, minimumConfidence: number): BoardroomIntent | null {
    if (!value || typeof value !== 'object') return null;
    const { choice, confidence } = value as Record<string, unknown>;
    if (!['discussion', 'capability', 'action'].includes(choice as string) ||
        typeof confidence !== 'number' || !Number.isFinite(confidence) ||
        confidence < minimumConfidence || confidence > 1) return null;
    return choice as BoardroomIntent;
}

/** Uncertainty revokes execution, not the ability to converse or help diagnose a problem. */
export function boardroomConversationIsReadOnly(intent: BoardroomIntent | null): boolean {
    return intent !== 'action';
}
