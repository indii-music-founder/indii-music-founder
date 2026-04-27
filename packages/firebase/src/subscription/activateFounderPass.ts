/**
 * Firebase Cloud Function: Activate Founders Pass (Manual Flow)
 *
 * Called manually by an Admin after receiving alternative payments (Cash App, Wire).
 * This function:
 *   1. Verifies the caller is an Admin
 *   2. Checks that fewer than 10 founders have been seated
 *   3. Checks if targetUid is already a founder to avoid duplicates
 *   4. Sanitizes displayName input (whitelist characters, enforce length)
 *   5. Generates a SHA-256 agreement hash as the founder's receipt
 *   6. Writes the founder record to Firestore
 *   7. Sets the user's subscription tier to FOUNDER (lifetime)
 *   8. Commits the new entry to src/config/founders.ts via the GitHub API
 *      (making the record permanent and publicly verifiable)
 *
 * Security:
 *   - Caller must be an Admin
 *   - Seat count is checked inside a Firestore transaction (no double-seating)
 *   - displayName is sanitized (character whitelist + length cap)
 *   - GitHub token is a fine-grained PAT (contents:write on this repo only)
 *   - GitHub API calls have an explicit 15s timeout via AbortController
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { githubTokenFounders } from '../config/secrets';
import { SubscriptionTier } from '../shared/subscription/types';

const GITHUB_REPO_OWNER = 'new-detroit-music-llc';
const GITHUB_REPO_NAME = 'indiiOS-Alpha-Electron';
const FOUNDERS_FILE_PATH = 'packages/renderer/src/config/founders.ts'; // Fixing path to point to renderer config
const MAX_FOUNDER_SEATS = 10;
const AGREEMENT_VERSION = '1.0.0';

/** Timeout (ms) for individual GitHub API calls */
const GITHUB_API_TIMEOUT_MS = 15_000;

/** Maximum allowed length for founder display names */
const MAX_DISPLAY_NAME_LENGTH = 64;

/**
 * Regex for allowed displayName characters.
 * Permits Unicode letters, digits, spaces, hyphens, underscores, apostrophes,
 * and periods. Rejects control characters, angle brackets, backticks, etc.
 */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}\s\-_'.]+$/u;

export interface ActivateFounderPassParams {
    targetUid: string;
    /** Founder's chosen public name or handle */
    displayName: string;
}

export interface ActivateFounderPassResult {
    seat: number;
    verificationHash: string;
    joinedAt: string;
    message: string;
    /** true when the GitHub commit failed and was queued for manual retry */
    githubCommitPending: boolean;
}

/**
 * Sanitize and validate a founder display name.
 * Throws HttpsError if the name is invalid.
 */
function sanitizeDisplayName(raw: string): string {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
        throw new HttpsError('invalid-argument', 'Display name cannot be empty.');
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
        throw new HttpsError(
            'invalid-argument',
            `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`
        );
    }
    if (!DISPLAY_NAME_PATTERN.test(trimmed)) {
        throw new HttpsError(
            'invalid-argument',
            'Display name contains invalid characters. Letters, digits, spaces, hyphens, underscores, apostrophes, and periods are allowed.'
        );
    }

    return trimmed;
}

/**
 * Generate SHA-256 agreement hash: SHA-256("{name}|{AGREEMENT_VERSION}|{joinedAt}")
 */
function generateAgreementHash(name: string, joinedAt: string): string {
    return createHash('sha256')
        .update(`${name}|${AGREEMENT_VERSION}|${joinedAt}`)
        .digest('hex');
}

/**
 * Create an AbortSignal that fires after the given timeout.
 * Returns both the signal and a cleanup function to prevent timer leaks.
 */
function createTimeoutSignal(ms: number): { signal: AbortSignal; cleanup: () => void } {
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
async function getFoundersFileSha(
    githubToken: string,
    signal?: AbortSignal
): Promise<{ content: string; sha: string }> {
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
    record: { seat: number; name: string; joinedAt: string; verificationHash: string }
): string {
    // Use JSON.stringify for string values to properly escape quotes,
    // newlines, and backslashes. uid is deliberately omitted from the
    // public git record (it stays in Firestore only).
    const entry = `  {\n    seat: ${record.seat},\n    name: ${JSON.stringify(record.name)},\n    joinedAt: ${JSON.stringify(record.joinedAt)},\n    verificationHash: ${JSON.stringify(record.verificationHash)},\n  },`;

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
async function commitFounderToGitHub(
    githubToken: string,
    updatedContent: string,
    fileSha: string,
    founder: { name: string; seat: number },
    signal?: AbortSignal
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
            message: `feat(founders): add Founder #${founder.seat} — ${founder.name}\n\nFounder seat activated. This entry is permanent per the IndiiOS Founders Agreement.\nSee ${FOUNDERS_FILE_PATH} for agreement terms.\n\n[founders-program]`,
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

export const activateFounderPass = onCall({
    secrets: [githubTokenFounders],
    timeoutSeconds: 120,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request): Promise<ActivateFounderPassResult> => {
    const { targetUid, displayName } = request.data as ActivateFounderPassParams;

    // Admin Guard
    if (!request.auth || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Must be an admin to activate a founder pass.');
    }

    if (!targetUid || !displayName?.trim()) {
        throw new HttpsError('invalid-argument', 'targetUid and displayName are required.');
    }

    // ── Input sanitization ──────────────────────────────────────────────
    const name = sanitizeDisplayName(displayName);

    const db = getFirestore();

    const joinedAt = new Date().toISOString();
    const verificationHash = generateAgreementHash(name, joinedAt);

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
            const existingRef = db.collection('founders').doc(targetUid);
            const existing = await tx.get(existingRef);
            if (existing.exists) {
                throw new HttpsError('already-exists', 'This user already has a founders pass activated.');
            }

            const seatNumber = currentCount + 1;

            // Write founder record to Firestore
            tx.set(existingRef, {
                seat: seatNumber,
                name,
                joinedAt,
                verificationHash,
                agreementVersion: AGREEMENT_VERSION,
                uid: targetUid,
                createdAt: FieldValue.serverTimestamp(),
                activatedBy: request.auth?.uid,
            });

            // Update subscription tier to FOUNDER (lifetime)
            tx.set(db.collection('subscriptions').doc(targetUid), {
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

        // Fetch with timeout
        const fetchTimeout = createTimeoutSignal(GITHUB_API_TIMEOUT_MS);
        let fileSha: string;
        let currentFileContent: string;
        try {
            const result = await getFoundersFileSha(githubToken, fetchTimeout.signal);
            fileSha = result.sha;
            currentFileContent = result.content;
        } finally {
            fetchTimeout.cleanup();
        }

        const updatedContent = injectFounderEntry(currentFileContent, {
            seat,
            name,
            joinedAt,
            verificationHash,
        });

        // Commit with timeout
        const commitTimeout = createTimeoutSignal(GITHUB_API_TIMEOUT_MS);
        try {
            await commitFounderToGitHub(githubToken, updatedContent, fileSha, { name, seat }, commitTimeout.signal);
        } finally {
            commitTimeout.cleanup();
        }

        console.log(`[activateFounderPass] Founder #${seat} (${name}) successfully committed to repo.`);
    } catch (gitErr) {
        githubCommitPending = true;
        const isTimeout = gitErr instanceof Error && gitErr.name === 'AbortError';
        console.error(
            `[activateFounderPass] GitHub commit failed (non-fatal, timeout=${isTimeout}):`,
            gitErr
        );
        // Queue for manual retry via admin tools
        await getFirestore().collection('founder_github_commit_queue').add({
            seat,
            name,
            joinedAt,
            verificationHash,
            uid: targetUid,
            error: String(gitErr),
            timedOut: isTimeout,
            createdAt: FieldValue.serverTimestamp(),
        }).catch(() => { /* best-effort */ });
    }

    const message = githubCommitPending
        ? `Founder #${seat} activated. The agreement hash is stored in Firestore; the repository commit is pending and will be completed shortly.`
        : `Founder #${seat} activated. The agreement hash has been committed to the indiiOS repository.`;

    return {
        seat,
        verificationHash,
        joinedAt,
        message,
        githubCommitPending,
    };
});
