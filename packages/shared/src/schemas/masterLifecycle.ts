import { z } from 'zod';

/**
 * Canonical master-recording lifecycle state machine (Post-Mastering
 * Administrative Engine, P1; docs/plans/post-mastering-admin-engine-plan-2026-09-26.md §1.1).
 *
 * The happy-path spine is the mission contract:
 *   DRAFT → INGESTED → METADATA_AUDITED → SPLITS_PENDING → ADMIN_LOCKED → DISTRIBUTION_READY
 * `ADMIN_BLOCKED` and `TAKEN_DOWN` are terminal-adjacent exception side-states —
 * they are never on the spine and every exit from them is explicit below.
 *
 * Transitions are performed ONLY by Cloud Functions through the transactional
 * FSM guard (`packages/firebase/src/functions/audit/masterFsm.ts`) which uses
 * MASTER_LIFECYCLE_EDGES as the single legal-edge table. Firestore rules make
 * `users/{uid}/master_admin` read-only for clients, so no other writer exists.
 */

export const MASTER_LIFECYCLE_STATUSES = [
    'DRAFT',
    'INGESTED',
    'METADATA_AUDITED',
    'SPLITS_PENDING',
    'ADMIN_LOCKED',
    'DISTRIBUTION_READY',
    'ADMIN_BLOCKED',
    'TAKEN_DOWN',
] as const;

export const MasterLifecycleStatusSchema = z.enum(MASTER_LIFECYCLE_STATUSES);
export type MasterLifecycleStatus = (typeof MASTER_LIFECYCLE_STATUSES)[number];

/** The ONLY legal edges. Anything not listed here is a corrupting write. */
export const MASTER_LIFECYCLE_EDGES: Readonly<
    Record<MasterLifecycleStatus, readonly MasterLifecycleStatus[]>
> = {
    DRAFT: ['INGESTED'],
    INGESTED: ['METADATA_AUDITED', 'ADMIN_BLOCKED'],
    METADATA_AUDITED: ['SPLITS_PENDING', 'ADMIN_BLOCKED'],
    SPLITS_PENDING: ['ADMIN_LOCKED', 'ADMIN_BLOCKED'],
    ADMIN_LOCKED: ['DISTRIBUTION_READY'],
    DISTRIBUTION_READY: ['TAKEN_DOWN'],
    ADMIN_BLOCKED: ['METADATA_AUDITED', 'SPLITS_PENDING', 'TAKEN_DOWN'],
    TAKEN_DOWN: [],
};

export function isMasterLifecycleStatus(value: unknown): value is MasterLifecycleStatus {
    return MasterLifecycleStatusSchema.safeParse(value).success;
}

/** True only when `from → to` is a legal edge. */
export function canTransitionMasterLifecycle(
    from: MasterLifecycleStatus,
    to: MasterLifecycleStatus,
): boolean {
    return MASTER_LIFECYCLE_EDGES[from].includes(to);
}

/** Throws on an illegal transition — for transactional guards that fail loud. */
export function assertMasterLifecycleTransition(
    from: MasterLifecycleStatus,
    to: MasterLifecycleStatus,
): void {
    if (!canTransitionMasterLifecycle(from, to)) {
        throw new Error(
            `Illegal master lifecycle transition ${from} → ${to}. ` +
                `Legal exits: [${MASTER_LIFECYCLE_EDGES[from].join(', ') || 'none'}]`,
        );
    }
}

// ---------------------------------------------------------------------------
// Durable state document — `users/{uid}/master_admin/{masterHash}`
// ---------------------------------------------------------------------------

export const LIFECYCLE_ACTORS = ['runbook', 'audit', 'user'] as const;
export const LifecycleActorSchema = z.enum(LIFECYCLE_ACTORS);
export type LifecycleActor = (typeof LIFECYCLE_ACTORS)[number];

export const LifecycleTransitionSchema = z
    .object({
        from: MasterLifecycleStatusSchema,
        to: MasterLifecycleStatusSchema,
        /** ISO-8601 instant (Firestore stores the equivalent Timestamp). */
        at: z.string().datetime(),
        actor: LifecycleActorSchema,
        reason: z.string().max(500).optional(),
    })
    .strict();
export type LifecycleTransition = z.infer<typeof LifecycleTransitionSchema>;

export const MASTER_ADMIN_STATE_SCHEMA_VERSION = 'master-admin-state.v1';

export const MasterAdminStateSchema = z
    .object({
        /** Document id — the master content hash (sha256, hex). Predictable key. */
        id: z
            .string()
            .regex(/^[0-9a-f]{16,64}$/),
        userId: z.string().min(1).max(128),
        schemaVersion: z.literal(MASTER_ADMIN_STATE_SCHEMA_VERSION),
        masterHash: z
            .string()
            .regex(/^[0-9a-f]{16,64}$/),
        /** Storage object path: masters/{uid}/{hash}/original.{ext} */
        storagePath: z.string().min(1).max(1024),
        /**
         * Storage generation this state was computed from (stale-state guard).
         * Digit STRING on purpose: GCS generations are uint64 and exceed
         * Number.MAX_SAFE_INTEGER (same contract as ApprovalReceipt.sourceGeneration).
         */
        generation: z.string().regex(/^\d{1,20}$/),
        lifecycle: MasterLifecycleStatusSchema,
        enteredAt: z.string().datetime(),
        history: z.array(LifecycleTransitionSchema).max(200),
        openTaskIds: z.array(z.string().min(1).max(160)).max(500),
        /** Set when lifecycle reaches ADMIN_LOCKED (content-addressed receipt id). */
        ledgerReceiptId: z.string().regex(/^[0-9a-zA-Z_.-]{1,128}$/).optional(),
        /** Set when lifecycle reaches DISTRIBUTION_READY (ERN digest reference). */
        distributionReadyRef: z.string().min(1).max(256).optional(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .strict()
    .superRefine((state, ctx) => {
        if (state.id !== state.masterHash) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['id'],
                message: 'Document id must equal the master content hash.',
            });
        }
        if (state.history.length === 0) {
            if (state.lifecycle !== 'DRAFT') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['history'],
                    message: 'A non-DRAFT state must carry at least one transition in history.',
                });
            }
            return;
        }
        // History chain integrity: entries must connect and land on `lifecycle`.
        let cursor = state.history[0]!.from;
        for (const [index, entry] of state.history.entries()) {
            if (entry.from !== cursor) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['history', index, 'from'],
                    message: `History chain broken at entry ${index}: expected from=${cursor}.`,
                });
                return;
            }
            cursor = entry.to;
        }
        if (cursor !== state.lifecycle) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['lifecycle'],
                message: `history ends at ${cursor} but lifecycle is ${state.lifecycle}.`,
            });
        }
    });

export type MasterAdminState = z.infer<typeof MasterAdminStateSchema>;
