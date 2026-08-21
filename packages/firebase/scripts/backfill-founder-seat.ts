/**
 * ONE-OFF ADMIN BACKFILL — Founder seat #1 record (founder-approved 2026-08-20).
 *
 * Repairs the founder's own Firestore records so the studio badge, seat
 * number, and agreement hash work (the founder's account has tier: founder
 * but no founders/{uid}, subscriptions/{uid}, or entitlement records — their
 * earlier activation predates the current schema).
 *
 * This mirrors the EXACT transaction logic of activateFounderPass.ts (seat
 * counting incl. the reserved internal seat, agreement hash formula,
 * subscription doc, user profile merge, server-owned entitlement grant,
 * founders_meta/summary counter). The GitHub commit step is intentionally
 * deferred per the founder's G4 decision (GITHUB_TOKEN_FOUNDERS is mock); a
 * founder_github_commit_queue entry records the pending commit honestly.
 *
 * Identity: founder UID g2AcFApNZvQKYlGg0LQuVADCFoO2 (ledger ISSUE-1374),
 * public name "wiil", seat 1 (the reserved internal i-i Founder seat).
 *
 * RUN (production): npx tsx scripts/backfill-founder-seat.ts
 * Requires ADC for the project service account (already configured).
 * Idempotent guard: aborts if founders/{uid} already exists.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { writeFounderEntitlementGrant } from '../src/functions/auth/entitlements';
import { SubscriptionTier } from '../src/shared/subscription/types';

const TARGET_UID = 'g2AcFApNZvQKYlGg0LQuVADCFoO2';
const DISPLAY_NAME = 'wiil';
const AGREEMENT_VERSION = '1.0.0';
const MAX_FOUNDER_SEATS = 11;
const RESERVED_INTERNAL_FOUNDER_SEATS = 1;

async function main() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'indii-music-founder' });
    }
    const db = admin.firestore();

    // ── Idempotency guard ────────────────────────────────────────────────
    const existing = await db.collection('founders').doc(TARGET_UID).get();
    if (existing.exists) {
        console.error('ABORT: founders/' + TARGET_UID + ' already exists — nothing written.');
        process.exit(1);
    }

    const joinedAt = new Date().toISOString();
    const verificationHash = createHash('sha256')
        .update(`${DISPLAY_NAME}|${AGREEMENT_VERSION}|${joinedAt}`)
        .digest('hex');

    console.log('Target UID :', TARGET_UID);
    console.log('Name       :', DISPLAY_NAME);
    console.log('Seat       : 1 (reserved internal i-i Founder seat)');
    console.log('joinedAt   :', joinedAt);
    console.log('hash       :', verificationHash);

    // ── Transaction (mirrors activateFounderPass.ts) ─────────────────────
    let seat = 0;
    await db.runTransaction(async (tx) => {
        const foundersSnap = await tx.get(db.collection('founders'));
        const hasInternalSeatInFirestore = foundersSnap.docs.some((doc) => doc.get('seat') === 1);
        const occupiedSeatCount =
            foundersSnap.size + (hasInternalSeatInFirestore ? 0 : RESERVED_INTERNAL_FOUNDER_SEATS);

        if (occupiedSeatCount >= MAX_FOUNDER_SEATS) {
            throw new Error('All 11 founder seats have been claimed — aborting.');
        }

        const existingRef = db.collection('founders').doc(TARGET_UID);
        const metaRef = db.collection('founders_meta').doc('summary');
        const metaSnap = await tx.get(metaRef);

        seat = occupiedSeatCount + 1;

        tx.set(existingRef, {
            seat,
            name: DISPLAY_NAME,
            joinedAt,
            verificationHash,
            agreementVersion: AGREEMENT_VERSION,
            uid: TARGET_UID,
            createdAt: FieldValue.serverTimestamp(),
            activatedBy: 'system-backfill-2026-08-20',
        });

        tx.set(
            db.collection('subscriptions').doc(TARGET_UID),
            {
                tier: SubscriptionTier.FOUNDER,
                status: 'active',
                currentPeriodStart: Date.now(),
                currentPeriodEnd: new Date('2099-01-01').getTime(),
                cancelAtPeriodEnd: false,
                updatedAt: Date.now(),
            },
            { merge: true },
        );

        tx.set(
            db.collection('users').doc(TARGET_UID),
            {
                isFounder: true,
                subscriptionTier: SubscriptionTier.FOUNDER,
                tier: SubscriptionTier.FOUNDER,
            },
            { merge: true },
        );

        writeFounderEntitlementGrant(tx, db, TARGET_UID, existingRef.path);

        let currentMetaCount = 0;
        let currentMetaFounders: Array<{ seat: number; name: string; joinedAt: string }> = [];
        if (metaSnap.exists) {
            const data = metaSnap.data() || {};
            currentMetaCount = typeof data.count === 'number' ? data.count : 0;
            currentMetaFounders = Array.isArray(data.founders) ? data.founders : [];
        }
        currentMetaFounders.push({ seat, name: DISPLAY_NAME, joinedAt });

        tx.set(
            metaRef,
            {
                count: Math.max(currentMetaCount + 1, seat),
                founders: currentMetaFounders,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
    });

    // ── Honest pending-commit record (G4: GitHub token is mock, deferred) ─
    await db.collection('founder_github_commit_queue').add({
        seat,
        name: DISPLAY_NAME,
        joinedAt,
        verificationHash,
        uid: TARGET_UID,
        error:
            'GitHub commit deferred per founder decision 2026-08-20 (G4): GITHUB_TOKEN_FOUNDERS is mock. Complete after a real PAT is set.',
        timedOut: false,
        createdAt: FieldValue.serverTimestamp(),
    });

    // ── Verification readback ────────────────────────────────────────────
    const f = await db.collection('founders').doc(TARGET_UID).get();
    const s = await db.collection('subscriptions').doc(TARGET_UID).get();
    const u = await db.collection('users').doc(TARGET_UID).get();
    const m = await db.collection('founders_meta').doc('summary').get();
    const e = await db.collection('users').doc(TARGET_UID).collection('entitlements').doc('current').get();

    const rehash =
        createHash('sha256')
            .update(`${f.data()?.name}|${AGREEMENT_VERSION}|${f.data()?.joinedAt}`)
            .digest('hex');

    console.log('\n── VERIFICATION ──');
    console.log('founders/' + TARGET_UID + '       : seat=' + f.data()?.seat + ' name=' + f.data()?.name);
    console.log('hash match (recomputed)  :', rehash === f.data()?.verificationHash);
    console.log('subscriptions tier       :', s.data()?.tier, '| status:', s.data()?.status);
    console.log('users isFounder          :', u.data()?.isFounder);
    console.log('entitlements current     :', e.exists ? e.data()?.tier + '/' + e.data()?.status : 'MISSING');
    console.log('founders_meta count      :', m.data()?.count);
    console.log('DONE — backfill complete and verified.');
}

main().catch((err) => {
    console.error('BACKFILL FAILED:', err);
    process.exit(1);
});
