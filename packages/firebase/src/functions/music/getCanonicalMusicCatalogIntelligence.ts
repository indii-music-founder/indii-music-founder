import { analyzeCatalogIntelligence } from '@indii/shared';
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

export const getCanonicalMusicCatalogIntelligence = onCall(
    organizationAccessCallableOptions,
    request => resolveCanonicalMusicCatalogIntelligence(request),
);
