/**
 * Firebase Cloud Function: Activate Founders Pass
 *
 * Called after a successful $2,500 one-time Stripe payment.
 * This function:
 *   1. Verifies the Stripe payment intent was paid
 *   2. Checks that fewer than 10 founders have been seated
 *   3. Generates a SHA-256 covenant hash as the founder's receipt
 *   4. Writes the founder record to Firestore
 *   5. Sets the user's subscription tier to FOUNDER (lifetime)
 *   6. Commits the new entry to src/config/founders.ts via the GitHub API
 *      (making the record permanent and publicly verifiable)
 *   7. Returns { seat, covenantHash, joinedAt } to the client
 *
 * Security:
 *   - Caller must be authenticated (Firebase Auth uid === userId)
 *   - Stripe payment intent must be in 'succeeded' state
 *   - Seat count is checked inside a Firestore transaction (no double-seating)
 *   - GitHub token is a fine-grained PAT (contents:write on this repo only)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { stripe } from '../stripe/config';
import { stripeSecretKey, githubTokenFounders } from '../config/secrets';
import { SubscriptionTier } from '../shared/subscription/types';

const GITHUB_REPO_OWNER = 'the-walking-agency-det';
const GITHUB_REPO_NAME = 'indiiOS-Alpha-Electron';
const FOUNDERS_FILE_PATH = 'src/config/founders.ts';
const MAX_FOUNDER_SEATS = 10;
const COVENANT_VERSION = '1.0.0';

export interface ActivateFounderPassParams {
    userId: string;
    paymentIntentId: string;
    /** Founder's chosen public name or handle */
    displayName: string;
}

export interface ActivateFounderPassResult {
    seat: number;
    covenantHash: string;
    joinedAt: string;
    message: string;
    /** true when the GitHub commit failed and was queued for manual retry */
    githubCommitPending: boolean;
}

/**
 * Generate SHA-256 covenant hash: SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")
 */
function generateCovenantHash(name: string, joinedAt: string): string {
    return createHash('sha256')
        .update(`${name}|${COVENANT_VERSION}|${joinedAt}`)
        .digest('hex');
}

/**
 * Fetch the current contents of founders.ts from GitHub to get the file SHA
 * (required for the update API call).
 */
async function getFoundersFileSha(githubToken: string): Promise<{ content: string; sha: string }> {
    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${FOUNDERS_FILE_PATH}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GitHub API fetch failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { content: string; sha: string };
    // GitHub returns base64-encoded content
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content: decoded, sha: data.sha };
}

/**
 * Insert a new FounderRecord into the FOUNDERS array inside founders.ts.
 * Replaces the placeholder comment block with the real entry appended to the array.
 */
function injectFounderEntry(
    fileContent: string,
    record: { seat: number; name: string; joinedAt: string; covenantHash: string }
): string {
    // Use JSON.stringify for string values to properly escape quotes,
    // newlines, and backslashes. uid is deliberately omitted from the
    // public git record (it stays in Firestore only).
    const entry = `  {
    seat: ${record.seat},
    name: ${JSON.stringify(record.name)},
    joinedAt: ${JSON.stringify(record.joinedAt)},
    covenantHash: ${JSON.stringify(record.covenantHash)},
  },`;

    // Replace the placeholder comment line with the new entry + placeholder preserved
    return fileContent.replace(
        '  // ── Founder entries are appended here automatically ──',
        `${entry}\n  // ── Founder entries are appended here automatically ──`
    );
}

/**
 * Commit the updated founders.ts to main via the GitHub Contents API.
 */
async function commitFounderToGitHub(
    githubToken: string,
    updatedContent: string,
    fileSha: string,
    founder: { name: string; seat: number }
): Promise<void> {
    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${FOUNDERS_FILE_PATH}`;
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `feat(founders): add Founder #${founder.seat} — ${founder.name}\n\nCovenant seat activated. This entry is permanent per the IndiiOS Founders Agreement.\nSee src/config/founders.ts for covenant terms.\n\n[founders-program]`,
            content: encodedContent,
            sha: fileSha,
            branch: 'main',
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GitHub commit failed (${response.status}): ${err}`);
    }

    console.log(`[activateFounderPass] Committed Founder #${founder.seat} to GitHub`);
}

export const activateFounderPass = onCall({
    secrets: [stripeSecretKey, githubTokenFounders],
    timeoutSeconds: 120,
    memory: '256MiB',
}, async (request): Promise<ActivateFounderPassResult> => {
    const { userId, paymentIntentId, displayName } = request.data as ActivateFounderPassParams;

    // Auth check
    if (!request.auth?.uid || request.auth.uid !== userId) {
        throw new HttpsError('unauthenticated', 'Must be signed in as the purchasing user.');
    }

    if (!paymentIntentId || !displayName?.trim()) {
        throw new HttpsError('invalid-argument', 'paymentIntentId and displayName are required.');
    }

    const name = displayName.trim();

    // 1. Verify payment with Stripe
    let paymentIntent;
    try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
        throw new HttpsError('internal', `Stripe payment verification failed: ${err}`);
    }

    if (paymentIntent.status !== 'succeeded') {
        throw new HttpsError('failed-precondition', `Payment not completed. Status: ${paymentIntent.status}`);
    }

    // Verify this payment was for the founders pass
    if (paymentIntent.metadata?.type !== 'founder_pass') {
        throw new HttpsError('invalid-argument', 'Payment intent is not for a founders pass.');
    }

    // Verify the payment belongs to this user
    if (paymentIntent.metadata?.userId !== userId) {
        throw new HttpsError('permission-denied', 'Payment intent does not belong to this user.');
    }

    // Verify the payment amount and currency match the founders pass price
    const FOUNDER_PASS_AMOUNT_CENTS = 250_000; // $2,500.00
    if (!paymentIntent.amount || paymentIntent.amount < FOUNDER_PASS_AMOUNT_CENTS) {
        throw new HttpsError(
            'failed-precondition',
            `Payment amount ($${((paymentIntent.amount ?? 0) / 100).toFixed(2)}) is below the required $2,500.00.`
        );
    }
    if (paymentIntent.currency?.toLowerCase() !== 'usd') {
        throw new HttpsError(
            'failed-precondition',
            `Payment currency (${paymentIntent.currency}) is not USD.`
        );
    }

    const db = getFirestore();
    const joinedAt = new Date().toISOString();
    const covenantHash = generateCovenantHash(name, joinedAt);

    // 2. Check seat count + write records in a transaction (no double-seating)
    let seat: number;
    try {
        seat = await db.runTransaction(async (tx) => {
            // Count existing founders
            const foundersSnap = await tx.get(db.collection('founders'));
            const currentCount = foundersSnap.size;

            if (currentCount >= MAX_FOUNDER_SEATS) {
                throw new HttpsError('resource-exhausted', 'All 10 founder seats have been claimed.');
            }

            // Check this user hasn't already activated a founder pass
            const existingRef = db.collection('founders').doc(userId);
            const existing = await tx.get(existingRef);
            if (existing.exists) {
                throw new HttpsError('already-exists', 'You already have a founders pass activated.');
            }

            const seatNumber = currentCount + 1;

            // Write founder record to Firestore
            tx.set(existingRef, {
                seat: seatNumber,
                name,
                joinedAt,
                covenantHash,
                covenantVersion: COVENANT_VERSION,
                paymentIntentId,
                uid: userId,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Update subscription tier to FOUNDER (lifetime)
            tx.set(db.collection('subscriptions').doc(userId), {
                tier: SubscriptionTier.FOUNDER,
                status: 'active',
                currentPeriodStart: Date.now(),
                // Lifetime — set end far in the future (year 2099)
                currentPeriodEnd: new Date('2099-01-01').getTime(),
                cancelAtPeriodEnd: false,
                updatedAt: Date.now(),
            }, { merge: true });

            return seatNumber;
        });
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        throw new HttpsError('internal', `Firestore transaction failed: ${err}`);
    }

    // 3. Commit the founder entry to GitHub (best-effort — Firestore already committed)
    let githubCommitPending = false;
    try {
        const githubToken = githubTokenFounders.value();
        const { content: currentFileContent, sha: fileSha } = await getFoundersFileSha(githubToken);
        const updatedContent = injectFounderEntry(currentFileContent, {
            seat,
            name,
            joinedAt,
            covenantHash,
        });
        await commitFounderToGitHub(githubToken, updatedContent, fileSha, { name, seat });
        console.log(`[activateFounderPass] Founder #${seat} (${name}) successfully committed to repo.`);
    } catch (gitErr) {
        // Non-fatal: Firestore record is the authoritative source.
        // GitHub commit will be retried manually if needed.
        githubCommitPending = true;
        console.error('[activateFounderPass] GitHub commit failed (non-fatal):', gitErr);
        // Queue for manual retry via admin tools
        await getFirestore().collection('founder_github_commit_queue').add({
            seat,
            name,
            joinedAt,
            covenantHash,
            uid: userId,
            error: String(gitErr),
            createdAt: FieldValue.serverTimestamp(),
        }).catch(() => { /* best-effort */ });
    }

    const message = githubCommitPending
        ? `Welcome, Founder #${seat}. Your covenant hash is your permanent receipt. It is stored in Firestore; the repository commit is pending and will be completed shortly.`
        : `Welcome, Founder #${seat}. Your covenant hash is your permanent receipt. It has been committed to the indiiOS repository.`;

    return {
        seat,
        covenantHash,
        joinedAt,
        message,
        githubCommitPending,
    };
});
