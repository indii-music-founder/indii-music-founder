import type { Provenance } from '@indii/shared';

export interface AudioMatchQuery {
    recordingEntityId: string;
    fingerprint: string;
}

export interface AudioMatchResult {
    providerId: string;
    candidateEntityId: string;
    matchType: 'EXACT_FINGERPRINT' | 'SIMILARITY';
    confidence: number;
    provenance: Provenance;
}

export interface AudioMatchProvider {
    readonly providerId: string;
    match(query: AudioMatchQuery): Promise<AudioMatchResult[]>;
}

/** Provider-neutral orchestration; match evidence never becomes a rights fact. */
export class AudioMatchEngine {
    constructor(private readonly providers: readonly AudioMatchProvider[]) {}

    async match(query: AudioMatchQuery): Promise<AudioMatchResult[]> {
        const batches = await Promise.all(this.providers.map((provider) => provider.match(query)));
        return batches.flat().sort((left, right) => right.confidence - left.confidence);
    }
}

/** Reuses the existing fingerprint/catalog boundary through an injected lookup. */
export class KnownCatalogFingerprintProvider implements AudioMatchProvider {
    readonly providerId = 'indii-known-catalog';

    constructor(private readonly lookupEntityId: (fingerprint: string) => Promise<string | null>) {}

    async match(query: AudioMatchQuery): Promise<AudioMatchResult[]> {
        const candidateEntityId = await this.lookupEntityId(query.fingerprint);
        if (!candidateEntityId || candidateEntityId === query.recordingEntityId) return [];
        const observedAt = new Date().toISOString();
        return [{
            providerId: this.providerId, candidateEntityId, matchType: 'EXACT_FINGERPRINT', confidence: 1,
            provenance: { state: 'DETECTED', sourceType: 'SYSTEM', sourceId: this.providerId, evidence: [], observedAt },
        }];
    }
}
