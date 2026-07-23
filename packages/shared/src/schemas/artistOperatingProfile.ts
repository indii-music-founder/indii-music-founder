import { z } from 'zod';

/**
 * Artist Operating Profile (AOP) — ISSUE-1172 (re-ticketed from ISSUE-1115).
 *
 * A first-class, per-artist record of the preferences, boundaries, and
 * permissions that govern autonomous execution decisions. Today that
 * information is scattered: static tool config in ToolRiskRegistry.ts,
 * per-directive compute allocation in DigitalHandshake.ts, no per-user
 * record of e.g. "has this artist opted into autonomous computer control."
 *
 * First real consumer: BaseAgent.ts's tool-dispatch loop gates
 * requiresApproval:true `computer_*` tools on
 * `permissions.autonomousComputerControl` before even queuing an approval —
 * an artist who never opted in doesn't get prompted at all.
 *
 * Storage: single doc at users/{uid}/aop/profile.
 */

const TrimmedLine = z.string().trim().min(1).max(280);

export const ArtistOperatingProfilePermissionsSchema = z.object({
    /** Gates all `computer_*` tools with requiresApproval:true (BaseAgent.ts dispatch gate). */
    autonomousComputerControl: z.boolean().default(false),
    /** Gates destructive-tier tools generally, independent of the approval-queue flow. */
    allowDestructiveTools: z.boolean().default(false),
    /** Tool names explicitly allowed to bypass the approval queue once approved once. Empty by default — opt-in only. */
    preApprovedToolNames: z.array(z.string().trim().min(1).max(128)).max(50).default([]),
}).strict();

export const ArtistOperatingProfileSchema = z.object({
    schemaVersion: z.literal('artist-operating-profile.v1'),
    /** Free-text business goals informing autonomous decisions (e.g. "grow email list before next release"). */
    businessGoals: z.array(TrimmedLine).max(20).default([]),
    /** Boundaries the artist wants respected (e.g. "never post without review", "no AI voice cloning"). */
    creativeBoundaries: z.array(TrimmedLine).max(20).default([]),
    /** Software known to be installed on this artist's machine — informs whether an automation is even possible. */
    installedSoftware: z.array(TrimmedLine).max(50).default([]),
    /** Connected services already tracked elsewhere (ConnectionsSection) are NOT duplicated here — reference by id only if a decision depends on it. */
    connectedServiceIds: z.array(z.string().trim().min(1).max(128)).max(50).default([]),
    permissions: ArtistOperatingProfilePermissionsSchema.default({
        autonomousComputerControl: false,
        allowDestructiveTools: false,
        preApprovedToolNames: [],
    }),
    updatedAt: z.string().datetime().optional(),
}).strict();

export type ArtistOperatingProfilePermissions = z.infer<typeof ArtistOperatingProfilePermissionsSchema>;
export type ArtistOperatingProfile = z.infer<typeof ArtistOperatingProfileSchema>;

export const DEFAULT_ARTIST_OPERATING_PROFILE: ArtistOperatingProfile = {
    schemaVersion: 'artist-operating-profile.v1',
    businessGoals: [],
    creativeBoundaries: [],
    installedSoftware: [],
    connectedServiceIds: [],
    permissions: {
        autonomousComputerControl: false,
        allowDestructiveTools: false,
        preApprovedToolNames: [],
    },
};

/**
 * Fail-closed permission check: an artist who has never created an AOP doc
 * (profile === null) has NOT opted into autonomous computer control.
 */
export function hasAutonomousComputerControl(profile: ArtistOperatingProfile | null | undefined): boolean {
    return profile?.permissions?.autonomousComputerControl === true;
}
