/** Pure validation and metadata interpretation; no authentication or database simulation. */
export function parseClearanceTrackId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 ||
        value.includes('/') || value.includes('\\') || value.includes('\0') ||
        value.trim() === '.' || value.trim() === '..') {
        throw new TypeError('trackId must be a non-empty document identifier of at most 200 characters.');
    }
    return value.trim();
}

/** User-scoped paths confer ownership; legacy documents require explicit userId. */
export function clearanceTrackOwnerAllowed(scope: 'user' | 'legacy', actorUid: string, storedUserId: unknown): boolean {
    if (!actorUid) return false;
    return storedUserId === actorUid || (scope === 'user' && storedUserId === undefined);
}

export function summarizeSampleDeclarations(samplesInput: unknown, interpolationsInput: unknown, clearanceStatusInput: unknown) {
    const samples = samplesInput || [];
    const interpolations = interpolationsInput || [];
    const clearanceStatus = clearanceStatusInput || 'unverified';

    // Determine verdict: DECLARED-BUT-UNVERIFIED or NONE-DECLARED
    const hasSampleMetadata = Array.isArray(samples) && samples.length > 0;
    const hasInterpolationMetadata = Array.isArray(interpolations) && interpolations.length > 0;
    const samplesDeclarationCount = (hasSampleMetadata ? samples.length : 0) + (hasInterpolationMetadata ? interpolations.length : 0);

    let verdict = 'NONE-DECLARED';
    const warnings: string[] = [];

    if (samplesDeclarationCount > 0) {
        verdict = 'DECLARED-BUT-UNVERIFIED';
        warnings.push(`Track declares ${samplesDeclarationCount} sample(s)/interpolation(s) but clearanceStatus is '${clearanceStatus}' — no fingerprint verification has been performed.`);
        if (clearanceStatus === 'unverified') {
            warnings.push('CRITICAL: Verify clearance with rights holders before commercial use. Declared samples have NOT been validated.');
        }
    } else {
        warnings.push('No samples or interpolations declared in track metadata.');
    }

    warnings.push('P7a interim: metadata-declaration check only. Full fingerprint analysis (P7b) pending vendor integration.');
    return {
        warnings,
        data: {
            verdict, samplesDeclarationCount, hasSampleMetadata, hasInterpolationMetadata,
            clearanceStatus, fingerprintAnalysisAvailable: false,
            note: 'This is a metadata check only. Fingerprint analysis (P7b) requires vendor credentials.',
        },
    };
}
