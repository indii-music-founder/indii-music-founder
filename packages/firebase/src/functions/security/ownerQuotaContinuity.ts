/** Only the verified solo owner can use the outage continuity path. */
export function isVerifiedOwnerContinuityCaller(claims: Record<string, unknown> | undefined): boolean {
    return claims?.admin === true
        && claims.email_verified === true
        && claims.email === 'wiil@indii.music';
}

const OPERATIONS = new Set([
    'typesafe-judge', 'generate-content-stream', 'reserve-cost',
    'void-agent-stream-cost', 'read-cost-status', 'read-cost-history',
]);
const RELAY_OPERATIONS = new Set([
    'issueStudioExecutorLease', 'publishStudioPresence', 'releaseStudioPresence',
    'claimStudioCommand', 'publishStudioResponse', 'completeStudioCommand',
]);

export function canUseOwnerQuotaContinuity(verifiedOwner: boolean | undefined, operationId: string): boolean {
    if (verifiedOwner !== true) return false;
    const [operation, relayOperation] = operationId.split(':');
    return operation === 'studio-relay'
        ? RELAY_OPERATIONS.has(relayOperation)
        : OPERATIONS.has(operation);
}

/** Never interpret request rate limiting, missing keys, or WAF denials as quota. */
export function isProviderQuotaExhaustion(message: string): boolean {
    if (!message.includes('[resource_exhausted]') || !message.includes('quota exceeded:')) return false;
    return [...message.matchAll(/(?:protected_requests|total_requests) \((\d+)\/(\d+) requests\)/g)]
        .some(([, used, limit]) => {
            const count = Number(used);
            const cap = Number(limit);
            return Number.isSafeInteger(count) && Number.isSafeInteger(cap) && count > 0 && count >= cap;
        });
}
