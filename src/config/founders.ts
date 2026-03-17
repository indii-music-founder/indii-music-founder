/**
 * FOUNDERS COVENANT
 * indiiOS LLC — chartered 2024
 *
 * This file is a permanent, append-only record of indiiOS founding members.
 * It is committed to the git repository as cryptographic proof of covenant.
 *
 * Governance rules (enforced by IndiiOS LLC):
 *   1. Entries are APPEND-ONLY. Existing entries must never be modified or removed.
 *   2. The COVENANT_TERMS below represent binding commitments to every founder listed.
 *   3. Removal of any entry constitutes a material breach of the founder agreement.
 *   4. The covenantHash for each entry is SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}")
 *      and serves as the founder's receipt. It can be independently verified.
 *
 * Verification:
 *   import crypto from 'crypto';
 *   const hash = crypto.createHash('sha256')
 *     .update(`${name}|${COVENANT_VERSION}|${joinedAt}`)
 *     .digest('hex');
 *   // hash must equal covenantHash in this file for the record to be valid.
 */

export const COVENANT_VERSION = '1.0.0';

/**
 * The exact terms promised to every founder.
 * This object is the source of truth for founder benefits.
 */
export const COVENANT_TERMS = {
  price_usd: 2500,
  payment_type: 'one_time' as const,
  seats_total: 10,
  access: 'lifetime' as const,
  // API costs (Gemini, Vertex AI, etc.) are billed separately at
  // pass-through cost — no markup. Founders are responsible for
  // their own consumption. This will be invoiced monthly once
  // the API cost pass-through billing system is finalized.
  // See: docs/FOUNDERS_PLAN.md — "Open Questions: API cost pass-through"
  api_costs: 'pass_through_at_cost' as const,
  features: 'all_current_and_future' as const,
  name_in_code: true,
  software_lifetime: true,
  indiiOS_entity: 'IndiiOS LLC',
  covenant_established: '2026-03-17',
} as const;

/**
 * A single founder record.
 * All fields are set at the time of joining and never modified.
 */
export interface FounderRecord {
  /** Permanent seat number 1–10 */
  seat: number;
  /** Public display name or handle chosen by the founder */
  name: string;
  /** ISO 8601 UTC timestamp of when the founder joined */
  joinedAt: string;
  /** SHA-256("{name}|{COVENANT_VERSION}|{joinedAt}") — the founder's receipt */
  covenantHash: string;
  /** Firestore UID of the founder's account (for internal verification) */
  uid: string;
}

/**
 * THE FOUNDERS
 *
 * Seats 1–10. Each entry below represents a permanent covenant between
 * IndiiOS LLC and the named individual. This array is the on-chain record.
 *
 * New entries are appended automatically by the activateFounderPass
 * Cloud Function via the GitHub API upon confirmed payment.
 */
export const FOUNDERS: FounderRecord[] = [
  // ── Founder entries are appended here automatically ──
  // Example structure (do not modify existing entries):
  // {
  //   seat: 1,
  //   name: 'Artist Name',
  //   joinedAt: '2026-03-17T00:00:00.000Z',
  //   covenantHash: 'abc123...',
  //   uid: 'firebase-uid',
  // },
];

/** Number of remaining founder seats (0–10) */
export const FOUNDERS_SEATS_REMAINING: number =
  COVENANT_TERMS.seats_total - FOUNDERS.length;

/** Whether the founders program is still open */
export const FOUNDERS_PROGRAM_OPEN: boolean = FOUNDERS_SEATS_REMAINING > 0;
