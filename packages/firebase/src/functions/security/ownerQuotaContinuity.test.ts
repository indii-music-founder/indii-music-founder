import { describe, expect, it } from 'vitest';
import { canUseOwnerQuotaContinuity, isProviderQuotaExhaustion, isVerifiedOwnerContinuityCaller } from './ownerQuotaContinuity';

describe('owner quota continuity boundary', () => {
    const owner = { admin: true, email_verified: true, email: 'wiil@indii.music' };
    it('requires every verified owner claim', () => {
        expect(isVerifiedOwnerContinuityCaller(owner)).toBe(true);
        for (const claims of [undefined, {}, { ...owner, admin: false }, { ...owner, admin: 'true' },
            { ...owner, email_verified: false }, { ...owner, email_verified: 'true' },
            { ...owner, email: 'someone@indii.music' }]) {
            expect(isVerifiedOwnerContinuityCaller(claims)).toBe(false);
        }
    });
    it.each(['typesafe-judge:uid', 'generate-content-stream:uuid', 'reserve-cost:uuid',
        'void-agent-stream-cost:uuid', 'read-cost-status:uuid', 'read-cost-history:uuid',
        ...['issueStudioExecutorLease', 'publishStudioPresence', 'releaseStudioPresence', 'claimStudioCommand',
            'publishStudioResponse', 'completeStudioCommand'].map(name => `studio-relay:${name}:uuid`),
    ])('admits only the explicitly scoped operation %s for a verified owner', operation => {
        expect(canUseOwnerQuotaContinuity(true, operation)).toBe(true);
        expect(canUseOwnerQuotaContinuity(false, operation)).toBe(false);
        expect(canUseOwnerQuotaContinuity(undefined, operation)).toBe(false);
    });
    it.each(['', 'inngest-api:uid', 'rag-proxy:ip', 'generate-invoice:uuid', 'render-video:uuid',
        'studio-relay:unknown:uuid', 'studio-relay', 'reserve-costly:uuid', 'anonymous-signup:ip',
    ])('rejects unrelated or malformed operations %s', operation => {
        expect(canUseOwnerQuotaContinuity(true, operation)).toBe(false);
    });
    it('recognizes the observed provider allowance error', () => {
        expect(isProviderQuotaExhaustion('[resource_exhausted] quota exceeded: log_drains (0/0 bytes), protected_requests (15091/10000 requests), total_requests (15091/10000 requests)')).toBe(true);
    });
    it.each(['Too many requests', '[resource_exhausted] rate limit exceeded', 'Invalid API key',
        'quota exceeded: protected_requests (15091/10000 requests)', '[resource_exhausted] quota exceeded: tokens (15091/10000 tokens)',
        'Shield denied request', 'deadline_exceeded',
        '[resource_exhausted] quota exceeded: log_drains (1/0 bytes), protected_requests (100/10000 requests)',
    ])('never mistakes another protection failure for provider quota: %s', message => {
        expect(isProviderQuotaExhaustion(message)).toBe(false);
    });
});
