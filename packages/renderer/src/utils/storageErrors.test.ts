import { describe, expect, it } from 'vitest';
import { isStorageObjectNotFound } from './storageErrors';

describe('idempotent Storage deletion classification', () => {
    it('recognizes only the exact missing-object code', () => {
        expect(isStorageObjectNotFound({ code: 'storage/object-not-found' })).toBe(true);
        for (const code of ['storage/unauthorized', 'storage/unauthenticated', 'storage/retry-limit-exceeded', 'storage/unknown', 404]) {
            expect(isStorageObjectNotFound({ code })).toBe(false);
        }
    });

    it('does not classify missing-object text or unstructured errors as success', () => {
        for (const error of [null, undefined, 'storage/object-not-found', new Error('File not found'), {}, { message: 'storage/object-not-found' }]) {
            expect(isStorageObjectNotFound(error)).toBe(false);
        }
    });
});
