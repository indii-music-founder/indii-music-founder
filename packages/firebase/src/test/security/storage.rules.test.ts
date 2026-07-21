import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

describe('owner-bound long-recording staging', () => {
    let testEnv: RulesTestEnvironment;
    const sessionId = 'd'.repeat(40);
    const path = `session-media/${OWNER_ID}/${sessionId}/staging/original.mp4`;
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const customMetadata = {
        ownerUid: OWNER_ID,
        organizationId: 'org-video-1',
        projectId: 'project-video-1',
        sessionId,
        uploadSessionId: `upload-${sessionId}`,
    };

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            // Cross-service Storage Rules reads are routed through the CLI's
            // active emulator project, so this suite must use that same ID.
            projectId: 'indii-music-founder',
            firestore: {
                host: '127.0.0.1',
                port: 8080,
                rules: readFileSync(resolve(process.cwd(), 'packages/firebase/firestore.rules'), 'utf8'),
            },
            storage: {
                host: '127.0.0.1',
                port: 9199,
                rules: readFileSync(resolve(process.cwd(), 'packages/firebase/storage.rules'), 'utf8'),
            },
        });
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'videoSessions', sessionId), {
                schemaVersion: 'video-session.v1',
                sessionId,
                ownerUid: OWNER_ID,
                organizationId: customMetadata.organizationId,
                projectId: customMetadata.projectId,
                uploadSessionId: customMetadata.uploadSessionId,
                stagingPath: path,
                expectedByteSize: bytes.byteLength,
                expectedMimeType: 'video/mp4',
                status: 'uploading',
            });
        });
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    const storageFor = (uid: string) => testEnv.authenticatedContext(uid, {
        email: `${uid}@example.com`,
        firebase: { sign_in_provider: 'password' },
    }).storage();

    it('allows the owner to upload only the exact authorized staging object', async () => {
        await assertSucceeds(uploadBytes(ref(storageFor(OWNER_ID), path), bytes, {
            contentType: 'video/mp4',
            customMetadata,
        }));
    });

    it('denies cross-owner use and identity metadata substitution', async () => {
        await assertFails(uploadBytes(ref(storageFor('other-user'), path), bytes, {
            contentType: 'video/mp4',
            customMetadata: { ...customMetadata, ownerUid: 'other-user' },
        }));
        await assertFails(uploadBytes(ref(storageFor(OWNER_ID), path), bytes, {
            contentType: 'video/mp4',
            customMetadata: { ...customMetadata, projectId: 'attacker-project' },
        }));
    });

    it('denies mismatched size/MIME and client-managed originals', async () => {
        await assertFails(uploadBytes(ref(storageFor(OWNER_ID), path), new Uint8Array([1]), {
            contentType: 'video/mp4',
            customMetadata,
        }));
        await assertFails(uploadBytes(ref(storageFor(OWNER_ID), path), bytes, {
            contentType: 'video/webm',
            customMetadata,
        }));
        await assertFails(uploadBytes(
            ref(storageFor(OWNER_ID), `session-media/${OWNER_ID}/${sessionId}/original/${HASH}.mp4`),
            bytes,
            { contentType: 'video/mp4', customMetadata },
        ));
    });

    it('prevents client deletion of staging and managed objects', async () => {
        const staging = ref(storageFor(OWNER_ID), path);
        await assertSucceeds(uploadBytes(staging, bytes, { contentType: 'video/mp4', customMetadata }));
        await assertFails(deleteObject(staging));
    });
});
