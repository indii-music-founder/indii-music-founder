import { randomUUID } from 'node:crypto';

import { EvidenceReferenceSchema, RightsClaimTypeSchema } from '@indii/shared';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import {
    CanonicalMusicCatalogScopeSchema,
    createCanonicalMusicCatalogStore,
    type CanonicalMusicCatalogStore,
} from './canonicalMusicCatalogStore';
import {
    admitOrganizationAccessRequest,
    organizationAccessCallableOptions,
} from '../security/organizationAccess';

const ReadRequestSchema = z.object({ scope: CanonicalMusicCatalogScopeSchema }).strict();
const externalIdentifierPrefix = /^(?:isrc|iswc|upc|ean|icpn|isni|ipi|dpid|grid|catalog(?:_number)?|platform_id|proprietary|spotify|apple(?:_music)?|youtube|tiktok|instagram):/i;
const externalIdentifierValue = /^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}|T-\d{3}\.\d{3}\.\d{3}-\d|\d{8,14})$/i;
const InternalEntityIdSchema = z.string().trim().min(1).max(160).refine(value => {
    return !externalIdentifierPrefix.test(value) && !externalIdentifierValue.test(value);
}, 'Canonical entity references must be internal IDs, not external identifiers.');
const OwnerEvidenceSchema = EvidenceReferenceSchema.refine(
    evidence => !evidence.uri || /^https:\/\//i.test(evidence.uri),
    'Evidence reference URLs must use HTTPS.',
);
const DeclareRequestSchema = z.object({
    scope: CanonicalMusicCatalogScopeSchema,
    targetEntityId: InternalEntityIdSchema,
    claimantEntityId: InternalEntityIdSchema.optional(),
    type: RightsClaimTypeSchema,
    sharePercentage: z.number().min(0).max(100).optional(),
    territoryCodes: z.array(z.string().trim().min(1).max(32)).max(300).default([]),
    validFrom: z.string().date().optional(),
    validThrough: z.string().date().optional(),
    evidence: z.array(OwnerEvidenceSchema).max(100).default([]),
    note: z.string().trim().max(2000).optional(),
}).strict();
const RespondRequestSchema = z.object({
    scope: CanonicalMusicCatalogScopeSchema,
    claimId: InternalEntityIdSchema,
    status: z.enum(['ASSERTED', 'DISPUTED', 'WITHDRAWN']),
    note: z.string().trim().max(2000).optional(),
}).strict();

type RequestAdmission = (request: CallableRequest<unknown>, operation: string) => Promise<string>;

export async function resolveClaimsInbox(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: RequestAdmission;
        store?: CanonicalMusicCatalogStore;
    } = {},
) {
    const parsed = ReadRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid canonical catalog scope is required.');
    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(request, 'claims-inbox-read');
    return (dependencies.store ?? createCanonicalMusicCatalogStore())
        .readClaimsInboxInput(uid, parsed.data.scope);
}

export async function resolveDeclareRightsClaim(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: RequestAdmission;
        store?: CanonicalMusicCatalogStore;
        now?: () => Date;
        createId?: () => string;
    } = {},
) {
    const parsed = DeclareRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'The owner-declared rights claim is invalid.');
    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(request, 'claims-inbox-declare');
    const now = (dependencies.now ?? (() => new Date()))().toISOString();
    const id = `claim:${(dependencies.createId ?? randomUUID)()}`;
    const claim = {
        schemaVersion: 'rights-claim.v1' as const,
        id,
        targetEntityId: parsed.data.targetEntityId,
        ...(parsed.data.claimantEntityId ? { claimantEntityId: parsed.data.claimantEntityId } : {}),
        type: parsed.data.type,
        status: 'ASSERTED' as const,
        ...(parsed.data.sharePercentage === undefined ? {} : { sharePercentage: parsed.data.sharePercentage }),
        territoryCodes: parsed.data.territoryCodes,
        ...(parsed.data.validFrom ? { validFrom: parsed.data.validFrom } : {}),
        ...(parsed.data.validThrough ? { validThrough: parsed.data.validThrough } : {}),
        provenance: {
            state: 'USER_DECLARED' as const,
            sourceType: 'USER' as const,
            sourceId: uid,
            observedAt: now,
            evidence: parsed.data.evidence,
            note: parsed.data.note ?? 'Owner-declared intake; requires human review.',
        },
        createdAt: now,
        updatedAt: now,
    };
    return (dependencies.store ?? createCanonicalMusicCatalogStore())
        .appendUserDeclaredClaim(uid, parsed.data.scope, claim);
}

export async function resolveRespondToRightsClaim(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: RequestAdmission;
        store?: CanonicalMusicCatalogStore;
    } = {},
) {
    const parsed = RespondRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'The claim response is invalid.');
    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(request, 'claims-inbox-respond');
    return (dependencies.store ?? createCanonicalMusicCatalogStore())
        .respondToUserDeclaredClaim(uid, parsed.data.scope, parsed.data.claimId, {
            status: parsed.data.status,
            ...(parsed.data.note ? { note: parsed.data.note } : {}),
        });
}

export const getCanonicalClaimsInbox = onCall(
    organizationAccessCallableOptions,
    request => resolveClaimsInbox(request),
);

export const declareCanonicalRightsClaim = onCall(
    organizationAccessCallableOptions,
    request => resolveDeclareRightsClaim(request),
);

export const respondToCanonicalRightsClaim = onCall(
    organizationAccessCallableOptions,
    request => resolveRespondToRightsClaim(request),
);
