import { CatalogIntelligenceReportSchema, type CatalogIntelligenceReport } from '@indii/shared';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';

export async function loadCanonicalCatalogIntelligence(userId: string): Promise<CatalogIntelligenceReport> {
    if (!userId.trim()) throw new Error('An authenticated user is required to read canonical catalog intelligence.');
    if (!functions) throw new Error('Canonical catalog intelligence is unavailable.');

    const read = httpsCallable<{ scope: { kind: 'user'; id: string } }, unknown>(
        functions,
        'getCanonicalMusicCatalogIntelligence',
    );
    const response = await read({ scope: { kind: 'user', id: userId } });
    return CatalogIntelligenceReportSchema.parse(response.data);
}
