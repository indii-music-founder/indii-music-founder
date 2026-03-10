/**
 * Item 253: Firestore Security Rules Unit Tests
 *
 * Tests run against the Firebase Emulator (localhost:8080).
 * Requires: FIRESTORE_EMULATOR_HOST=localhost:8080
 *
 * Run via: npm run test:rules
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
    Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'indii-os-rules-test';
const ALICE_UID = 'alice-uid-001';
const BOB_UID = 'bob-uid-002';
const ANON_UID = 'anon-uid-003';
const ORG_ID = 'org-test-001';

// Token that simulates an anonymous Firebase session
const ANON_TOKEN = { firebase: { sign_in_provider: 'anonymous' } };

// ──────────────────────────────────────────────────────────────────────────────
// Test environment lifecycle
// ──────────────────────────────────────────────────────────────────────────────

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');

    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules,
            host: 'localhost',
            port: 8080,
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

afterEach(async () => {
    // Clear all data between tests to prevent state leakage
    await testEnv.clearFirestore();
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Create a context for a verified (non-anonymous) user */
const verifiedCtx = (uid: string) => testEnv.authenticatedContext(uid);

/** Create a context for an anonymous user */
const anonCtx = () => testEnv.authenticatedContext(ANON_UID, { token: ANON_TOKEN });

/** Create an unauthenticated context */
const unauthCtx = () => testEnv.unauthenticatedContext();

/** Seed data via admin context (bypasses rules) */
const seed = (fn: (ctx: ReturnType<RulesTestEnvironment['withSecurityRulesDisabled']> extends Promise<infer T> ? T : never) => Promise<void>) =>
    testEnv.withSecurityRulesDisabled(fn);

/** Build a valid organization doc with given member UIDs */
const orgDoc = (...members: string[]) => ({
    name: 'Test Org',
    members,
    createdAt: Timestamp.now(),
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. USER DOCUMENTS (/users/{userId})
// ──────────────────────────────────────────────────────────────────────────────

describe('users/{userId}', () => {
    const aliceUserDoc = { id: ALICE_UID, email: 'alice@test.com', role: 'artist', onboarded: true };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), aliceUserDoc);
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'users', ALICE_UID)));
    });

    it('unauthenticated: write denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
    });

    it('owner: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID)));
    });

    it('owner: write allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
    });

    it('other user: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'users', ALICE_UID)));
    });

    it('other user: write denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(setDoc(doc(db, 'users', ALICE_UID), aliceUserDoc));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. USER SUBCOLLECTIONS (/users/{userId}/analyzed_tracks/{trackId})
// ──────────────────────────────────────────────────────────────────────────────

describe('users/{userId}/analyzed_tracks/{trackId}', () => {
    const trackData = {
        id: 'track-1',
        userId: ALICE_UID,
        filename: 'kick.wav',
        features: { bpm: 120, key: 'C', energy: 0.8 },
        analyzedAt: Timestamp.now(),
    };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'users', ALICE_UID, 'analyzed_tracks', 'track-1'), trackData);
        });
    });

    it('owner: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
    });

    it('other user: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'users', ALICE_UID, 'analyzed_tracks', 'track-1')));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. ORGANIZATIONS (/organizations/{orgId})
// ──────────────────────────────────────────────────────────────────────────────

describe('organizations/{orgId}', () => {
    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID));
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
    });

    it('anonymous user: read denied (verified users only)', async () => {
        const db = anonCtx().firestore();
        await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
    });

    it('verified member: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'organizations', ORG_ID)));
    });

    it('verified non-member: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'organizations', ORG_ID)));
    });

    it('anonymous user: create denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(setDoc(doc(db, 'organizations', 'new-org'), orgDoc(ANON_UID)));
    });

    it('verified member: update allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(updateDoc(doc(db, 'organizations', ORG_ID), { name: 'Updated Name' }));
    });

    it('delete always denied (allow delete: if false)', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(deleteDoc(doc(db, 'organizations', ORG_ID)));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. LICENSES (/licenses/{licenseId})
// ──────────────────────────────────────────────────────────────────────────────

describe('licenses/{licenseId}', () => {
    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'licenses', 'lic-1'), { userId: ALICE_UID, title: 'Beat License' });
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'licenses', 'lic-1')));
    });

    it('anonymous user: read denied (verified users only)', async () => {
        const db = anonCtx().firestore();
        await assertFails(getDoc(doc(db, 'licenses', 'lic-1')));
    });

    it('verified user: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'licenses', 'lic-1')));
    });

    it('anonymous user: create denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(setDoc(doc(db, 'licenses', 'lic-anon'), { userId: ANON_UID }));
    });

    it('verified user: create own license allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(setDoc(doc(db, 'licenses', 'lic-new'), { userId: ALICE_UID, title: 'New License' }));
    });

    it('verified user: cannot create license for another user', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(setDoc(doc(db, 'licenses', 'lic-fake'), { userId: BOB_UID, title: 'Fake License' }));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. DDEX RELEASES (/ddexReleases/{releaseId}) — verified + org-member
// ──────────────────────────────────────────────────────────────────────────────

describe('ddexReleases/{releaseId}', () => {
    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            // Org with Alice as member
            await setDoc(doc(ctx.firestore(), 'organizations', ORG_ID), orgDoc(ALICE_UID));
            // A release belonging to that org
            await setDoc(doc(ctx.firestore(), 'ddexReleases', 'rel-1'), {
                orgId: ORG_ID,
                title: 'Test Album',
                userId: ALICE_UID,
            });
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
    });

    it('anonymous user: read denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
    });

    it('verified member: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'ddexReleases', 'rel-1')));
    });

    it('verified non-member: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'ddexReleases', 'rel-1')));
    });

    it('anonymous user: create denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(setDoc(doc(db, 'ddexReleases', 'rel-anon'), { orgId: ORG_ID, title: 'Anon Release' }));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. TAX PROFILES (/tax_profiles/{profileId}) — delete hard-blocked
// ──────────────────────────────────────────────────────────────────────────────

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
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'tax_profiles', 'tp-alice'), validTaxProfile);
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
    });

    it('anonymous user: read denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
    });

    it('verified owner: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
    });

    it('other verified user: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'tax_profiles', 'tp-alice')));
    });

    it('verified owner: create with valid schema allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(setDoc(doc(db, 'tax_profiles', 'tp-new'), validTaxProfile));
    });

    it('anonymous user: create denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(setDoc(doc(db, 'tax_profiles', 'tp-anon'), { ...validTaxProfile, userId: ANON_UID }));
    });

    it('delete always denied — compliance record retention (allow delete: if false)', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(deleteDoc(doc(db, 'tax_profiles', 'tp-alice')));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. ISRC REGISTRY (/isrc_registry/{isrcId}) — immutable after create
// ──────────────────────────────────────────────────────────────────────────────

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
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'isrc_registry', 'isrc-1'), validISRC);
        });
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
    });

    it('anonymous user: read denied', async () => {
        const db = anonCtx().firestore();
        await assertFails(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
    });

    it('verified owner: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'isrc_registry', 'isrc-1')));
    });

    it('verified owner: create with valid ISRC format allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(setDoc(doc(db, 'isrc_registry', 'isrc-new'), { ...validISRC, isrc: 'US-S1Z-25-00002' }));
    });

    it('invalid ISRC format: create denied', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        // Regex: ^[A-Z]{2}-[A-Z0-9]{3}-[0-9]{2}-[0-9]{5}$
        await assertFails(setDoc(doc(db, 'isrc_registry', 'isrc-bad'), { ...validISRC, isrc: 'INVALID-FORMAT' }));
    });

    it('update always denied — ISRCs are permanent identifiers (allow update: if false)', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(updateDoc(doc(db, 'isrc_registry', 'isrc-1'), { trackTitle: 'Changed Title' }));
    });

    it('delete always denied — ISRCs are permanent identifiers (allow delete: if false)', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(deleteDoc(doc(db, 'isrc_registry', 'isrc-1')));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. RATE LIMITS (/user_rate_limits/{docId}) — docId format enforcement
// ──────────────────────────────────────────────────────────────────────────────

describe('user_rate_limits/{docId}', () => {
    const rateData = { userId: ALICE_UID, count: 5 };

    it('correct format (userId_timestamp): read allowed', async () => {
        const docId = `${ALICE_UID}_1700000000000`;
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'user_rate_limits', docId), rateData);
        });
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'user_rate_limits', docId)));
    });

    it('wrong user prefix: read denied', async () => {
        // Bob tries to read Alice's rate limit doc
        const docId = `${ALICE_UID}_1700000000000`;
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'user_rate_limits', docId), rateData);
        });
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'user_rate_limits', docId)));
    });

    it('non-numeric suffix: write denied', async () => {
        // docId must match ^{uid}_[0-9]+$
        const badDocId = `${ALICE_UID}_abc`;
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(setDoc(doc(db, 'user_rate_limits', badDocId), rateData));
    });

    it('unauthenticated: denied', async () => {
        const docId = `${ALICE_UID}_1700000000000`;
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'user_rate_limits', docId)));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. FINANCE COLLECTIONS (/revenue/{revenueId})
// ──────────────────────────────────────────────────────────────────────────────

describe('revenue/{revenueId}', () => {
    const revenueData = { userId: ALICE_UID, amount: 100, source: 'streaming' };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'revenue', 'rev-1'), revenueData);
        });
    });

    it('owner: read allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(getDoc(doc(db, 'revenue', 'rev-1')));
    });

    it('other user: read denied', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(getDoc(doc(db, 'revenue', 'rev-1')));
    });

    it('unauthenticated: read denied', async () => {
        const db = unauthCtx().firestore();
        await assertFails(getDoc(doc(db, 'revenue', 'rev-1')));
    });

    it('owner: create own revenue record allowed', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertSucceeds(setDoc(doc(db, 'revenue', 'rev-new'), revenueData));
    });

    it('cannot create revenue record for another user', async () => {
        const db = verifiedCtx(BOB_UID).firestore();
        await assertFails(setDoc(doc(db, 'revenue', 'rev-fake'), revenueData));
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. DENY-ALL: arbitrary collection access denied
// ──────────────────────────────────────────────────────────────────────────────

describe('deny-all: unlisted collections', () => {
    it('authenticated user cannot read/write arbitrary collection', async () => {
        const db = verifiedCtx(ALICE_UID).firestore();
        await assertFails(getDoc(doc(db, 'some_unlisted_collection', 'doc-1')));
        await assertFails(setDoc(doc(db, 'some_unlisted_collection', 'doc-1'), { data: true }));
    });
});
