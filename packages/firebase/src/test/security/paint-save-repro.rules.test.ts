/**
 * Live repro: founder painting-save "Failed to create file/folder".
 *
 * Replays the EXACT document the canvas painting save flow writes to
 * file_nodes (creativeHistorySlice.addToHistory -> createFileNode ->
 * FileSystemService.createNode -> FirestoreService.add) against the CURRENT
 * firestore.rules in the emulator, as a verified (Google) user.
 *
 * Run: firebase emulators:exec --only firestore --project indii-os-rules-test
 *        "npm run test:rules -- --run paint-save-repro"
 */
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createConnection } from 'net';
import { describe, it, beforeAll, afterAll } from 'vitest';

const PROJECT_ID = 'indii-os-rules-test';
const FOUNDER_UID = 'g2AcFApNZvQKYlGg0LQuVADCFoO2';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_TEST_HOST ?? 'localhost';
const EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080);

function checkEmulatorAvailable(): Promise<boolean> {
    return new Promise((res) => {
        const socket = createConnection({ host: EMULATOR_HOST, port: EMULATOR_PORT }, () => {
            socket.destroy();
            res(true);
        });
        socket.on('error', () => res(false));
    });
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    const available = await checkEmulatorAvailable();
    if (!available) {
        throw new Error('Firestore emulator not available on localhost:8080');
    }
    const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { host: EMULATOR_HOST, port: EMULATOR_PORT, rules },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

describe('painting-save file_nodes create (founder repro)', () => {
    it('ALLOWS the exact painting-save write as a verified Google user', async () => {
        // Same pattern as the main rules suite: authenticatedContext(uid)
        // yields a verified (non-anonymous) session by default.
        const db = testEnv.authenticatedContext(FOUNDER_UID).firestore();

        // Exact shape from FirestoreService.add: name/type/fileType/parentId/
        // projectId/userId/data + createdAt/updatedAt Timestamps.
        const now = Timestamp.now();
        const paintingSaveDoc = {
            name: 'canvas-export-repro.png',
            type: 'file',
            fileType: 'image',
            parentId: null,
            projectId: 'default-project',
            userId: FOUNDER_UID,
            data: {
                url: 'https://firebasestorage.googleapis.com/v0/b/indii-music-founder.firebasestorage.app/o/users%2Fg2AcFApNZvQKYlGg0LQuVADCFoO2%2Fassets%2Frepro',
                storagePath: 'users/g2AcFApNZvQKYlGg0LQuVADCFoO2/assets/repro',
                origin: 'canvas-export',
                mimeType: 'image/png',
            },
            createdAt: now,
            updatedAt: now,
        };

        await assertSucceeds(setDoc(doc(db, 'file_nodes', 'paint-save-repro'), paintingSaveDoc));
    });

    it('DENIES the same write for an anonymous/guest session (session-restore failure case)', async () => {
        const db = testEnv.authenticatedContext('anon-uid-003', {
            firebase: { sign_in_provider: 'anonymous' },
        }).firestore();

        const now = Timestamp.now();
        await assertFails(setDoc(doc(db, 'file_nodes', 'paint-save-repro-anon'), {
            name: 'canvas-export-repro.png',
            type: 'file',
            fileType: 'image',
            parentId: null,
            projectId: 'default-project',
            userId: 'anon-uid-003',
            createdAt: now,
            updatedAt: now,
        }));
    });

    it('ALLOWS the exact write with orgId: "personal" (currentOrganizationId enrichment)', async () => {
        // Same pattern as the main rules suite: authenticatedContext(uid)
        // yields a verified (non-anonymous) session by default.
        const db = testEnv.authenticatedContext(FOUNDER_UID).firestore();

        const now = Timestamp.now();
        await assertSucceeds(setDoc(doc(db, 'file_nodes', 'paint-save-repro-org'), {
            name: 'canvas-export-repro.png',
            type: 'file',
            fileType: 'image',
            parentId: null,
            projectId: 'default-project',
            userId: FOUNDER_UID,
            orgId: 'personal',
            createdAt: now,
            updatedAt: now,
        }));
    });
});
