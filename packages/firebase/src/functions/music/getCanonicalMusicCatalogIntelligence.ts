import { analyzeCatalogIntelligence } from '@indii/shared';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import {
    CanonicalMusicCatalogScopeSchema,
    createCanonicalMusicCatalogStore,
    type CanonicalMusicCatalogStore,
} from './canonicalMusicCatalogStore';
import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../security/arcjet';
import {
    admitOrganizationAccessRequest,
    organizationAccessCallableOptions,
} from '../security/organizationAccess';

const RequestSchema = z.object({
    scope: CanonicalMusicCatalogScopeSchema,
}).strict();

export async function resolveCanonicalMusicCatalogIntelligence(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: typeof admitOrganizationAccessRequest;
        store?: CanonicalMusicCatalogStore;
    } = {},
) {
    const parsed = RequestSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'A valid canonical catalog scope is required.');
    }

    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(
        request,
        'canonical-music-catalog-intelligence-read',
    );
    const store = dependencies.store ?? createCanonicalMusicCatalogStore();
    const input = await store.readCatalogIntelligenceInput(uid, parsed.data.scope);
    return analyzeCatalogIntelligence(input);
}

export const canonicalMusicCatalogIntelligenceCallableOptions = {
    secrets: [arcjetKey],
    enforceAppCheck: false,
    region: 'us-central1' as const,
    timeoutSeconds: 30,
    memory: '512MiB' as const,
};

export const getCanonicalMusicCatalogIntelligence = onCall(
    canonicalMusicCatalogIntelligenceCallableOptions,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'A valid canonical catalog scope is required.');
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `canonical-music-catalog-intelligence:${request.auth.uid}`,
            });
            if (!protection.allowed) {
                throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
            }
        }
        return resolveCanonicalMusicCatalogIntelligence(request);
    },
);
