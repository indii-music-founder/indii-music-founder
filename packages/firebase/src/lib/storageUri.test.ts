import { describe, it, expect } from 'vitest';
import { parseStorageUri, assertUserOwnsStoragePath } from './storageUri';

describe('parseStorageUri', () => {
    it('parses a gs:// URI into bucket + path', () => {
        expect(parseStorageUri('gs://my-bucket/creative/u1/video/a.mp4')).toEqual({
            bucket: 'my-bucket',
            path: 'creative/u1/video/a.mp4',
        });
    });

    it('parses a Firebase Storage download URL', () => {
        expect(parseStorageUri('https://firebasestorage.googleapis.com/v0/b/my-bucket/o/creative%2Fu1%2Fa.mp4?alt=media')).toEqual({
            bucket: 'my-bucket',
            path: 'creative/u1/a.mp4',
        });
    });

    it('parses a storage.googleapis.com URL', () => {
        expect(parseStorageUri('https://storage.googleapis.com/my-bucket/creative/u1/a.mp4')).toEqual({
            bucket: 'my-bucket',
            path: 'creative/u1/a.mp4',
        });
    });

    it('throws invalid-argument for a gs:// URI missing an object path', () => {
        expect(() => parseStorageUri('gs://my-bucket')).toThrow('bucket and object path');
        expect(() => parseStorageUri('gs://my-bucket/')).toThrow('bucket and object path');
    });

    it('throws invalid-argument for a malformed URL', () => {
        expect(() => parseStorageUri('not a url at all')).toThrow('not a valid URL');
    });

    it('throws invalid-argument for an unsupported host', () => {
        expect(() => parseStorageUri('https://example.com/file.mp4')).toThrow('Only Firebase Storage');
    });

    it('throws invalid-argument for a firebasestorage URL missing the object segment', () => {
        expect(() => parseStorageUri('https://firebasestorage.googleapis.com/v0/b/my-bucket')).toThrow('missing bucket or object path');
    });
});

describe('assertUserOwnsStoragePath', () => {
    it('allows a path under the user\'s creative prefix', () => {
        expect(() => assertUserOwnsStoragePath('creative/u1/video/outputs/a.mp4', 'u1')).not.toThrow();
    });

    it('allows a path under the user\'s generated_images prefix', () => {
        expect(() => assertUserOwnsStoragePath('users/u1/generated_images/a.png', 'u1')).not.toThrow();
    });

    it('allows Creative Edit objects and masks under the user\'s vault prefix', () => {
        expect(() => assertUserOwnsStoragePath('users/u1/vault/objects/source.png', 'u1')).not.toThrow();
        expect(() => assertUserOwnsStoragePath('users/u1/vault/masks/edit-mask.png', 'u1')).not.toThrow();
    });

    it('allows a path under the user\'s videos prefix', () => {
        expect(() => assertUserOwnsStoragePath('videos/u1/job123.mp4', 'u1')).not.toThrow();
    });

    it('rejects a path scoped to a different user', () => {
        expect(() => assertUserOwnsStoragePath('creative/someone-else/video/a.mp4', 'u1')).toThrow('outside the authenticated user scope');
        expect(() => assertUserOwnsStoragePath('users/someone-else/vault/masks/edit-mask.png', 'u1')).toThrow('outside the authenticated user scope');
    });

    it('rejects a path with no recognized prefix at all', () => {
        expect(() => assertUserOwnsStoragePath('public/shared/a.mp4', 'u1')).toThrow('outside the authenticated user scope');
    });

    it('rejects a prefix-confusable path (u1 vs u10)', () => {
        // "creative/u10/..." must not be treated as owned by user "u1" via naive startsWith on the id alone.
        expect(() => assertUserOwnsStoragePath('creative/u10/video/a.mp4', 'u1')).toThrow('outside the authenticated user scope');
    });
});
