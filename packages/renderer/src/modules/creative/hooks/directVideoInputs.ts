export function resolveDirectVideoFirstFrame(
    explicitFirstFrame?: string,
    firstIngredient?: string,
    firstCharacterReference?: string,
): string | undefined {
    return explicitFirstFrame || firstIngredient || firstCharacterReference;
}
