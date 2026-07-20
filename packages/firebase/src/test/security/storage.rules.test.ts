import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

const PROJECT_ID = 'indii-storage-rules-test';
const OWNER_ID = 'owner-1';
const HASH = 'a'.repeat(64);

describe('immutable canonical masters', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            storage: {
                host: '127.0.0.1',
                port: 9199,
                rules: readFileSync(resolve(process.cwd(), 'packages/firebase/storage.rules'), 'utf8'),
            },
        });
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    function ownerStorage() {
        return testEnv.authenticatedContext(OWNER_ID, {
            email: 'owner@example.com',
            firebase: { sign_in_provider: 'password' },
        }).storage();
    }

    function otherUserStorage() {
        return testEnv.authenticatedContext('other-user', {
            email: 'other@example.com',
            firebase: { sign_in_provider: 'password' },
        }).storage();
    }

    const metadata = {
        contentType: 'audio/wav',
        customMetadata: {
            contentHash: HASH,
            immutable: 'true',
            masterFingerprint: 'SONIC-owner-master',
            ownerId: OWNER_ID,
            originalFileName: 'master.wav',
        },
    };

    it('allows the owner to create a valid content-addressed master exactly once', async () => {
        const master = ref(ownerStorage(), `masters/${OWNER_ID}/${HASH}/original.wav`);
        await assertSucceeds(uploadBytes(master, new Uint8Array([1, 2, 3]), metadata));
        await assertFails(uploadBytes(master, new Uint8Array([4, 5, 6]), metadata));
    });

    it('prevents the owner from deleting a canonical master', async () => {
        const master = ref(ownerStorage(), `masters/${OWNER_ID}/${HASH}/original.wav`);
        await assertFails(deleteObject(master));
    });

    it('rejects paths whose content hash or immutable metadata is malformed', async () => {
        const malformed = ref(ownerStorage(), `masters/${OWNER_ID}/not-a-hash/original.wav`);
        await assertFails(uploadBytes(malformed, new Uint8Array([1]), metadata));

        const missingProtection = ref(ownerStorage(), `masters/${OWNER_ID}/${'b'.repeat(64)}/original.wav`);
        await assertFails(uploadBytes(missingProtection, new Uint8Array([1]), {
            contentType: 'audio/wav',
            customMetadata: {
                contentHash: 'b'.repeat(64),
                ownerId: OWNER_ID,
            },
        }));
    });

    it('prevents another account from reading or writing the owner master', async () => {
        const master = ref(otherUserStorage(), `masters/${OWNER_ID}/${HASH}/original.wav`);
        await assertFails(getMetadata(master));
        await assertFails(uploadBytes(master, new Uint8Array([9]), {
            ...metadata,
            customMetadata: {
                ...metadata.customMetadata,
                ownerId: 'other-user',
            },
        }));
    });
});

describe('immutable canonical cover art', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: `${PROJECT_ID}-covers`,
            storage: {
                host: '127.0.0.1',
                port: 9199,
                rules: readFileSync(resolve(process.cwd(), 'packages/firebase/storage.rules'), 'utf8'),
            },
        });
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    function ownerStorage() {
        return testEnv.authenticatedContext(OWNER_ID, {
            email: 'owner@example.com',
            firebase: { sign_in_provider: 'password' },
        }).storage();
    }

    function otherUserStorage() {
        return testEnv.authenticatedContext('other-user', {
            email: 'other@example.com',
            firebase: { sign_in_provider: 'password' },
        }).storage();
    }

    const metadata = {
        contentType: 'image/png',
        customMetadata: {
            contentHash: HASH,
            immutable: 'true',
            ownerId: OWNER_ID,
            originalFileName: 'release-cover.png',
        },
    };

    it('allows an owner to create a canonical JPEG/PNG cover exactly once', async () => {
        const cover = ref(ownerStorage(), `covers/${OWNER_ID}/${HASH}/original.png`);
        await assertSucceeds(uploadBytes(cover, new Uint8Array([137, 80, 78, 71]), metadata));
        await assertFails(uploadBytes(cover, new Uint8Array([137, 80, 78, 72]), metadata));
    });

    it('rejects mutable, malformed, and cross-owner canonical cover writes', async () => {
        const missingProtection = ref(ownerStorage(), `covers/${OWNER_ID}/${'b'.repeat(64)}/original.jpg`);
        await assertFails(uploadBytes(missingProtection, new Uint8Array([1]), {
            contentType: 'image/jpeg',
            customMetadata: { contentHash: 'b'.repeat(64), ownerId: OWNER_ID },
        }));

        const malformed = ref(ownerStorage(), `covers/${OWNER_ID}/not-a-hash/original.png`);
        await assertFails(uploadBytes(malformed, new Uint8Array([1]), metadata));

        const foreign = ref(otherUserStorage(), `covers/${OWNER_ID}/${HASH}/original.png`);
        await assertFails(getMetadata(foreign));
        await assertFails(uploadBytes(foreign, new Uint8Array([1]), {
            ...metadata,
            customMetadata: { ...metadata.customMetadata, ownerId: 'other-user' },
        }));
    });

    it('prevents owner deletion and replacement after canonical cover creation', async () => {
        const cover = ref(ownerStorage(), `covers/${OWNER_ID}/${'c'.repeat(64)}/original.png`);
        const coverMetadata = {
            ...metadata,
            customMetadata: { ...metadata.customMetadata, contentHash: 'c'.repeat(64) },
        };
        await assertSucceeds(uploadBytes(cover, new Uint8Array([137, 80, 78, 71]), coverMetadata));
        await assertFails(deleteObject(cover));
    });
});
