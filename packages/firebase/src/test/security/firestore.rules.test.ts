/**
 * Item 253: Firestore Security Rules Unit Tests
 *
 * Tests run against the Firebase Emulator (localhost:8080).
 * Requires: firebase emulators:start --only firestore
 *
 * Run via: npm run test:rules
 *
 * The suite fails closed when the emulator is unavailable. CI must start it
 * with firebase emulators:exec so a missing emulator can never look green.
 *
 * Coverage:
 *  - Unauthenticated access denial
 *  - Owner-only access for user documents / subcollections
 *  - Cross-user access denial
 *  - Anonymous user blocked from commercial operations
 *  - Organization deletion hard-blocked (allow delete: if false)
 *  - Tax profile deletion hard-blocked (allow delete: if false)
 *  - ISRC update/delete hard-blocked (immutable identifiers)
 *  - Rate-limit docId format enforcement
 *  - Finance collections (revenue, expenses) owner-only
 *  - License reads: verified users only, anonymous denied
 *  - ddexReleases: verified + org-member only, anonymous denied
 */

import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    collection,
    getDocs,
    limit,
    query,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createConnection } from 'net';
import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'indii-os-rules-test';
const ALICE_UID = 'alice-uid-001';
const BOB_UID = 'bob-uid-002';
const ANON_UID = 'anon-uid-003';
const ORG_ID = 'org-test-001';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_TEST_HOST ?? 'localhost';
const EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_TEST_PORT ?? 8080);

// Token that simulates an anonymous Firebase session
// `as const` matters: without it `sign_in_provider` widens to `string`, which is
// not assignable to the SDK's `FirebaseSignInProvider` union.
const ANON_TOKEN = { firebase: { sign_in_provider: 'anonymous' } } as const;

// ──────────────────────────────────────────────────────────────────────────────
// Emulator availability check
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Probe whether the Firestore emulator is listening on localhost:8080.
 * Returns true if a TCP handshake succeeds within 2 seconds.
 */
function checkEmulatorAvailable(): Promise<boolean> {
    return new Promise((res) => {
        const socket = createConnection({ host: EMULATOR_HOST, port: EMULATOR_PORT }, () => {
            socket.destroy();
            res(true);
        });
        socket.on('error', () => {
            socket.destroy();
            res(false);
        });
        socket.setTimeout(2000, () => {
            socket.destroy();
            res(false);
        });
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Main test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('Firestore Security Rules', () => {
    let testEnv: RulesTestEnvironment;
    let emulatorAvailable = false;

    // ── Helpers (safe to define even if emulator is down) ─────────────────
    const verifiedCtx = (uid: string) => testEnv.authenticatedContext(uid);
    const anonCtx = () => testEnv.authenticatedContext(ANON_UID, ANON_TOKEN);
    const unauthCtx = () => testEnv.unauthenticatedContext();
    const orgDoc = (ownerId: string, ...members: string[]) => ({
        name: 'Test Org',
        ownerId: ownerId,
        members: [ownerId, ...members],
        createdAt: Timestamp.now(),
    });

    // ── Lifecycle ────────────────────────────────────────────────────────
    beforeAll(async () => {
        emulatorAvailable = await checkEmulatorAvailable();
        if (!emulatorAvailable) {
            throw new Error(
                'Firestore Emulator is required on localhost:8080. ' +
                'Run: firebase emulators:exec --only firestore,storage "npm run test:rules"'
            );
        }

        const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: { rules, host: EMULATOR_HOST, port: EMULATOR_PORT },
        });
    });

    afterAll(async () => {
        if (testEnv) {
            await testEnv.cleanup();
        }
    });

    afterEach(async () => {
        if (testEnv) {
            await testEnv.clearFirestore();
        }
    });

    /** Guard — call at the start of every `beforeEach` and `it` that touches emulator */
    function requireEmulator() {
        if (!emulatorAvailable) {
            // Using expect + return pattern so the test body is a no-op
            return true;
        }
        return false;
    }

    // ──────────────────────────────────────────────────────────────────────
    // 1. USER DOCUMENTS (/users/{userId})
    // ──────────────────────────────────────────────────────────────────────

    describe('users/{userId}', () => {
        const aliceUserDoc = { id: ALICE_UID, email: 'alice@test.com', role: 'artist', onboarded: true, isPublic: true };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), aliceUserDoc);
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID)));
        });

        it('unauthenticated: write denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
        });

        it('owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID)));
        });

        it('owner: write allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
        });

        it('owner: cannot manufacture privileged profile fields', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID), {
                ...aliceUserDoc,
                roles: ['admin'],
            }));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID), {
                ...aliceUserDoc,
                permissions: ['*'],
            }));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID), {
                ...aliceUserDoc,
                role: 'admin',
            }));
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID), {
                isAdmin: true,
            }));
        });

        it('owner: cannot self-assign a billing tier, founder flag, or entitlement', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID), {
                tier: 'founder',
            }));
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID), {
                subscriptionTier: 'founder',
            }));
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID), {
                isFounder: true,
            }));
        });

        it('other user: read denied even when a profile is marked public, so email stays private', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID)));
        });

        it('other user: write denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
        });
    });

    describe('users/{userId}/entitlements and entitlementAudit', () => {
        const entitlement = {
            schemaVersion: 'account-entitlement.v1',
            uid: ALICE_UID,
            tier: 'free',
            status: 'active',
            source: 'verified_email',
            grantId: 'entitlement-grant-1',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                const db = ctx.firestore();
                await setDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current'), entitlement);
                await setDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', entitlement.grantId), entitlement);
            });
        });

        it('owner: may read server-issued access evidence but cannot write it', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current')));
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', entitlement.grantId)));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current'), {
                ...entitlement,
                tier: 'founder',
            }));
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', entitlement.grantId), {
                tier: 'founder',
            }));
            await assertFails(deleteDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current')));
            await assertFails(deleteDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', entitlement.grantId)));
        });

        it('anonymous accounts cannot inspect server-issued access evidence', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current')));
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', entitlement.grantId)));
        });

        it('other users cannot read or forge another owner entitlement', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'entitlements', 'current')));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'entitlementAudit', 'forged'), entitlement));
        });
    });

    describe('users/{userId}/marketingAdWrites', () => {
        const receipt = {
            key: 'campaign-1_adset-1_creative-1',
            userId: ALICE_UID,
            adId: 'meta-ad-1',
            state: 'completed',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'marketingAdWrites', receipt.key), receipt);
            });
        });

        it('keeps paid-write receipts server-only, including from their owner', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const receiptRef = doc(db, 'users', ALICE_UID, 'marketingAdWrites', receipt.key);

            await assertFails(getDoc(receiptRef));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'marketingAdWrites', 'forged'), receipt));
            await assertFails(updateDoc(receiptRef, { state: 'completed' }));
            await assertFails(deleteDoc(receiptRef));
        });
    });

    describe('taxFormRequests/{token}', () => {
        const token = 'a'.repeat(64);
        const requestData = {
            userId: ALICE_UID,
            collaboratorId: 'collaborator-1',
            email: 'collaborator@example.com',
            expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
            consumedAt: null,
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'taxFormRequests', token), requestData);
            });
        });

        it('denies unauthenticated token reads and collection probing', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'taxFormRequests', token)));
            await assertFails(getDocs(query(collection(db, 'taxFormRequests'), limit(1))));
        });

        it('denies all direct client writes, including by the owning artist', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'taxFormRequests', 'b'.repeat(64)), requestData));
            await assertFails(updateDoc(doc(db, 'taxFormRequests', token), { consumedAt: Timestamp.now() }));
            await assertFails(deleteDoc(doc(db, 'taxFormRequests', token)));
        });
    });

    describe('users/{userId}/proSubmissionDrafts/{draftId}', () => {
        const validDraft = {
            workTitle: 'Midnight Drive',
            writers: [{ name: 'Alice Writer', role: 'composer', split: 100 }],
            publisher: null,
            society: 'ASCAP',
            status: 'requires_manual_submission',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        it('allows a verified owner to create and read a bounded manual-submission draft', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const ref = doc(db, 'users', ALICE_UID, 'proSubmissionDrafts', 'draft-1');
            await assertSucceeds(setDoc(ref, validDraft));
            await assertSucceeds(getDoc(ref));
        });

        it('rejects cross-owner writes, schema pollution, and oversized draft data', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(
                doc(bob, 'users', ALICE_UID, 'proSubmissionDrafts', 'forged'),
                validDraft,
            ));
            await assertFails(setDoc(
                doc(alice, 'users', ALICE_UID, 'proSubmissionDrafts', 'polluted'),
                { ...validDraft, privileged: true },
            ));
            await assertFails(setDoc(
                doc(alice, 'users', ALICE_UID, 'proSubmissionDrafts', 'oversized'),
                { ...validDraft, workTitle: 'x'.repeat(301) },
            ));
        });

        it('keeps manual-submission drafts immutable from the client', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(
                    doc(ctx.firestore(), 'users', ALICE_UID, 'proSubmissionDrafts', 'draft-1'),
                    { ...validDraft, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
                );
            });
            const db = verifiedCtx(ALICE_UID).firestore();
            const ref = doc(db, 'users', ALICE_UID, 'proSubmissionDrafts', 'draft-1');
            await assertFails(updateDoc(ref, { status: 'submitted' }));
            await assertFails(deleteDoc(ref));
        });
    });

    describe('users/{userId}/setlists/{setlistId}', () => {
        const validDraft = {
            userId: ALICE_UID,
            venue: 'Test Venue',
            date: '2026-08-09',
            city: 'Detroit',
            attendance: 250,
            songs: [{ id: 'song-1', title: 'Test Song', originalArtist: '', type: 'original' }],
            category: 'original',
            status: 'draft_requires_manual_filing',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        it('allows the owner to create, read, and delete a bounded draft', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const ref = doc(db, 'users', ALICE_UID, 'setlists', 'draft-1');
            await assertSucceeds(setDoc(ref, validDraft));
            await assertSucceeds(getDoc(ref));
            await assertSucceeds(deleteDoc(ref));
        });

        it('rejects cross-owner writes, forged ownership, and schema pollution', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            const ownedRef = doc(alice, 'users', ALICE_UID, 'setlists', 'owned-draft');
            await assertSucceeds(setDoc(ownedRef, validDraft));
            await assertFails(getDoc(doc(bob, 'users', ALICE_UID, 'setlists', 'owned-draft')));
            await assertFails(deleteDoc(doc(bob, 'users', ALICE_UID, 'setlists', 'owned-draft')));
            await assertFails(setDoc(doc(bob, 'users', ALICE_UID, 'setlists', 'forged'), validDraft));
            await assertFails(setDoc(
                doc(alice, 'users', ALICE_UID, 'setlists', 'wrong-owner'),
                { ...validDraft, userId: BOB_UID },
            ));
            await assertFails(setDoc(
                doc(alice, 'users', ALICE_UID, 'setlists', 'polluted'),
                { ...validDraft, estimatedRoyalty: 1000 },
            ));
        });

        it('rejects unauthenticated and anonymous access', async () => {
            if (requireEmulator()) return;
            const refPath = ['users', ALICE_UID, 'setlists', 'draft-1'] as const;
            await assertFails(getDoc(doc(unauthCtx().firestore(), ...refPath)));
            await assertFails(setDoc(doc(anonCtx().firestore(), ...refPath), validDraft));
        });

        it('rejects oversized or invalid drafts and all client updates', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'setlists', 'oversized'),
                { ...validDraft, venue: 'x'.repeat(301) },
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'setlists', 'bad-status'),
                { ...validDraft, status: 'submitted' },
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'setlists', 'empty-songs'),
                { ...validDraft, songs: [] },
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'setlists', 'client-timestamp'),
                { ...validDraft, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
            ));
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(
                    doc(ctx.firestore(), 'users', ALICE_UID, 'setlists', 'draft-1'),
                    { ...validDraft, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
                );
            });
            await assertFails(updateDoc(
                doc(db, 'users', ALICE_UID, 'setlists', 'draft-1'),
                { status: 'submitted' },
            ));
        });
    });

    describe('users/{userId}/agent_queue/{queueId}', () => {
        const queue = {
            tasks: [{ id: 'task-1', status: 'pending', prompt: 'Prepare release assets' }],
            savedAt: serverTimestamp(),
        };

        it('allows only the owner to persist, resume, and clear the bounded queue', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            const ref = doc(alice, 'users', ALICE_UID, 'agent_queue', 'queue');
            await assertSucceeds(setDoc(ref, queue));
            await assertSucceeds(getDoc(ref));
            await assertFails(getDoc(doc(bob, 'users', ALICE_UID, 'agent_queue', 'queue')));
            await assertSucceeds(deleteDoc(ref));
        });

        it('rejects arbitrary queue IDs, extra fields, and unbounded task arrays', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'agent_queue', 'other'), queue));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'agent_queue', 'queue'),
                { ...queue, privileged: true },
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'agent_queue', 'queue'),
                { ...queue, tasks: Array.from({ length: 101 }, (_, id) => ({ id })) },
            ));
        });
    });

    describe('users/{userId}/graphExecutions/{executionId}', () => {
        const execution = {
            graphId: 'release-graph',
            executionId: 'execution-1',
            nodeStates: { prepare: { status: 'PLANNED' } },
            status: 'PLANNED',
            graph: { id: 'release-graph', nodes: [], edges: [] },
            updatedAt: serverTimestamp(),
        };

        it('allows owner lifecycle updates and reads for a valid graph execution', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const ref = doc(db, 'users', ALICE_UID, 'graphExecutions', 'execution-1');
            await assertSucceeds(setDoc(ref, execution));
            await assertSucceeds(updateDoc(ref, {
                status: 'EXECUTING',
                'nodeStates.prepare.status': 'EXECUTING_GENERATION',
                updatedAt: serverTimestamp(),
            }));
            await assertSucceeds(getDoc(ref));
        });

        it('rejects cross-owner access, identity rewrites, and oversized node maps', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            const ref = doc(alice, 'users', ALICE_UID, 'graphExecutions', 'execution-1');
            await assertSucceeds(setDoc(ref, execution));
            await assertFails(getDoc(doc(bob, 'users', ALICE_UID, 'graphExecutions', 'execution-1')));
            await assertFails(updateDoc(ref, { executionId: 'forged', updatedAt: serverTimestamp() }));
            await assertFails(setDoc(
                doc(alice, 'users', ALICE_UID, 'graphExecutions', 'execution-2'),
                {
                    ...execution,
                    executionId: 'execution-2',
                    nodeStates: Object.fromEntries(
                        Array.from({ length: 101 }, (_, id) => [`node-${id}`, { status: 'PLANNED' }]),
                    ),
                },
            ));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 2. USER SUBCOLLECTIONS (/users/{userId}/analyzed_tracks/{trackId})
    // ──────────────────────────────────────────────────────────────────────

    describe('users/{userId}/analyzed_tracks/{trackId}', () => {
        const trackData = {
            id: 'track-1',
            userId: ALICE_UID,
            filename: 'kick.wav',
            features: { bpm: 120, key: 'C', energy: 0.8 },
            analyzedAt: Timestamp.now(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'analyzed_tracks', 'track-1'), trackData);
            });
        });

        it('owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 2b. VIDEO PROJECTS — owner-namespaced (ISSUE-1197)
    //
    // Regression: the timeline document used to live at top-level
    // /videoProjects/{projectId}, where ANY signed-in user could create ANY
    // project id. A squatted id denied the real owner both read and write,
    // which routed straight into the ISSUE-1193 blank-timeline data loss.
    // Namespacing under the owner removes the collision, so id entropy is no
    // longer load-bearing. Found by /qa on 2026-07-22.
    // Report: .agent/test_ledger/OPEN_ISSUES_V2.md (ISSUE-1193, ISSUE-1197)
    // ──────────────────────────────────────────────────────────────────────

    describe('users/{userId}/videoProjects/{projectId} (ISSUE-1197)', () => {
        const timelineDoc = (uid: string) => ({
            id: 'proj-1',
            userId: uid,
            orgId: null,
            project: { id: 'proj-1', name: 'Timeline', fps: 30, durationInFrames: 300, width: 1920, height: 1080, tracks: [], clips: [] },
            revision: 1,
        });
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'videoProjects', 'proj-1'), timelineDoc(ALICE_UID));
            });
        });

        it('owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-1')));
        });

        it('owner: update allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(updateDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-1'), { revision: 2 }));
        });

        it('owner: cannot rewrite userId — ownership is immutable', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-1'), { userId: BOB_UID }));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-1')));
        });

        it('other user: cannot squat a project id inside another user’s namespace', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-unclaimed'), timelineDoc(BOB_UID)));
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'videoProjects', 'proj-1')));
        });
    });

    // MIG-010: cloud render jobs are callable-created and executor-advanced.
    // Owners observe progress; no client can forge, claim, or complete a job.
    describe('users/{userId}/videoRenderJobs/{jobId} (MIG-010)', () => {
        const jobDoc = (uid: string) => ({
            schemaVersion: 'video-render-job.v1',
            jobId: 'job-1',
            userId: uid,
            projectId: 'proj-1',
            status: 'queued',
            executor: null,
            artifactUrl: null,
            artifactGeneration: null,
            error: null,
        });

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'videoRenderJobs', 'job-1'), jobDoc(ALICE_UID));
            });
        });

        it('owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-1')));
        });

        it('owner: cannot create, claim, or complete a job client-side', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-forged'), jobDoc(ALICE_UID)));
            await assertFails(updateDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-1'), { status: 'completed', artifactUrl: 'gs://fake' }));
            await assertFails(deleteDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-1')));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-1')));
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'videoRenderJobs', 'job-1')));
        });
    });

    describe('videoProjects/{projectId} — legacy, read-only (ISSUE-1197)', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'videoProjects', 'legacy-1'), {
                    id: 'legacy-1',
                    userId: ALICE_UID,
                    project: { id: 'legacy-1', name: 'Legacy', fps: 30, durationInFrames: 300, width: 1920, height: 1080, tracks: [], clips: [] },
                });
            });
        });

        it('owner: read still allowed so the doc can be migrated', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'videoProjects', 'legacy-1')));
        });

        it('owner: writes are now closed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'videoProjects', 'legacy-1'), { revision: 2 }));
        });

        it('nobody can squat a new legacy id', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(doc(db, 'videoProjects', 'squatted'), { id: 'squatted', userId: BOB_UID }));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'videoProjects', 'legacy-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 3. ORGANIZATIONS (/organizations/{orgId})
    // ──────────────────────────────────────────────────────────────────────

    describe('organizations/{orgId}', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID));
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
        });

        it('anonymous user: read denied (verified users only)', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
        });

        it('verified member: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'organizations', ORG_ID)));
        });

        it('verified non-member: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
        });

        it('anonymous user: create denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(setDoc(doc(db, 'organizations', 'new-org'), orgDoc(ANON_UID)));
        });

        it('verified member: update allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(updateDoc(doc(db, 'organizations', ORG_ID), { name: 'Updated Name' }));
        });

        it('denies all direct client access to access policies and their audit trail', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID, 'accessPolicies', BOB_UID), {
                    orgId: ORG_ID,
                    userId: BOB_UID,
                    role: 'member',
                    allowedModules: ['files'],
                });
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID, 'accessAudit', 'event-1'), {
                    action: 'organization_access_updated',
                    actorUserId: ALICE_UID,
                    targetUserId: BOB_UID,
                });
            });

            for (const db of [
                verifiedCtx(ALICE_UID).firestore(),
                verifiedCtx(BOB_UID).firestore(),
                unauthCtx().firestore(),
            ]) {
                const policyRef = doc(db, 'organizations', ORG_ID, 'accessPolicies', BOB_UID);
                const auditRef = doc(db, 'organizations', ORG_ID, 'accessAudit', 'event-1');
                await assertFails(getDoc(policyRef));
                await assertFails(setDoc(policyRef, {
                    orgId: ORG_ID,
                    userId: BOB_UID,
                    role: 'owner',
                    allowedModules: ['security'],
                }));
                await assertFails(getDoc(auditRef));
                await assertFails(deleteDoc(auditRef));
            }
        });

        it('delete always denied (allow delete: if false)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(deleteDoc(doc(db, 'organizations', ORG_ID)));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 4. LICENSES (/licenses/{licenseId})
    // ──────────────────────────────────────────────────────────────────────

    describe('licenses/{licenseId}', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'licenses', 'lic-1'), { userId: ALICE_UID, title: 'Beat License' });
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'licenses', 'lic-1')));
        });

        it('anonymous user: read denied (verified users only)', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'licenses', 'lic-1')));
        });

        it('verified user: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'licenses', 'lic-1')));
        });

        it('verified user: cannot read another user\'s license', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'licenses', 'lic-1')));
        });

        it('anonymous user: create denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(setDoc(doc(db, 'licenses', 'lic-anon'), { userId: ANON_UID }));
        });

        it('verified user: cannot forge an active license', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'licenses', 'lic-new'), { userId: ALICE_UID, title: 'New License', status: 'active' }));
        });

        it('verified user: cannot create license for another user', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'licenses', 'lic-fake'), { userId: BOB_UID, title: 'Fake License' }));
        });

        it('owner cannot mutate a server-issued license', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'licenses', 'lic-1'), { userId: BOB_UID }));
            await assertFails(updateDoc(doc(db, 'licenses', 'lic-1'), { status: 'active', usage: 'Anything' }));
            await assertFails(deleteDoc(doc(db, 'licenses', 'lic-1')));
        });

        it('verified user cannot update or delete another user\'s license', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(updateDoc(doc(db, 'licenses', 'lic-1'), { title: 'Hijacked' }));
            await assertFails(deleteDoc(doc(db, 'licenses', 'lic-1')));
        });
    });

    describe('license_requests/{requestId}', () => {
        const validRequest = {
            userId: ALICE_UID,
            title: 'Midnight Blaze',
            artist: 'The Flames',
            usage: 'Online advertising',
            status: 'checking',
            requestedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'license_requests', 'request-1'), validRequest);
            });
        });

        it('allows an owner to create and read a bounded request', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(setDoc(doc(db, 'license_requests', 'request-new'), validRequest));
            await assertSucceeds(getDoc(doc(db, 'license_requests', 'request-1')));
        });

        it('rejects cross-owner access, forged ownership, and unbounded text', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(bob, 'license_requests', 'request-1')));
            await assertFails(setDoc(doc(alice, 'license_requests', 'forged'), { ...validRequest, userId: BOB_UID }));
            await assertFails(setDoc(doc(alice, 'license_requests', 'oversized'), { ...validRequest, notes: 'x'.repeat(5001) }));
        });

        it('allows only owner negotiation updates and keeps identity immutable', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(updateDoc(doc(alice, 'license_requests', 'request-1'), {
                status: 'negotiating',
                updatedAt: new Date(),
            }));
            await assertFails(updateDoc(doc(alice, 'license_requests', 'request-1'), { status: 'approved' }));
            await assertFails(updateDoc(doc(alice, 'license_requests', 'request-1'), { userId: BOB_UID }));
            await assertFails(deleteDoc(doc(alice, 'license_requests', 'request-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 5. DDEX RELEASES (/ddexReleases/{releaseId}) — verified + org-member
    // ──────────────────────────────────────────────────────────────────────

    describe('ddexReleases/{releaseId}', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID));
                await setDoc(doc(ctx.firestore(), 'ddexReleases', 'rel-1'), {
                    orgId: ORG_ID,
                    title: 'Test Album',
                    userId: ALICE_UID,
                });
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
        });

        it('anonymous user: read denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
        });

        it('verified member: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'ddexReleases', 'rel-1')));
        });

        it('verified non-member: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
        });

        it('anonymous user: create denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(setDoc(doc(db, 'ddexReleases', 'rel-anon'), { orgId: ORG_ID, title: 'Anon Release' }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 6. TAX PROFILES (/tax_profiles/{profileId}) — delete hard-blocked
    // ──────────────────────────────────────────────────────────────────────

    describe('tax_profiles/{profileId}', () => {
        const validTaxProfile = {
            userId: ALICE_UID,
            formType: 'W-9' as const,
            country: 'US',
            tinMasked: '***-**-1234',
            tinValid: true,
            certified: true,
            payoutStatus: 'ACTIVE' as const,
            certTimestamp: Timestamp.now(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'tax_profiles', 'tp-alice'), validTaxProfile);
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
        });

        it('anonymous user: read denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
        });

        it('verified owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
        });

        it('other verified user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
        });

        it('verified owner: create with valid schema allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(setDoc(doc(db, 'tax_profiles', 'tp-new'), validTaxProfile));
        });

        it('anonymous user: create denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(setDoc(doc(db, 'tax_profiles', 'tp-anon'), { ...validTaxProfile, userId: ANON_UID }));
        });

        it('delete always denied — compliance record retention (allow delete: if false)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(deleteDoc(doc(db, 'tax_profiles', 'tp-alice')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 7. ISRC REGISTRY (/isrc_registry/{isrcId}) — immutable after create
    // ──────────────────────────────────────────────────────────────────────

    describe('isrc_registry/{isrcId}', () => {
        const validISRC = {
            isrc: 'US-S1Z-25-00001',
            releaseId: 'rel-1',
            userId: ALICE_UID,
            trackTitle: 'Test Track',
            artistName: 'Alice Artist',
            assignedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'isrc_registry', 'isrc-1'), validISRC);
            });
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
        });

        it('anonymous user: read denied', async () => {
            if (requireEmulator()) return;
            const db = anonCtx().firestore();
            await assertFails(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
        });

        it('verified owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
        });

        it('verified owner: direct create denied because identifiers are server-assigned', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'isrc_registry', 'isrc-new'), { ...validISRC, isrc: 'US-S1Z-25-00002' }));
        });

        it('invalid ISRC format: create denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            // Regex: ^[A-Z]{2}-[A-Z0-9]{3}-[0-9]{2}-[0-9]{5}$
            await assertFails(setDoc(doc(db, 'isrc_registry', 'isrc-bad'), { ...validISRC, isrc: 'INVALID-FORMAT' }));
        });

        it('update always denied — ISRCs are permanent identifiers (allow update: if false)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'isrc_registry', 'isrc-1'), { trackTitle: 'Changed Title' }));
        });

        it('delete always denied — ISRCs are permanent identifiers (allow delete: if false)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(deleteDoc(doc(db, 'isrc_registry', 'isrc-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 8. RATE LIMITS (/user_rate_limits/{docId}) — docId format enforcement
    // ──────────────────────────────────────────────────────────────────────

    describe('user_rate_limits/{docId}', () => {
        const rateData = { userId: ALICE_UID, count: 5 };

        it('correct format (userId_timestamp): read allowed', async () => {
            if (requireEmulator()) return;
            const docId = `${ALICE_UID}_1700000000000`;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'user_rate_limits', docId), rateData);
            });
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'user_rate_limits', docId)));
        });

        it('wrong user prefix: read denied', async () => {
            if (requireEmulator()) return;
            const docId = `${ALICE_UID}_1700000000000`;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'user_rate_limits', docId), rateData);
            });
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'user_rate_limits', docId)));
        });

        it('non-numeric suffix: write denied', async () => {
            if (requireEmulator()) return;
            const badDocId = `${ALICE_UID}_abc`;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'user_rate_limits', badDocId), rateData));
        });

        it('unauthenticated: denied', async () => {
            if (requireEmulator()) return;
            const docId = `${ALICE_UID}_1700000000000`;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'user_rate_limits', docId)));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 9. FINANCE COLLECTIONS (/revenue/{revenueId})
    // ──────────────────────────────────────────────────────────────────────

    describe('revenue/{revenueId}', () => {
        const revenueData = { userId: ALICE_UID, amount: 100, source: 'streaming' };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'revenue', 'rev-1'), revenueData);
            });
        });

        it('owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'revenue', 'rev-1')));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'revenue', 'rev-1')));
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'revenue', 'rev-1')));
        });

        it('owner: create denied — revenue is server-origin only', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'revenue', 'rev-new'), revenueData));
        });

        it('other user: create denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(doc(db, 'revenue', 'rev-fake'), revenueData));
        });

        it('owner: update denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(updateDoc(doc(db, 'revenue', 'rev-1'), { amount: 999999 }));
        });

        it('owner: delete denied — financial records are server-managed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(deleteDoc(doc(db, 'revenue', 'rev-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 10. TOP-LEVEL OWNER-BY-FIELD COLLECTIONS (2026-05-28 audit fixes)
    // ──────────────────────────────────────────────────────────────────────

    describe('owner-by-field collections (userId)', () => {
        const ownerByFieldCollections = [
            'career_memory_archive',
            'knowledge_history',
            'google_search_history',
            'sample_requests',
            'sftp_ingestions',
            'video_releases',
        ];

        ownerByFieldCollections.forEach((collName) => {
            describe(`${collName}/{docId}`, () => {
                const docData = { userId: ALICE_UID, content: 'test', createdAt: Timestamp.now() };

                beforeEach(async () => {
                    if (requireEmulator()) return;
                    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                        await setDoc(doc(ctx.firestore(), collName, 'doc-1'), docData);
                    });
                });

                it('owner: read allowed', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(ALICE_UID).firestore();
                    await assertSucceeds(getDoc(doc(db, collName, 'doc-1')));
                });

                it('owner: create allowed (with userId field)', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(ALICE_UID).firestore();
                    await assertSucceeds(
                        setDoc(doc(db, collName, 'doc-new'), { userId: ALICE_UID, content: 'new' })
                    );
                });

                it('other user: read denied', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(BOB_UID).firestore();
                    await assertFails(getDoc(doc(db, collName, 'doc-1')));
                });

                it('other user: create with own userId allowed, different userId denied', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(BOB_UID).firestore();
                    // Bob can create a record with his own userId
                    await assertSucceeds(
                        setDoc(doc(db, collName, 'bob-doc'), { userId: BOB_UID, content: 'bob only' })
                    );
                    // Bob cannot create a record claiming to be Alice
                    await assertFails(
                        setDoc(doc(db, collName, 'fake-alice'), { userId: ALICE_UID, content: 'hijack' })
                    );
                });

                it('unauthenticated: read denied', async () => {
                    if (requireEmulator()) return;
                    const db = unauthCtx().firestore();
                    await assertFails(getDoc(doc(db, collName, 'doc-1')));
                });

                it('unauthenticated: create denied', async () => {
                    if (requireEmulator()) return;
                    const db = unauthCtx().firestore();
                    await assertFails(setDoc(doc(db, collName, 'doc-unauth'), { userId: ALICE_UID }));
                });
            });
        });
    });

    describe('takedown_requests/{docId} (requestedBy field)', () => {
        const takedownData = {
            releaseId: 'release-1',
            reason: 'copyright',
            requestedBy: ALICE_UID,
            status: 'INITIATED',
            createdAt: Timestamp.now(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'takedown_requests', 'td-1'), takedownData);
            });
        });

        it('requester: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'takedown_requests', 'td-1')));
        });

        it('requester: create allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(
                setDoc(doc(db, 'takedown_requests', 'td-new'), {
                    releaseId: 'release-2',
                    reason: 'other',
                    requestedBy: ALICE_UID,
                    status: 'INITIATED',
                })
            );
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'takedown_requests', 'td-1')));
        });

        it('other user: cannot create on behalf of someone else', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'takedown_requests', 'fake'), { ...takedownData, requestedBy: ALICE_UID })
            );
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'takedown_requests', 'td-1')));
        });
    });

    describe('mechanical_licenses/{uid}/licenses/{licenseId} (owner-by-path)', () => {
        const licenseData = { releaseId: 'release-1', licensedAt: Timestamp.now() };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'mechanical_licenses', ALICE_UID, 'licenses', 'lic-1'), licenseData);
            });
        });

        it('owner (uid): read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'mechanical_licenses', ALICE_UID, 'licenses', 'lic-1')));
        });

        it('owner (uid): create allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(
                setDoc(doc(db, 'mechanical_licenses', ALICE_UID, 'licenses', 'lic-new'), {
                    releaseId: 'release-2',
                    licensedAt: Timestamp.now(),
                })
            );
        });

        it('other user: read their own licenses allowed, others denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            // Bob can read his own licenses
            await assertSucceeds(setDoc(doc(db, 'mechanical_licenses', BOB_UID, 'licenses', 'bob-1'), licenseData));
            // Bob cannot read Alice's licenses
            await assertFails(getDoc(doc(db, 'mechanical_licenses', ALICE_UID, 'licenses', 'lic-1')));
        });

        it('unauthenticated: denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'mechanical_licenses', ALICE_UID, 'licenses', 'lic-1')));
        });
    });

    describe('marketplace_drops/{dropId} (public-read / owner-write by ownerId)', () => {
        const dropData = {
            title: 'My Artifact',
            ownerId: ALICE_UID,
            createdAt: Timestamp.now(),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'marketplace_drops', 'drop-1'), dropData);
            });
        });

        it('authenticated: read allowed (public)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'marketplace_drops', 'drop-1')));
        });

        it('unauthenticated: read denied (must be authenticated)', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'marketplace_drops', 'drop-1')));
        });

        it('owner: create allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(
                setDoc(doc(db, 'marketplace_drops', 'drop-new'), {
                    title: 'New Drop',
                    ownerId: ALICE_UID,
                })
            );
        });

        it('other user: cannot create drop for different owner', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'marketplace_drops', 'fake-drop'), {
                    title: 'Fake',
                    ownerId: ALICE_UID,
                })
            );
        });

        it('owner: update own drop allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(updateDoc(doc(db, 'marketplace_drops', 'drop-1'), { title: 'Updated' }));
        });

        it('other user: cannot update others drop', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(updateDoc(doc(db, 'marketplace_drops', 'drop-1'), { title: 'Hijacked' }));
        });
    });

    describe('founderFunnelEvents/{eventId} (public create / no read)', () => {
        const eventData = {
            eventName: 'founder_site_view',
            path: '/',
            url: 'https://founder.indii.music/',
            sessionId: 'ff-12345678',
            source: 'founder',
            detailsJson: '{}',
            occurredAtMs: Date.now(),
            createdAt: Timestamp.now(),
        };

        it('unauthenticated: create allowed for founder funnel event', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertSucceeds(setDoc(doc(db, 'founderFunnelEvents', 'event-1'), eventData));
        });

        it('authenticated: read denied (write-only telemetry)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(db, 'founderFunnelEvents', 'event-1')));
        });
    });

    describe('global read-only collections (content_rules, sample_platforms)', () => {
        const readOnlyCollections = ['content_rules', 'sample_platforms'];

        readOnlyCollections.forEach((collName) => {
            describe(`${collName}/{docId}`, () => {
                const docData = { type: 'test', value: 'data' };

                beforeEach(async () => {
                    if (requireEmulator()) return;
                    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                        await setDoc(doc(ctx.firestore(), collName, 'doc-1'), docData);
                    });
                });

                it('authenticated: read allowed', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(ALICE_UID).firestore();
                    await assertSucceeds(getDoc(doc(db, collName, 'doc-1')));
                });

                it('unauthenticated: read denied', async () => {
                    if (requireEmulator()) return;
                    const db = unauthCtx().firestore();
                    await assertFails(getDoc(doc(db, collName, 'doc-1')));
                });

                it('authenticated: write denied (server-only)', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(ALICE_UID).firestore();
                    await assertFails(setDoc(doc(db, collName, 'doc-new'), docData));
                });

                it('authenticated: update denied (server-only)', async () => {
                    if (requireEmulator()) return;
                    const db = verifiedCtx(ALICE_UID).firestore();
                    await assertFails(updateDoc(doc(db, collName, 'doc-1'), { value: 'changed' }));
                });
            });
        });
    });

    describe('fraud_alerts/{alertId} (interim: create-only, no read)', () => {
        const alertData = {
            type: 'fingerprint_match',
            severity: 'high',
            createdAt: Timestamp.now(),
        };

        it('authenticated: create denied (server-only)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'fraud_alerts', 'alert-1'), alertData));
        });

        it('authenticated: read denied (no client reads)', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'fraud_alerts', 'alert-1'), alertData);
            });
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(db, 'fraud_alerts', 'alert-1')));
        });

        it('unauthenticated: create denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(setDoc(doc(db, 'fraud_alerts', 'alert-unauth'), alertData));
        });
    });

    describe('remote relay Studio executor boundary (ISSUE-1025)', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), { uid: ALICE_UID });
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'remote-relay', 'state'), {
                    role: 'studio', online: true, listenerReady: true, studioInstanceId: 'studio-1'
                });
            });
        });

        it('same-account Controller cannot forge Studio presence or a Studio response', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'remote-relay', 'state'), {
                role: 'studio', online: true, listenerReady: true, studioInstanceId: 'controller-fake'
            }));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'remote-relay-responses', 'forged'), {
                commandId: 'command-1', text: 'forged success', isFinal: true
            }));
        });

        it('same-account Controller cannot reuse a valid executor lease token to write presence', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'studioExecutors', 'studio-device-0001'), {
                    activeLeaseToken: 'server-secret-token',
                    leaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
                });
            });

            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'studioExecutors', 'studio-device-0001')));
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'remote-relay', 'state'), {
                role: 'studio',
                online: true,
                listenerReady: true,
                studioInstanceId: 'controller-fake-0001',
                executorDeviceId: 'studio-device-0001',
                leaseToken: 'server-secret-token',
            }));
        });

        it('same-account Controller can submit then cancel an unclaimed Studio command', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const command = doc(db, 'users', ALICE_UID, 'remote-relay-commands', 'phone-command');
            await assertSucceeds(setDoc(command, {
                text: 'Hi',
                status: 'pending',
                executionTarget: 'studio',
                timestamp: Timestamp.now(),
                createdAt: Timestamp.now(),
            }));
            await assertSucceeds(updateDoc(command, { status: 'cancelled' }));
            await assertFails(updateDoc(command, { status: 'completed' }));
        });

        it('rejects malformed, oversized, and schema-polluted Controller commands', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const base = {
                text: 'Hi',
                status: 'pending',
                executionTarget: 'studio',
                timestamp: Timestamp.now(),
                createdAt: Timestamp.now(),
            };

            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'remote-relay-commands', 'missing-created-at'),
                {
                    text: base.text,
                    status: base.status,
                    executionTarget: base.executionTarget,
                    timestamp: base.timestamp,
                }
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'remote-relay-commands', 'oversized'),
                { ...base, text: 'x'.repeat(20_001) }
            ));
            await assertFails(setDoc(
                doc(db, 'users', ALICE_UID, 'remote-relay-commands', 'polluted'),
                { ...base, isAdmin: true }
            ));
        });

        it('accepts the Controller conversation-mode hint and rejects unknown modes or keys in metadata', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const commands = collection(db, 'users', ALICE_UID, 'remote-relay-commands');
            const base = {
                text: 'Boardroom: how do we price this release?',
                status: 'pending',
                executionTarget: 'studio',
                timestamp: Timestamp.now(),
                createdAt: Timestamp.now(),
            };

            for (const mode of ['boardroom', 'department', 'direct']) {
                await assertSucceeds(setDoc(
                    doc(commands, `mode-${mode}`),
                    { ...base, metadata: { conversationMode: mode, source: 'mobile-remote' } }
                ));
            }
            await assertFails(setDoc(
                doc(commands, 'mode-invalid'),
                { ...base, metadata: { conversationMode: 'orchestrated' } }
            ));
            await assertFails(setDoc(
                doc(commands, 'metadata-polluted'),
                { ...base, metadata: { conversationMode: 'boardroom', isAdmin: true } }
            ));
        });

        it('allows cancellation to change only status, never the queued payload', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const command = doc(db, 'users', ALICE_UID, 'remote-relay-commands', 'immutable-payload');
            await assertSucceeds(setDoc(command, {
                text: 'Original request',
                status: 'pending',
                executionTarget: 'studio',
                timestamp: Timestamp.now(),
                createdAt: Timestamp.now(),
                metadata: { source: 'mobile-remote' },
            }));

            await assertFails(updateDoc(command, {
                status: 'cancelled',
                text: 'Mutated request',
            }));
            await assertFails(updateDoc(command, {
                status: 'cancelled',
                arbitraryPayload: 'x'.repeat(10_000),
            }));
        });

        it('validates the mobile remote sleep settings schema on create and update', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const settings = doc(db, 'users', ALICE_UID, 'settings', 'remoteSettings');

            await assertSucceeds(setDoc(settings, {
                sleepEnabled: true,
                autoSleepMinutes: 30,
                updatedAt: Timestamp.now(),
            }));
            await assertSucceeds(updateDoc(settings, {
                sleepEnabled: false,
                updatedAt: Timestamp.now(),
            }));
            await assertFails(updateDoc(settings, {
                autoSleepMinutes: 1,
                updatedAt: Timestamp.now(),
            }));
            await assertFails(updateDoc(settings, {
                arbitraryPayload: 'x'.repeat(10_000),
                updatedAt: Timestamp.now(),
            }));
        });
    });

    describe('audio_assets/{audioId} (ISSUE-1005)', () => {
        const audioId = 'audio-1';
        const audioData = {
            id: audioId,
            userId: ALICE_UID,
            type: 'music',
            prompt: 'A bright synth intro',
            mimeType: 'audio/wav',
            estimatedDuration: 12,
            generatedAt: '2026-07-12T23:00:00.000Z',
            storageUrl: 'https://storage.example/audio-1.wav',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'audio_assets', audioId), audioData);
            });
        });

        it('owner can create a schema-valid playable asset and read it back', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const newAsset = { ...audioData, id: 'audio-2', prompt: 'A second cue' };
            await assertSucceeds(setDoc(doc(db, 'audio_assets', 'audio-2'), newAsset));
            await assertSucceeds(getDoc(doc(db, 'audio_assets', audioId)));
        });

        it('rejects cross-user reads and ownership spoofing', async () => {
            if (requireEmulator()) return;
            const bobDb = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(bobDb, 'audio_assets', audioId)));
            await assertFails(setDoc(doc(bobDb, 'audio_assets', 'spoofed'), {
                ...audioData,
                id: 'spoofed',
                userId: ALICE_UID,
            }));
        });

        it('rejects malformed assets and immutable-owner spoofing on update', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'audio_assets', 'invalid'), {
                ...audioData,
                id: 'wrong-document-id',
                type: 'unknown',
                storageUrl: '',
            }));
            await assertFails(updateDoc(doc(db, 'audio_assets', audioId), { userId: BOB_UID }));
        });
    });

    describe('dsr_processed_reports/{reportId} (server-owned earnings receipts)', () => {
        const reportId = 'dsr-server-receipt';
        const receipt = {
            id: reportId,
            userId: ALICE_UID,
            reportId: 'RPT-001',
            reconciliationStatus: 'pending_review',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'dsr_processed_reports', reportId), receipt);
            });
        });

        it('lets the owner read the backend receipt but not forge or mutate one', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();

            await assertSucceeds(getDoc(doc(db, 'dsr_processed_reports', reportId)));
            await assertFails(setDoc(doc(db, 'dsr_processed_reports', 'forged'), {
                ...receipt,
                id: 'forged',
            }));
            await assertFails(updateDoc(doc(db, 'dsr_processed_reports', reportId), {
                reconciliationStatus: 'reconciled',
            }));
            await assertFails(deleteDoc(doc(db, 'dsr_processed_reports', reportId)));
        });

        it('denies another account access to the receipt', async () => {
            if (requireEmulator()) return;
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'dsr_processed_reports', reportId)));
        });
    });

    describe('server-owned owner-readable ledgers and receipts', () => {
        const collections = ['earnings', 'payouts', 'recoupment_balances', 'recoupment_adjustments', 'royalty_report_claims', 'master_verifications', 'audio_analysis_receipts'];

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                for (const collectionName of collections) {
                    await setDoc(doc(ctx.firestore(), collectionName, 'owner-record'), {
                        userId: ALICE_UID,
                        status: 'held_for_reconciliation',
                    });
                }
            });
        });

        it('lets the owner read derived finance records but never create, alter, or delete them', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            for (const collectionName of collections) {
                await assertSucceeds(getDoc(doc(db, collectionName, 'owner-record')));
                await assertFails(setDoc(doc(db, collectionName, 'forged'), {
                    userId: ALICE_UID,
                    amount: 1_000_000,
                }));
                await assertFails(updateDoc(doc(db, collectionName, 'owner-record'), {
                    status: 'paid',
                }));
                await assertFails(deleteDoc(doc(db, collectionName, 'owner-record')));
            }
        });

        it('denies cross-account reads of every derived finance record', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            for (const collectionName of collections) {
                await assertFails(getDoc(doc(db, collectionName, 'owner-record')));
            }
        });
    });

    describe('users/{uid}/costLedger/{ledgerId} (ISSUE-1006)', () => {
        const ledger = { userId: ALICE_UID, totalCost: 1.25, operationCount: 1 };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'costLedger', 'daily-2026-07-12'), ledger);
                await setDoc(doc(ctx.firestore(), 'costLedger', 'op-owner'), { userId: ALICE_UID, status: 'SETTLED' });
            });
        });

        it('exposes aggregates and reservation receipts only to their owner', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            await assertSucceeds(getDoc(doc(alice, 'users', ALICE_UID, 'costLedger', 'daily-2026-07-12')));
            await assertSucceeds(getDoc(doc(alice, 'costLedger', 'op-owner')));
            await assertFails(getDoc(doc(bob, 'users', ALICE_UID, 'costLedger', 'daily-2026-07-12')));
            await assertFails(getDoc(doc(bob, 'costLedger', 'op-owner')));
        });

        it('does not let a client forge an aggregate or reservation state', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(alice, 'users', ALICE_UID, 'costLedger', 'daily-forged'), ledger));
            await assertFails(updateDoc(doc(alice, 'costLedger', 'op-owner'), { status: 'VOIDED' }));
        });
    });

    describe('server-only financial and webhook perimeter (WP-1)', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'subscriptions', ALICE_UID), { tier: 'pro', status: 'active' });
                await setDoc(doc(ctx.firestore(), 'user_credits', ALICE_UID), { balance: 500 });
                await setDoc(doc(ctx.firestore(), 'user_credits', ALICE_UID, 'transactions', 'tx-1'), { credits: 500 });
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'ledger', 'sub-1'), { amount: 2500 });
                await setDoc(doc(ctx.firestore(), 'stripe_webhook_deliveries', 'evt-1'), { status: 'processed' });
            });
        });

        it('denies all client reads and writes to /subscriptions', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            const bob = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(alice, 'subscriptions', ALICE_UID)));
            await assertFails(getDoc(doc(bob, 'subscriptions', ALICE_UID)));
            await assertFails(setDoc(doc(alice, 'subscriptions', ALICE_UID), { status: 'active' }));
        });

        it('denies all client reads and writes to /user_credits', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(alice, 'user_credits', ALICE_UID)));
            await assertFails(getDoc(doc(alice, 'user_credits', ALICE_UID, 'transactions', 'tx-1')));
            await assertFails(setDoc(doc(alice, 'user_credits', ALICE_UID), { balance: 9999 }));
        });

        it('denies all client reads and writes to /users/{uid}/ledger', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(alice, 'users', ALICE_UID, 'ledger', 'sub-1')));
            await assertFails(setDoc(doc(alice, 'users', ALICE_UID, 'ledger', 'sub-forged'), { amount: 100 }));
        });

        it('denies all client reads and writes to /stripe_webhook_deliveries', async () => {
            if (requireEmulator()) return;
            const alice = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(alice, 'stripe_webhook_deliveries', 'evt-1')));
            await assertFails(setDoc(doc(alice, 'stripe_webhook_deliveries', 'evt-forged'), { status: 'failed' }));
        });
    });

    describe('users/{uid}/assetAuditReceipts/{auditId}', () => {
        const auditPath = ['users', ALICE_UID, 'assetAuditReceipts', 'asset_audit_receipt'] as const;
        const receipt = {
            schemaVersion: 'asset-resolution-audit.v1',
            ownerUid: ALICE_UID,
            releaseId: 'release-owner',
            status: 'compliant',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), ...auditPath), receipt);
            });
        });

        it('lets only the owner read a server-generated asset audit receipt', async () => {
            if (requireEmulator()) return;
            await assertSucceeds(getDoc(doc(verifiedCtx(ALICE_UID).firestore(), ...auditPath)));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), ...auditPath)));
            await assertFails(getDoc(doc(unauthCtx().firestore(), ...auditPath)));
        });

        it('denies every client mutation of an asset audit receipt', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'users', ALICE_UID, 'assetAuditReceipts', 'forged'), receipt));
            await assertFails(updateDoc(doc(db, ...auditPath), { status: 'non_compliant' }));
            await assertFails(deleteDoc(doc(db, ...auditPath)));
        });
    });

    describe('users/{uid}/server-only social OAuth records', () => {
        const tokenPath = ['users', ALICE_UID, 'analyticsTokens', 'instagram'] as const;
        const socialTokenPath = ['users', ALICE_UID, 'socialTokens', 'instagram'] as const;
        const intentPath = ['users', ALICE_UID, 'serverSocialConnectionIntents', 'intent-1'] as const;

        // Iterating a mixed array of distinct-literal tuples widens each element to
        // the UNION of the tuple types when spread (`...targetPath`), which loses
        // the guaranteed-first-segment shape `doc()` needs and reports the
        // CollectionReference overloads instead. Casting the array itself to a
        // uniform tuple shape (the segments' runtime type, ignoring the literal
        // union) keeps every element spreadable.
        const targetPaths: ReadonlyArray<readonly [string, string, string, string]> = [tokenPath, socialTokenPath, intentPath];

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                const db = ctx.firestore();
                await setDoc(doc(db, ...tokenPath), { accessToken: 'secret', expiresAt: 9_999_999_999_999 });
                await setDoc(doc(db, ...socialTokenPath), { accessToken: 'secret' });
                await setDoc(doc(db, ...intentPath), { accessToken: 'secret', platform: 'instagram' });
            });
        });

        it('denies owner, cross-owner, and unauthenticated token or intent reads', async () => {
            if (requireEmulator()) return;
            for (const targetPath of targetPaths) {
                await assertFails(getDoc(doc(verifiedCtx(ALICE_UID).firestore(), ...targetPath)));
                await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), ...targetPath)));
                await assertFails(getDoc(doc(unauthCtx().firestore(), ...targetPath)));
            }
        });

        it('denies every client token or intent mutation', async () => {
            if (requireEmulator()) return;
            for (const targetPath of targetPaths) {
                const db = verifiedCtx(ALICE_UID).firestore();
                await assertFails(setDoc(doc(db, ...targetPath), { accessToken: 'forged' }));
                await assertFails(updateDoc(doc(db, ...targetPath), { accessToken: 'mutated' }));
                await assertFails(deleteDoc(doc(db, ...targetPath)));
            }
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // 14. AUDIO ASSETS (/audio_assets/{docId})
    // ──────────────────────────────────────────────────────────────────────

    describe('audio_assets/{docId}', () => {
        const audioAssetData = {
            id: 'audio-1',
            userId: ALICE_UID,
            type: 'music',
            prompt: 'A bright synth intro',
            mimeType: 'audio/wav',
            estimatedDuration: 12,
            generatedAt: '2026-07-12T23:00:00.000Z',
            storageUrl: 'https://storage.example/audio-1.wav',
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'audio_assets', 'audio-1'), audioAssetData);
            });
        });

        it('verified owner: read allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'audio_assets', 'audio-1')));
        });

        it('other user: read denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'audio_assets', 'audio-1')));
        });

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'audio_assets', 'audio-1')));
        });

        it('verified owner: create own audio allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(setDoc(doc(db, 'audio_assets', 'audio-new'), {
                ...audioAssetData,
                id: 'audio-new',
            }));
        });

        it('cannot create audio asset for another user', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(setDoc(doc(db, 'audio_assets', 'audio-fake'), {
                ...audioAssetData,
                id: 'audio-fake',
            }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // SHARED OPERATIONAL DATA — server-only writes
    // ──────────────────────────────────────────────────────────────────────

    describe('shared operational collections', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'ai_context_cache', `${ALICE_UID}_abc123`), {
                    id: 'projects/test/locations/us-central1/cachedContents/cache-1',
                    hash: 'abc123',
                    userId: ALICE_UID,
                    expireTime: Date.now() + 3_600_000,
                    lastUsed: Date.now(),
                });
                await setDoc(doc(ctx.firestore(), 'instrument_usage_stats', 'generate_image'), {
                    totalExecutions: 10,
                    successfulExecutions: 9,
                    failedExecutions: 1,
                });
            });
        });

        it('allows only the owner to read a context-cache reference', async () => {
            if (requireEmulator()) return;
            const cachePath = `ai_context_cache/${ALICE_UID}_abc123`;
            await assertSucceeds(getDoc(doc(verifiedCtx(ALICE_UID).firestore(), cachePath)));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), cachePath)));
            await assertFails(getDoc(doc(unauthCtx().firestore(), cachePath)));
        });

        it('denies all client writes to context-cache references', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'ai_context_cache', `${ALICE_UID}_new`), {
                id: 'projects/test/locations/us-central1/cachedContents/poison',
                hash: 'def456',
                userId: ALICE_UID,
                expireTime: Date.now() + 3_600_000,
                lastUsed: Date.now(),
            }));
            await assertFails(updateDoc(doc(db, 'ai_context_cache', `${ALICE_UID}_abc123`), {
                id: 'projects/attacker/locations/us-central1/cachedContents/poison',
            }));
            await assertFails(deleteDoc(doc(db, 'ai_context_cache', `${ALICE_UID}_abc123`)));
        });

        it('keeps instrument aggregates readable but denies all client writes', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const statsRef = doc(db, 'instrument_usage_stats', 'generate_image');
            await assertSucceeds(getDoc(statsRef));
            await assertFails(setDoc(doc(db, 'instrument_usage_stats', 'generate_video'), {
                totalExecutions: 999,
            }));
            await assertFails(updateDoc(statsRef, { totalExecutions: 999_999 }));
            await assertFails(deleteDoc(statsRef));
            await assertFails(setDoc(doc(db, 'instrument_usage_events', `${ALICE_UID}_forged`), {
                userId: ALICE_UID,
                executionId: 'forged',
            }));
            await assertFails(setDoc(doc(db, 'instrument_usage_rate_limits', `${ALICE_UID}_generate_image`), {
                userId: ALICE_UID,
                count: 0,
            }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // ROOT OWNER-FIELD INTEGRITY
    // ──────────────────────────────────────────────────────────────────────

    describe('root owner-scoped collections pin every authority field', () => {
        const ownerScopedCollections = [
            ['composition_drafts', 'userId'],
            ['designs', 'userId'],
            ['earnings_reports', 'userId'],
            ['epk_portals', 'userId'],
            ['influencerBounties', 'userId'],
            ['iswc_works', 'userId'],
            ['ledger', 'userId'],
            ['merchandise', 'userId'],
            ['merchandise_inventory', 'userId'],
            ['mockup_generations', 'userId'],
            ['print_jobs', 'userId'],
            ['promoter_pitches', 'userId'],
            ['scheduledPosts', 'userId'],
            ['vinyl_campaigns', 'userId'],
            ['history', 'userId'],
            ['design_versions', 'userId'],
            ['creative_sessions', 'userId'],
            ['knowledge', 'userId'],
            ['publishing_registrations', 'userId'],
            ['notification_tokens', 'userId'],
            ['ddexReleases', 'userId'],
            ['proprietaryIngestionReleases', 'userId'],
            ['projects', 'userId'],
            ['proactive_tasks', 'userId'],
            ['distribution_tasks', 'userId'],
            ['campaigns', 'userId'],
            ['publicist_campaigns', 'userId'],
            ['publicist_contacts', 'userId'],
            ['workflows', 'userId'],
            ['bountyLinks', 'userId'],
            ['expenses', 'userId'],
            // NOTE: revenue is intentionally NOT in this list — it is
            // server-origin only (write: if false, see /revenue match + the
            // revenue describe block above).
            ['manufacture_requests', 'userId'],
            ['agent_traces', 'userId'],
            ['sessions', 'userId'],
            ['boardroom_messages', 'userId'],
            ['agent_notes', 'userId'],
            ['tour_vehicles', 'userId'],
            ['tour_itineraries', 'userId'],
            ['tour_rider_items', 'userId'],
            ['tour_emergency_contacts', 'userId'],
            ['career_memory_archive', 'userId'],
            ['video_releases', 'userId'],
            ['clearance_docs', 'userId'],
            ['file_nodes', 'userId'],
            ['deployments', 'userId'],
            ['tax_profiles', 'userId'],
            ['tracks', 'userId'],
            ['products', 'sellerId'],
            ['scheduled_posts', 'authorId'],
            ['posts', 'authorId'],
            ['marketplace_drops', 'ownerId'],
        ] as const;

        const authorityFields = [
            'userId',
            'ownerId',
            'ownerUid',
            'orgId',
            'authorId',
            'initiatorUid',
            'requestedBy',
            'labelId',
            'createdBy',
            'members',
            'parties',
        ] as const;

        function baseDocument(collectionName: string, ownerField: string) {
            return {
                [ownerField]: ALICE_UID,
                value: 'before',
                ...(collectionName === 'products'
                    ? {
                        type: 'song',
                        isActive: true,
                        price: 100,
                        title: 'Owned product',
                    }
                    : {}),
                ...(collectionName === 'clearance_docs'
                    ? { status: 'pending_upload' }
                    : {}),
            };
        }

        it('allows ordinary owner updates but rejects ownership rewrites for every migrated collection', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                for (const [collectionName, ownerField] of ownerScopedCollections) {
                    await setDoc(
                        doc(ctx.firestore(), collectionName, `owner-integrity-${collectionName}`),
                        baseDocument(collectionName, ownerField),
                    );
                }
            });

            const db = verifiedCtx(ALICE_UID).firestore();
            for (const [collectionName, ownerField] of ownerScopedCollections) {
                const reference = doc(db, collectionName, `owner-integrity-${collectionName}`);
                await assertSucceeds(updateDoc(reference, { value: 'after' }));
                await assertFails(updateDoc(reference, { [ownerField]: BOB_UID }));
            }
        });

        it('rejects every common authority-field rewrite on an otherwise valid owner document', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'designs', 'authority-fields'), {
                    userId: ALICE_UID,
                    value: 'before',
                });
            });
            const reference = doc(verifiedCtx(ALICE_UID).firestore(), 'designs', 'authority-fields');
            for (const authorityField of authorityFields) {
                const maliciousValue = authorityField === 'members' || authorityField === 'parties'
                    ? [BOB_UID]
                    : BOB_UID;
                await assertFails(updateDoc(reference, { [authorityField]: maliciousValue }));
            }
        });

        it('rejects mixed-identity creates instead of poisoning another query namespace', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            for (const [collectionName, ownerField] of ownerScopedCollections) {
                const data = {
                    ...baseDocument(collectionName, ownerField),
                    ownerUid: BOB_UID,
                };
                await assertFails(setDoc(
                    doc(db, collectionName, `create-integrity-${collectionName}`),
                    data,
                ));
            }
        });

        it('pins organization scope on member-writable invitation updates', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID));
                await setDoc(doc(ctx.firestore(), 'organization_invites', 'invite-1'), {
                    orgId: ORG_ID,
                    email: 'invitee@example.com',
                    status: 'pending',
                });
            });
            const db = verifiedCtx(ALICE_UID).firestore();
            const reference = doc(db, 'organization_invites', 'invite-1');
            await assertSucceeds(updateDoc(reference, { status: 'accepted' }));
            await assertFails(updateDoc(reference, { orgId: 'attacker-org' }));
            await assertFails(updateDoc(reference, { ownerId: BOB_UID }));
        });
    });

    describe('videoJobs are server-controlled generation records', () => {
        const jobId = 'server-owned-video-job';

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'videoJobs', jobId), {
                    userId: ALICE_UID,
                    orgId: 'personal',
                    status: 'queued',
                    prompt: 'A server-created video job',
                });
            });
        });

        it('lets the owner read the job but denies every client mutation', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const jobRef = doc(db, 'videoJobs', jobId);

            await assertSucceeds(getDoc(jobRef));
            await assertFails(setDoc(doc(db, 'videoJobs', 'forged-queued-job'), {
                userId: ALICE_UID,
                orgId: 'personal',
                status: 'queued',
                prompt: 'Bypass the callable and spend Vertex quota',
            }));
            await assertFails(updateDoc(jobRef, { status: 'completed' }));
            await assertFails(deleteDoc(jobRef));
        });

        it('denies cross-owner reads as well as forged job creation', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(getDoc(doc(db, 'videoJobs', jobId)));
            await assertFails(setDoc(doc(db, 'videoJobs', 'cross-owner-forgery'), {
                userId: ALICE_UID,
                status: 'queued',
                prompt: 'Impersonate another artist',
            }));
        });

        it('denies unauthenticated reads and allows an authorized organization member to read lifecycle only', async () => {
            if (requireEmulator()) return;
            const orgJobId = 'server-owned-org-render';
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID, BOB_UID));
                await setDoc(doc(ctx.firestore(), 'videoJobs', orgJobId), {
                    id: orgJobId,
                    userId: ALICE_UID,
                    orgId: ORG_ID,
                    projectId: 'project-org-1',
                    accessPolicy: 'private-project-render.v1',
                    type: 'render_stitch',
                    status: 'stitching',
                });
            });

            await assertFails(getDoc(doc(unauthCtx().firestore(), 'videoJobs', orgJobId)));
            await assertSucceeds(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'videoJobs', orgJobId)));
            await assertFails(updateDoc(
                doc(verifiedCtx(BOB_UID).firestore(), 'videoJobs', orgJobId),
                { status: 'completed' },
            ));
        });
    });

    describe('split_escrows are server-controlled', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'split_escrows', 'escrow-1'), {
                    initiatorUid: ALICE_UID,
                    parties: [ALICE_UID, BOB_UID],
                    holdAmountCents: 10_000,
                    status: 'PENDING_SIGNATURES',
                    signoffs: { [ALICE_UID]: false, [BOB_UID]: false },
                });
            });
        });

        it('lets a listed party read but denies every direct mutation', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            const reference = doc(db, 'split_escrows', 'escrow-1');
            await assertSucceeds(getDoc(reference));
            await assertFails(updateDoc(reference, { status: 'RELEASED' }));
            await assertFails(updateDoc(reference, { holdAmountCents: 1 }));
            await assertFails(updateDoc(reference, { parties: [BOB_UID] }));
            await assertFails(deleteDoc(reference));
            await assertFails(setDoc(doc(db, 'split_escrows', 'forged'), {
                initiatorUid: BOB_UID,
                parties: [BOB_UID],
                holdAmountCents: 1,
                status: 'RELEASED',
            }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // SERVER-OWNED VIDEO SESSION STATE (ISSUE-1175)
    // ──────────────────────────────────────────────────────────────────────

    describe('videoSessions/{sessionId}', () => {
        const sessionId = 'a'.repeat(40);
        const session = {
            schemaVersion: 'video-session.v1',
            sessionId,
            ownerUid: ALICE_UID,
            organizationId: ORG_ID,
            projectId: 'project-video-001',
            status: 'completed',
            manifest: { schemaVersion: 'proxy-manifest.v1' },
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'videoSessions', sessionId), session);
            });
        });

        it('allows only the authenticated owner to read server-owned session state', async () => {
            if (requireEmulator()) return;
            await assertSucceeds(getDoc(doc(verifiedCtx(ALICE_UID).firestore(), 'videoSessions', sessionId)));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'videoSessions', sessionId)));
            await assertFails(getDoc(doc(unauthCtx().firestore(), 'videoSessions', sessionId)));
        });

        it('denies every client mutation, including manufactured completion', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'videoSessions', 'b'.repeat(40)), {
                ...session,
                sessionId: 'b'.repeat(40),
            }));
            await assertFails(updateDoc(doc(db, 'videoSessions', sessionId), {
                status: 'completed',
                manifest: { attackerControlled: true },
            }));
            await assertFails(deleteDoc(doc(db, 'videoSessions', sessionId)));
        });

        it('never exposes resumable bearer grants or dependency cleanup receipts to clients', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'videoSessionUploadGrants', sessionId), {
                    ownerUid: ALICE_UID,
                    resumableSessionUri: 'https://storage.googleapis.test/private-capability',
                });
                await setDoc(doc(
                    ctx.firestore(),
                    'videoSessionDependencies',
                    sessionId,
                    'references',
                    'alignment-1',
                ), {
                    ownerUid: ALICE_UID,
                    type: 'master-sync-alignment',
                });
            });
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(db, 'videoSessionUploadGrants', sessionId)));
            await assertFails(setDoc(doc(db, 'videoSessionUploadGrants', sessionId), {
                ownerUid: ALICE_UID,
                resumableSessionUri: 'https://attacker.invalid',
            }));
            await assertFails(getDoc(doc(
                db,
                'videoSessionDependencies',
                sessionId,
                'references',
                'alignment-1',
            )));
            await assertFails(deleteDoc(doc(
                db,
                'videoSessionDependencies',
                sessionId,
                'references',
                'alignment-1',
            )));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // EVOLAS: users/{userId}/personaFaders/{personaId} (docs/EVOLAS_BUILD_PLAN.md T1.1)
    // ──────────────────────────────────────────────────────────────────────

    describe('users/{userId}/personaFaders/{personaId}', () => {
        const validFaders = {
            personaId: 'manager',
            values: {
                riskTolerance: 50,
                brevity: 50,
                directness: 50,
                formality: 50,
                reasoningTransparency: 50,
            },
            updatedAt: Date.now(),
        };

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager')));
        });

        it('owner: write with valid schema allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), validFaders)
            );
        });

        it('non-owner: write denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), validFaders)
            );
        });

        it('rejects a fader value above 100', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), {
                    ...validFaders,
                    values: { ...validFaders.values, riskTolerance: 101 },
                })
            );
        });

        it('rejects a non-integer fader value', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), {
                    ...validFaders,
                    values: { ...validFaders.values, brevity: 50.5 },
                })
            );
        });

        it('rejects an unknown axis key (schema cannot carry a substance override)', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), {
                    ...validFaders,
                    values: { ...validFaders.values, forceVerdict: 'always approve' },
                })
            );
        });

        it('rejects personaId mismatch between document field and path', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), {
                    ...validFaders,
                    personaId: 'contractReader',
                })
            );
        });

        it('owner: delete allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await setDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager'), validFaders);
            await assertSucceeds(deleteDoc(doc(db, 'users', ALICE_UID, 'personaFaders', 'manager')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // EVOLAS: users/{userId}/personaInteractionSignals/{signalId} (docs/EVOLAS_BUILD_PLAN.md T1.6)
    // ──────────────────────────────────────────────────────────────────────

    describe('users/{userId}/personaInteractionSignals/{signalId}', () => {
        const validSignal = {
            personaId: 'manager',
            responseId: 'resp-123',
            signalType: 'copied',
            occurredAt: Date.now(),
        };

        it('unauthenticated: read denied', async () => {
            if (requireEmulator()) return;
            const db = unauthCtx().firestore();
            await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1')));
        });

        it('owner: create with valid schema allowed', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(
                setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), validSignal)
            );
        });

        it('non-owner: create denied', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(BOB_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), validSignal)
            );
        });

        it('rejects an invalid signalType', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), {
                    ...validSignal,
                    signalType: 'thumbsUp',
                })
            );
        });

        it('rejects an empty responseId', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(
                setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), {
                    ...validSignal,
                    responseId: '',
                })
            );
        });

        it('signals are immutable: update denied even by the owner', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), validSignal);
            await assertFails(
                updateDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), { signalType: 'reAsked' })
            );
        });

        it('signals are permanent: delete denied even by the owner', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await setDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1'), validSignal);
            await assertFails(deleteDoc(doc(db, 'users', ALICE_UID, 'personaInteractionSignals', 'sig-1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // PRE-SAVE CAMPAIGNS: callable-only writes, owner-only reads
    // ──────────────────────────────────────────────────────────────────────

    describe('presaveCampaigns/{campaignId}', () => {
        const campaignId = 'campaign_12345678';
        const leadId = 'lead_12345678';
        const campaign = {
            ownerId: ALICE_UID,
            title: 'Midnight Release',
            releaseDate: Timestamp.fromMillis(1_800_000_000_000),
            coverArtUrl: 'https://cdn.indii.music/cover.jpg',
            links: { spotify: 'https://open.spotify.com/album/123' },
            captureEmails: true,
            capturePhones: false,
            themeColor: '#7259ff',
            status: 'active',
            leadCount: 1,
            createdAt: Timestamp.fromMillis(1_700_000_000_000),
            updatedAt: Timestamp.fromMillis(1_700_000_000_000),
        };
        const lead = {
            leadId,
            campaignId,
            ownerId: ALICE_UID,
            dsp: 'spotify',
            email: 'fan@example.com',
            optInMarketing: true,
            collectedAt: Timestamp.fromMillis(1_700_000_000_000),
        };

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'presaveCampaigns', campaignId), campaign);
                await setDoc(doc(
                    ctx.firestore(),
                    'presaveCampaigns',
                    campaignId,
                    'leads',
                    leadId,
                ), lead);
            });
        });

        it('allows the owner to read their campaign and leads', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertSucceeds(getDoc(doc(db, 'presaveCampaigns', campaignId)));
            await assertSucceeds(getDoc(doc(db, 'presaveCampaigns', campaignId, 'leads', leadId)));
        });

        it('denies public, anonymous, and cross-account reads', async () => {
            if (requireEmulator()) return;
            await assertFails(getDoc(doc(unauthCtx().firestore(), 'presaveCampaigns', campaignId)));
            await assertFails(getDoc(doc(anonCtx().firestore(), 'presaveCampaigns', campaignId)));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'presaveCampaigns', campaignId)));
            await assertFails(getDoc(doc(
                verifiedCtx(BOB_UID).firestore(),
                'presaveCampaigns',
                campaignId,
                'leads',
                leadId,
            )));
        });

        it('denies campaign creation, ownership changes, and deletion by every client', async () => {
            if (requireEmulator()) return;
            const ownerDb = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(ownerDb, 'presaveCampaigns', 'campaign_87654321'), campaign));
            await assertFails(updateDoc(doc(ownerDb, 'presaveCampaigns', campaignId), { ownerId: BOB_UID }));
            await assertFails(deleteDoc(doc(ownerDb, 'presaveCampaigns', campaignId)));
        });

        it('denies forged, polluted, and destructive lead mutations by every client', async () => {
            if (requireEmulator()) return;
            const ownerDb = verifiedCtx(ALICE_UID).firestore();
            const newLead = doc(ownerDb, 'presaveCampaigns', campaignId, 'leads', 'lead_87654321');
            await assertFails(setDoc(newLead, { ...lead, leadId: 'lead_87654321' }));
            await assertFails(setDoc(newLead, {
                ...lead,
                leadId: 'lead_87654321',
                ownerId: BOB_UID,
                administrativeOverride: true,
            }));
            await assertFails(updateDoc(
                doc(ownerDb, 'presaveCampaigns', campaignId, 'leads', leadId),
                { email: 'stolen@example.com' },
            ));
            await assertFails(deleteDoc(doc(
                ownerDb,
                'presaveCampaigns',
                campaignId,
                'leads',
                leadId,
            )));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // LIMITED DROPS: top-level owner drafts only, no fabricated live state
    // ──────────────────────────────────────────────────────────────────────

    describe('limitedDrops/{dropId}', () => {
        const draft = {
            userId: ALICE_UID,
            selectedProductIds: ['shirt-1'],
            dropName: 'Night Shift',
            dropDateTime: Timestamp.fromMillis(Date.now() + 86_400_000),
            presaleEnabled: false,
            superfanOnly: false,
            countdownMessage: 'Coming soon',
            status: 'draft',
            notificationStatus: 'setup_required',
            notificationProvider: 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        it('allows a verified owner to create and read a canonical top-level draft', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            const ref = doc(db, 'limitedDrops', 'drop-1');
            await assertSucceeds(setDoc(ref, draft));
            await assertSucceeds(getDoc(ref));
        });

        it('denies the obsolete nested path and cross-account reads', async () => {
            if (requireEmulator()) return;
            const ownerDb = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(ownerDb, 'users', ALICE_UID, 'limitedDrops', 'drop-1'), draft));

            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'limitedDrops', 'drop-1'), {
                    ...draft,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            });
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'limitedDrops', 'drop-1')));
        });

        it('denies forged live, notified, polluted, and wrong-owner drafts', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(db, 'limitedDrops', 'live-drop'), { ...draft, status: 'active' }));
            await assertFails(setDoc(doc(db, 'limitedDrops', 'notified-drop'), {
                ...draft,
                notificationStatus: 'sent',
            }));
            await assertFails(setDoc(doc(db, 'limitedDrops', 'polluted-drop'), {
                ...draft,
                administrativeOverride: true,
            }));
            await assertFails(setDoc(doc(db, 'limitedDrops', 'stolen-drop'), {
                ...draft,
                userId: BOB_UID,
            }));
        });

        it('denies client updates and deletion, including by the owner', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'limitedDrops', 'drop-1'), {
                    ...draft,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            });
            const ref = doc(verifiedCtx(ALICE_UID).firestore(), 'limitedDrops', 'drop-1');
            await assertFails(updateDoc(ref, { countdownMessage: 'Changed' }));
            await assertFails(deleteDoc(ref));
        });
    });

    describe('label_deals/{dealId}', () => {
        const deal = {
            label: 'Indie Records LLC',
            advanceAmount: 50000,
            recoupedAmount: 12500.25,
            dealDate: '2026-08-08',
            notes: 'Artist-entered tracking data',
            userId: ALICE_UID,
            createdAt: serverTimestamp(),
        };

        it('allows the owner to create the live component schema and update only recouped amount', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'label_deals', 'deal-1');
            await assertSucceeds(setDoc(ownerRef, deal));
            await assertSucceeds(getDoc(ownerRef));
            await assertSucceeds(updateDoc(ownerRef, { recoupedAmount: 15000.5 }));
        });

        it('denies cross-owner reads, alternate schemas, polluted writes, and authority changes', async () => {
            if (requireEmulator()) return;
            const ownerDb = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(ownerDb, 'label_deals', 'legacy-shape'), {
                labelName: 'Legacy writer',
                currentRecouped: 100,
                recoupmentThreshold: 1000,
                userId: ALICE_UID,
                createdAt: serverTimestamp(),
            }));
            await assertFails(setDoc(doc(ownerDb, 'label_deals', 'polluted'), {
                ...deal,
                payoutApproved: true,
            }));
            await assertFails(setDoc(doc(ownerDb, 'label_deals', 'wrong-owner'), {
                ...deal,
                userId: BOB_UID,
            }));

            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'label_deals', 'deal-1'), {
                    ...deal,
                    createdAt: Timestamp.now(),
                });
            });
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'label_deals', 'deal-1')));
            await assertFails(updateDoc(doc(ownerDb, 'label_deals', 'deal-1'), { advanceAmount: 1 }));
            await assertFails(updateDoc(doc(ownerDb, 'label_deals', 'deal-1'), { userId: BOB_UID }));
        });

        it('denies client transaction records until a reconciled writer exists', async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'label_deals', 'deal-1'), {
                    ...deal,
                    createdAt: Timestamp.now(),
                });
            });
            await assertFails(setDoc(
                doc(verifiedCtx(ALICE_UID).firestore(), 'label_deals', 'deal-1', 'transactions', 'tx-1'),
                { amount: 100, source: 'streaming' }
            ));
        });
    });

    describe('smart_contracts/{contractId}', () => {
        const draft = {
            userId: ALICE_UID,
            isrc: 'US-IND-26-00001',
            tokenName: 'Night Shift Rights',
            tokenSymbol: 'NSR',
            tokenType: 'ERC-1155',
            status: 'draft_unverified',
            createdAt: serverTimestamp(),
            payees: [
                { walletAddress: `0x${'a'.repeat(40)}`, percentage: 60, role: 'Artist' },
                { walletAddress: `0x${'b'.repeat(40)}`, percentage: 40, role: 'Producer' },
            ],
        };

        it('allows only a verified owner to save and delete a schema-bounded unverified draft', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'smart_contracts', 'draft-1');
            await assertSucceeds(setDoc(ownerRef, draft));
            await assertSucceeds(getDoc(ownerRef));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'smart_contracts', 'draft-1')));
            await assertSucceeds(deleteDoc(ownerRef));
        });

        it('rejects forged deployment state, bad splits, polluted data, and all client updates', async () => {
            if (requireEmulator()) return;
            const ownerDb = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(ownerDb, 'smart_contracts', 'deployed'), {
                ...draft,
                status: 'deployed',
                contractAddress: `0x${'c'.repeat(40)}`,
            }));
            await assertFails(setDoc(doc(ownerDb, 'smart_contracts', 'bad-split'), {
                ...draft,
                payees: [
                    { ...draft.payees[0], percentage: 99 },
                    { ...draft.payees[1], percentage: 99 },
                ],
            }));
            await assertFails(setDoc(doc(ownerDb, 'smart_contracts', 'wrong-owner'), {
                ...draft,
                userId: BOB_UID,
            }));

            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'smart_contracts', 'draft-1'), {
                    ...draft,
                    createdAt: Timestamp.now(),
                });
            });
            await assertFails(updateDoc(doc(ownerDb, 'smart_contracts', 'draft-1'), {
                status: 'deployed',
            }));
        });
    });

    describe('owner-scoped notes, media contacts, and PRO drafts', () => {
        it('allows only the owner to manage schema-bounded notes', async () => {
            if (requireEmulator()) return;
            const note = {
                id: 'note-1',
                title: 'Release plan',
                content: 'Finish the mix.',
                attachments: [],
                tags: ['release'],
                createdAt: Date.now(),
                updatedAt: serverTimestamp(),
                userId: ALICE_UID,
            };
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'notes', 'note-1');
            await assertSucceeds(setDoc(ownerRef, note));
            await assertSucceeds(getDoc(ownerRef));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'users', ALICE_UID, 'notes', 'note-1')));
            await assertFails(setDoc(doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'notes', 'polluted'), {
                ...note,
                id: 'polluted',
                billingOverride: true,
            }));
        });

        it('allows owner-verified media contacts but rejects polluted and cross-owner records', async () => {
            if (requireEmulator()) return;
            const contact = {
                name: 'Verified Editor',
                contact: 'editor@example.com',
                tags: ['editorial', 'Detroit'],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'publicist_media_contacts', 'contact-1');
            await assertSucceeds(setDoc(ownerRef, contact));
            await assertSucceeds(getDoc(ownerRef));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'users', ALICE_UID, 'publicist_media_contacts', 'contact-1')));
            await assertFails(setDoc(doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'publicist_media_contacts', 'polluted'), {
                ...contact,
                verifiedByPlatform: true,
            }));
        });

        it('permits only immutable manual-submission PRO drafts', async () => {
            if (requireEmulator()) return;
            const draft = {
                workTitle: 'Night Shift',
                writers: [{ name: 'Artist', role: 'writer', split: 100 }],
                publisher: null,
                society: 'ASCAP',
                status: 'requires_manual_submission',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'proSubmissionDrafts', 'draft-1');
            await assertSucceeds(setDoc(ownerRef, draft));
            await assertSucceeds(getDoc(ownerRef));
            await assertFails(setDoc(doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'proSubmissionDrafts', 'fake-filed'), {
                ...draft,
                status: 'submitted',
            }));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'users', ALICE_UID, 'proSubmissionDrafts', 'draft-1')));
            await assertFails(updateDoc(ownerRef, { status: 'submitted' }));
            await assertFails(deleteDoc(ownerRef));
        });
    });

    describe('users/{userId}/fcm_tokens/{tokenId}', () => {
        const validToken = {
            token: 'device-token-1',
            platform: 'Web',
            updatedAt: serverTimestamp(),
        };

        it('allows an owner to register and remove only its matching device token', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(
                verifiedCtx(ALICE_UID).firestore(),
                'users', ALICE_UID, 'fcm_tokens', 'device-token-1',
            );
            await assertSucceeds(setDoc(ownerRef, validToken));
            await assertFails(getDoc(ownerRef));
            await assertSucceeds(deleteDoc(ownerRef));
        });

        it('rejects cross-owner, mismatched, polluted, and unsupported registrations', async () => {
            if (requireEmulator()) return;
            await assertFails(setDoc(
                doc(verifiedCtx(BOB_UID).firestore(), 'users', ALICE_UID, 'fcm_tokens', 'device-token-1'),
                validToken,
            ));
            await assertFails(setDoc(
                doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'fcm_tokens', 'different-token'),
                validToken,
            ));
            await assertFails(setDoc(
                doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'fcm_tokens', 'device-token-1'),
                { ...validToken, admin: true },
            ));
            await assertFails(setDoc(
                doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'fcm_tokens', 'device-token-1'),
                { ...validToken, platform: 'Server' },
            ));
        });
    });

    describe('users/{userId}/trashItems/{trashId}', () => {
        const manifest = {
            id: 'trash_safe_1',
            userId: ALICE_UID,
            type: 'history',
            targetId: 'history-1',
            name: 'Draft artwork',
            originalLocation: 'history/history-1',
            provenance: { actor: 'user', reason: 'User removed item' },
            state: 'trashed',
            idempotencyKey: 'hist_history-1',
            restoreData: { userId: ALICE_UID },
            legalHold: { isLocked: false },
            hasEntries: false,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        it('allows an owner schema-bound manifest but denies storage authority and deletion', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'trashItems', manifest.id);
            await assertSucceeds(setDoc(ownerRef, manifest));
            await assertFails(updateDoc(ownerRef, { quarantinePath: `users/${ALICE_UID}/trash/${manifest.id}/payload` }));
            await assertFails(deleteDoc(ownerRef));
        });

        it('permits only the owner restore transition and rejects forged ownership', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'trashItems', manifest.id);
            await assertSucceeds(setDoc(ownerRef, manifest));
            await assertSucceeds(updateDoc(ownerRef, {
                state: 'restored',
                restoredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            await assertFails(setDoc(
                doc(verifiedCtx(BOB_UID).firestore(), 'users', ALICE_UID, 'trashItems', 'trash_forged_1'),
                { ...manifest, id: 'trash_forged_1' },
            ));
        });
    });

    describe('users/{userId}/ragDocuments/{documentId} Trash transitions', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async ctx => {
                await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'ragDocuments', 'rag-1'), {
                    uid: ALICE_UID,
                    title: 'Private notes',
                    state: 'ready',
                    isIndexed: true,
                    updatedAt: new Date().toISOString(),
                });
            });
        });

        it('allows only reversible owner Trash transitions and denies direct deletion', async () => {
            if (requireEmulator()) return;
            const ownerRef = doc(verifiedCtx(ALICE_UID).firestore(), 'users', ALICE_UID, 'ragDocuments', 'rag-1');
            await assertSucceeds(updateDoc(ownerRef, {
                isTrashed: true,
                isIndexed: false,
                state: 'failed',
                trashedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            await assertSucceeds(updateDoc(ownerRef, {
                isTrashed: false,
                state: 'ready',
                restoredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            await assertFails(deleteDoc(ownerRef));
            await assertFails(updateDoc(ownerRef, { title: 'Tampered title' }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // ISSUE-1359: Creative Agent domain records (canvases / storyboards /
    // concept_art) — read by DomainTools.list_domain_records with a userId
    // filter. Previously unruled → deny-all → the Creative Director agent
    // truthfully reported "no permission to list canvas records".
    // ──────────────────────────────────────────────────────────────────────

    describe('creative agent domain records (canvases / storyboards / concept_art)', () => {
        const domainCollections = ['canvases', 'storyboards', 'concept_art'];

        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                for (const collectionName of domainCollections) {
                    await setDoc(doc(ctx.firestore(), collectionName, 'alice-own-001'), {
                        userId: ALICE_UID,
                        title: 'Alice concept',
                        createdAt: serverTimestamp(),
                    });
                }
            });
        });

        it('allows only the owner to read their own records', async () => {
            if (requireEmulator()) return;
            for (const collectionName of domainCollections) {
                const aliceDb = verifiedCtx(ALICE_UID).firestore();
                await assertSucceeds(getDoc(doc(aliceDb, collectionName, 'alice-own-001')));
            }
        });

        it('denies cross-user reads', async () => {
            if (requireEmulator()) return;
            for (const collectionName of domainCollections) {
                const bobDb = verifiedCtx(BOB_UID).firestore();
                await assertFails(getDoc(doc(bobDb, collectionName, 'alice-own-001')));
            }
        });

        it('denies anonymous and unverified access', async () => {
            if (requireEmulator()) return;
            for (const collectionName of domainCollections) {
                const anonDb = anonCtx().firestore();
                await assertFails(getDoc(doc(anonDb, collectionName, 'alice-own-001')));
            }
        });

        it('denies every client write, including by the owner (server-owned records)', async () => {
            if (requireEmulator()) return;
            for (const collectionName of domainCollections) {
                const aliceDb = verifiedCtx(ALICE_UID).firestore();
                const ownerRef = doc(aliceDb, collectionName, 'alice-own-001');
                await assertFails(setDoc(doc(aliceDb, collectionName, 'new-doc'), {
                    userId: ALICE_UID,
                    title: 'New concept',
                }));
                await assertFails(updateDoc(ownerRef, { title: 'Tampered' }));
                await assertFails(deleteDoc(ownerRef));
            }
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // ISSUE-1365: top-level usage ledger — owner reads, server-only writes
    // ──────────────────────────────────────────────────────────────────────

    describe('usage/{recordId} (top-level usage ledger)', () => {
        beforeEach(async () => {
            if (requireEmulator()) return;
            await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
                await setDoc(doc(ctx.firestore(), 'usage', 'image_1'), {
                    id: 'image_1',
                    userId: ALICE_UID,
                    type: 'image',
                    amount: 3,
                    timestamp: 1787000000000,
                });
            });
        });

        it('allows only the owner to read their own usage records', async () => {
            if (requireEmulator()) return;
            await assertSucceeds(getDoc(doc(verifiedCtx(ALICE_UID).firestore(), 'usage', 'image_1')));
            await assertFails(getDoc(doc(verifiedCtx(BOB_UID).firestore(), 'usage', 'image_1')));
        });

        it('denies every client write (gateway/trackUsage are server-owned)', async () => {
            if (requireEmulator()) return;
            const aliceDb = verifiedCtx(ALICE_UID).firestore();
            await assertFails(setDoc(doc(aliceDb, 'usage', 'image_new'), {
                userId: ALICE_UID,
                type: 'image',
                amount: 1,
                timestamp: Date.now(),
            }));
            await assertFails(updateDoc(doc(aliceDb, 'usage', 'image_1'), { amount: 99 }));
            await assertFails(deleteDoc(doc(aliceDb, 'usage', 'image_1')));
        });

        it('denies anonymous access', async () => {
            if (requireEmulator()) return;
            await assertFails(getDoc(doc(anonCtx().firestore(), 'usage', 'image_1')));
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    // DENY-ALL: arbitrary collection access denied
    // ──────────────────────────────────────────────────────────────────────

    describe('deny-all: unlisted collections', () => {
        it('authenticated user cannot read/write arbitrary collection', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();
            await assertFails(getDoc(doc(db, 'some_unlisted_collection', 'doc-1')));
            await assertFails(setDoc(doc(db, 'some_unlisted_collection', 'doc-1'), { data: true }));
        });
    });

    describe('Founding Artist canonical waitlist collections', () => {
        const serverOwnedDocuments = [
            ['foundingArtistWaitlist', ALICE_UID],
            ['foundingArtistEmailIndex', 'email-hash'],
            ['foundingArtistWaitlistMeta', 'sequence'],
            ['foundingArtistEvents', 'enrollment-event'],
            ['foundingArtistCommunications', 'invitation-message'],
            ['foundingArtistCampaigns', 'milestone-campaign'],
        ] as const;

        it('denies direct reads and writes even to a verified artist', async () => {
            if (requireEmulator()) return;
            const db = verifiedCtx(ALICE_UID).firestore();

            for (const [collectionName, documentId] of serverOwnedDocuments) {
                const reference = doc(db, collectionName, documentId);
                await assertFails(getDoc(reference));
                await assertFails(setDoc(reference, { uid: ALICE_UID, queuePosition: 1 }));
            }

            await assertFails(getDoc(doc(db, 'foundingArtistCampaigns', 'milestone-campaign', 'deliveries', ALICE_UID)));
            await assertFails(setDoc(doc(db, 'foundingArtistCampaigns', 'milestone-campaign', 'deliveries', ALICE_UID), {
                status: 'sent',
            }));
        });
    });
});
