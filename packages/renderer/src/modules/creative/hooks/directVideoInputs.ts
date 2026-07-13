export function resolveDirectVideoFirstFrame(
    explicitFirstFrame?: string,
): string | undefined {
    // References guide generation; they are never silently promoted to a start frame.
    return explicitFirstFrame;
}

export type DirectVideoReferenceRole = 'ingredient' | 'character_reference' | 'whisk_reference';
export type DirectVideoManifestRole = 'first_frame' | 'last_frame' | DirectVideoReferenceRole;

export interface DirectVideoInputManifestEntry {
    role: DirectVideoManifestRole;
    uri: string;
}

export function buildDirectVideoInputManifest(params: {
    explicitFirstFrame?: string;
    explicitLastFrame?: string;
    ingredients?: string[];
    characterReferences?: string[];
    whiskReferences?: string[];
}): {
    firstFrame?: string;
    lastFrame?: string;
    references: Array<{ uri: string; role: DirectVideoReferenceRole }>;
    inputManifest: DirectVideoInputManifestEntry[];
} {
    const firstFrame = resolveDirectVideoFirstFrame(params.explicitFirstFrame);
    const lastFrame = params.explicitLastFrame;
    const references = [
        ...(params.ingredients ?? []).filter(Boolean).map(uri => ({ uri, role: 'ingredient' as const })),
        ...(params.characterReferences ?? []).filter(Boolean).map(uri => ({ uri, role: 'character_reference' as const })),
        ...(params.whiskReferences ?? []).filter(Boolean).map(uri => ({ uri, role: 'whisk_reference' as const })),
    ].slice(0, 3);
    return {
        firstFrame,
        lastFrame,
        references,
        inputManifest: [
            ...(firstFrame ? [{ role: 'first_frame' as const, uri: firstFrame }] : []),
            ...(lastFrame ? [{ role: 'last_frame' as const, uri: lastFrame }] : []),
            ...references,
        ],
    };
}
