/** Only an already-absent object is a successful idempotent deletion. */
export function isStorageObjectNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null
        && 'code' in error && error.code === 'storage/object-not-found';
}
