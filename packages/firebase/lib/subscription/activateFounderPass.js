"use strict";
/**
 * Firebase Cloud Function: Activate Founders Pass
 *
 * Called after a successful $2,500 one-time Stripe payment.
 * This function:
 *   1. Verifies the Stripe payment intent was paid
 *   2. Validates amount ($2,500 USD), currency, metadata, and no refunds/disputes
 *   3. Short-circuits duplicate activations (idempotency via paymentIntentId)
 *   4. Checks that fewer than 10 founders have been seated
 *   5. Sanitizes displayName input (whitelist characters, enforce length)
 *   6. Generates a SHA-256 covenant hash as the founder's receipt
 *   7. Writes the founder record to Firestore
 *   8. Sets the user's subscription tier to FOUNDER (lifetime)
 *   9. Commits the new entry to src/config/founders.ts via the GitHub API
 *      (making the record permanent and publicly verifiable)
 *  10. Returns { seat, covenantHash, joinedAt } to the client
 *
 * Security:
 *   - Caller must be authenticated (Firebase Auth uid === userId)
 *   - Stripe payment intent must be in 'succeeded' state with no refunds/disputes
 *   - Seat count is checked inside a Firestore transaction (no double-seating)
 *   - Idempotency: paymentIntentId is used as the dedup key
 *   - displayName is sanitized (character whitelist + length cap)
 *   - GitHub token is a fine-grained PAT (contents:write on this repo only)
 *   - GitHub API calls have an explicit 15s timeout via AbortController
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateFounderPass = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
const types_1 = require("../shared/subscription/types");
const GITHUB_REPO_OWNER = 'the-walking-agency-det';
const GITHUB_REPO_NAME = 'indiiOS-Alpha-Electron';
const FOUNDERS_FILE_PATH = 'src/config/founders.ts';
const MAX_FOUNDER_SEATS = 10;
const COVENANT_VERSION = '1.0.0';
/** Timeout (ms) for individual GitHub API calls */
const GITHUB_API_TIMEOUT_MS = 15000;
/** Maximum allowed length for founder display names */
const MAX_DISPLAY_NAME_LENGTH = 64;
/**
 * Regex for allowed displayName characters.
 * Permits Unicode letters, digits, spaces, hyphens, underscores, apostrophes,
 * and periods. Rejects control characters, angle brackets, backticks, etc.
 */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}\s\-_'.]+$/u;
/**
 * Sanitize and validate a founder display name.
 * Throws HttpsError if the name is invalid.
 */
function sanitizeDisplayName(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Display name cannot be empty.');
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
        throw new https_1.HttpsError('invalid-argument', `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`);
    }
    if (!DISPLAY_NAME_PATTERN.test(trimmed)) {
        throw new https_1.HttpsError('invalid-argument', 'Display name contains invalid characters. Letters, digits, spaces, hyphens, underscores, apostrophes, and periods are allowed.');
    }
    return trimmed;
}
/**
 * Generate SHA-256 covenant hash: SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")
 */
function generateCovenantHash(name, joinedAt) {
    return (0, crypto_1.createHash)('sha256')
        .update(`${name}|${COVENANT_VERSION}|${joinedAt}`)
        .digest('hex');
}
/**
 * Create an AbortSignal that fires after the given timeout.
 * Returns both the signal and a cleanup function to prevent timer leaks.
 */
function createTimeoutSignal(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        cleanup: () => clearTimeout(timer),
    };
}
/**
 * Fetch the current contents of founders.ts from GitHub to get the file SHA
 * (required for the update API call).
 */
async function getFoundersFileSha(githubToken, signal) {
    const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${FOUNDERS_FILE_PATH}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GitHub API fetch failed (${response.status}): ${err}`);
    }
    const data = await response.json();
    // GitHub returns base64-encoded content
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content: decoded, sha: data.sha };
}
/**
 * Insert a new FounderRecord into the FOUNDERS array inside founders.ts.
 * Replaces the placeholder comment block with the real entry appended to the array.
 */
function injectFounderEntry(fileContent, record) {
    // Use JSON.stringify for string values to properly escape quotes,
    // newlines, and backslashes. uid is deliberately omitted from the
    // public git record (it stays in Firestore only).
    const entry = `  {\n    seat: ${record.seat},\n    name: ${JSON.stringify(record.name)},\n    joinedAt: ${JSON.stringify(record.joinedAt)},\n    covenantHash: ${JSON.stringify(record.covenantHash)},\n  },`;
    // Replace the placeholder comment line with the new entry + placeholder preserved
    const placeholder = "  // ── Founder entries are appended here automatically ──";
    if (!fileContent.includes(placeholder)) {
        throw new Error('Placeholder not found in founders.ts');
    }
    return fileContent.replace(placeholder, `${entry}\n${placeholder}`);
}
/**
 * Commit the updated founders.ts to main via the GitHub Contents API.
 */
async function commitFounderToGitHub(githubToken, updatedContent, fileSha, founder, signal) {
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
        signal,
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GitHub commit failed (${response.status}): ${err}`);
    }
    console.log(`[activateFounderPass] Committed Founder #${founder.seat} to GitHub`);
}
exports.activateFounderPass = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey, secrets_1.githubTokenFounders],
    timeoutSeconds: 120,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const { userId, sessionId, displayName } = request.data;
    // Auth check
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid) || request.auth.uid !== userId) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in as the purchasing user.');
    }
    if (!sessionId || !(displayName === null || displayName === void 0 ? void 0 : displayName.trim())) {
        throw new https_1.HttpsError('invalid-argument', 'sessionId and displayName are required.');
    }
    // ── Input sanitization ──────────────────────────────────────────────
    const name = sanitizeDisplayName(displayName);
    // ── Idempotency guard: short-circuit if this sessionId was already used ──
    const db = (0, firestore_1.getFirestore)();
    const existingBySession = await db.collection('founders')
        .where('sessionId', '==', sessionId)
        .limit(1)
        .get();
    if (!existingBySession.empty) {
        const existing = existingBySession.docs[0].data();
        console.log(`[activateFounderPass] Duplicate call with sessionId=${sessionId}, returning existing record.`);
        return {
            seat: existing.seat,
            covenantHash: existing.covenantHash,
            joinedAt: existing.joinedAt,
            message: `Your Founder #${existing.seat} pass was already activated.`,
            githubCommitPending: (_b = existing.githubCommitPending) !== null && _b !== void 0 ? _b : false,
        };
    }
    // 1. Verify payment with Stripe
    let session;
    let paymentIntent;
    try {
        session = await config_1.stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent', 'payment_intent.latest_charge'],
        });
        paymentIntent = session.payment_intent;
    }
    catch (err) {
        throw new https_1.HttpsError('internal', `Stripe session retrieval failed: ${err}`);
    }
    if (!paymentIntent || typeof paymentIntent === 'string') {
        throw new https_1.HttpsError('failed-precondition', 'No payment intent associated with this session.');
    }
    if (paymentIntent.status !== 'succeeded') {
        throw new https_1.HttpsError('failed-precondition', `Payment not completed. Status: ${paymentIntent.status}`);
    }
    // Verify this payment was for the founders pass
    if (((_c = paymentIntent.metadata) === null || _c === void 0 ? void 0 : _c.type) !== 'founder_pass') {
        throw new https_1.HttpsError('invalid-argument', 'Payment intent is not for a founders pass.');
    }
    // Verify the payment belongs to this user
    if (((_d = paymentIntent.metadata) === null || _d === void 0 ? void 0 : _d.userId) !== userId) {
        throw new https_1.HttpsError('permission-denied', 'Payment intent does not belong to this user.');
    }
    // Verify the payment amount and currency match the founders pass price
    const FOUNDER_PASS_AMOUNT_CENTS = 250000; // $2,500.00
    if (!paymentIntent.amount || paymentIntent.amount < FOUNDER_PASS_AMOUNT_CENTS) {
        throw new https_1.HttpsError('failed-precondition', `Payment amount ($${(((_e = paymentIntent.amount) !== null && _e !== void 0 ? _e : 0) / 100).toFixed(2)}) is below the required $2,500.00.`);
    }
    if (((_f = paymentIntent.currency) === null || _f === void 0 ? void 0 : _f.toLowerCase()) !== 'usd') {
        throw new https_1.HttpsError('failed-precondition', `Payment currency (${paymentIntent.currency}) is not USD.`);
    }
    // ── Refund / dispute check ──────────────────────────────────────────
    // The latest_charge was expanded above. Check for refunds and disputes.
    const latestCharge = paymentIntent.latest_charge;
    if (latestCharge && typeof latestCharge === 'object') {
        if (latestCharge.refunded) {
            throw new https_1.HttpsError('failed-precondition', 'This payment has been refunded.');
        }
        if (latestCharge.disputed) {
            throw new https_1.HttpsError('failed-precondition', 'This payment has an active dispute.');
        }
        if (latestCharge.amount_refunded && latestCharge.amount_refunded > 0) {
            throw new https_1.HttpsError('failed-precondition', 'This payment has been partially refunded.');
        }
    }
    const joinedAt = new Date().toISOString();
    const covenantHash = generateCovenantHash(name, joinedAt);
    // 2. Check seat count + write records in a transaction (no double-seating)
    let seat;
    try {
        seat = await db.runTransaction(async (tx) => {
            // Count existing founders
            const foundersSnap = await tx.get(db.collection('founders'));
            const currentCount = foundersSnap.size;
            if (currentCount >= MAX_FOUNDER_SEATS) {
                throw new https_1.HttpsError('resource-exhausted', 'All 10 founder seats have been claimed.');
            }
            // Check this user hasn't already activated a founder pass
            const existingRef = db.collection('founders').doc(userId);
            const existing = await tx.get(existingRef);
            if (existing.exists) {
                throw new https_1.HttpsError('already-exists', 'You already have a founders pass activated.');
            }
            const seatNumber = currentCount + 1;
            // Write founder record to Firestore
            tx.set(existingRef, {
                seat: seatNumber,
                name,
                joinedAt,
                covenantHash,
                covenantVersion: COVENANT_VERSION,
                sessionId,
                paymentIntentId: paymentIntent.id || '',
                uid: userId,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            // Update subscription tier to FOUNDER (lifetime)
            tx.set(db.collection('subscriptions').doc(userId), {
                tier: types_1.SubscriptionTier.FOUNDER,
                status: 'active',
                currentPeriodStart: Date.now(),
                // Lifetime — set end far in the future (year 2099)
                currentPeriodEnd: new Date('2099-01-01').getTime(),
                cancelAtPeriodEnd: false,
                updatedAt: Date.now(),
            }, { merge: true });
            return seatNumber;
        });
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('internal', `Firestore transaction failed: ${err}`);
    }
    // 3. Commit the founder entry to GitHub (best-effort — Firestore already committed)
    //    Uses AbortController to enforce a 15s timeout per API call. If GitHub hangs,
    //    we gracefully fall back to the commit queue rather than exhausting the
    //    120s Cloud Function timeout.
    let githubCommitPending = false;
    try {
        const githubToken = secrets_1.githubTokenFounders.value();
        // Fetch with timeout
        const fetchTimeout = createTimeoutSignal(GITHUB_API_TIMEOUT_MS);
        let fileSha;
        let currentFileContent;
        try {
            const result = await getFoundersFileSha(githubToken, fetchTimeout.signal);
            fileSha = result.sha;
            currentFileContent = result.content;
        }
        finally {
            fetchTimeout.cleanup();
        }
        const updatedContent = injectFounderEntry(currentFileContent, {
            seat,
            name,
            joinedAt,
            covenantHash,
        });
        // Commit with timeout
        const commitTimeout = createTimeoutSignal(GITHUB_API_TIMEOUT_MS);
        try {
            await commitFounderToGitHub(githubToken, updatedContent, fileSha, { name, seat }, commitTimeout.signal);
        }
        finally {
            commitTimeout.cleanup();
        }
        console.log(`[activateFounderPass] Founder #${seat} (${name}) successfully committed to repo.`);
    }
    catch (gitErr) {
        // Non-fatal: Firestore record is the authoritative source.
        // GitHub commit will be retried manually if needed.
        githubCommitPending = true;
        const isTimeout = gitErr instanceof Error && gitErr.name === 'AbortError';
        console.error(`[activateFounderPass] GitHub commit failed (non-fatal, timeout=${isTimeout}):`, gitErr);
        // Queue for manual retry via admin tools
        await (0, firestore_1.getFirestore)().collection('founder_github_commit_queue').add({
            seat,
            name,
            joinedAt,
            covenantHash,
            uid: userId,
            error: String(gitErr),
            timedOut: isTimeout,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        }).catch(() => { });
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
//# sourceMappingURL=activateFounderPass.js.map