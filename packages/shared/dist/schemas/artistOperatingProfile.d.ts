import { z } from 'zod';
export declare const ArtistOperatingProfilePermissionsSchema: z.ZodObject<{
    /** Gates all `computer_*` tools with requiresApproval:true (BaseAgent.ts dispatch gate). */
    autonomousComputerControl: z.ZodDefault<z.ZodBoolean>;
    /** Gates destructive-tier tools generally, independent of the approval-queue flow. */
    allowDestructiveTools: z.ZodDefault<z.ZodBoolean>;
    /** Tool names explicitly allowed to bypass the approval queue once approved once. Empty by default — opt-in only. */
    preApprovedToolNames: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    autonomousComputerControl: boolean;
    allowDestructiveTools: boolean;
    preApprovedToolNames: string[];
}, {
    autonomousComputerControl?: boolean | undefined;
    allowDestructiveTools?: boolean | undefined;
    preApprovedToolNames?: string[] | undefined;
}>;
export declare const ArtistOperatingProfileSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"artist-operating-profile.v1">;
    /** Free-text business goals informing autonomous decisions (e.g. "grow email list before next release"). */
    businessGoals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Boundaries the artist wants respected (e.g. "never post without review", "no AI voice cloning"). */
    creativeBoundaries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Software known to be installed on this artist's machine — informs whether an automation is even possible. */
    installedSoftware: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Connected services already tracked elsewhere (ConnectionsSection) are NOT duplicated here — reference by id only if a decision depends on it. */
    connectedServiceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    permissions: z.ZodDefault<z.ZodObject<{
        /** Gates all `computer_*` tools with requiresApproval:true (BaseAgent.ts dispatch gate). */
        autonomousComputerControl: z.ZodDefault<z.ZodBoolean>;
        /** Gates destructive-tier tools generally, independent of the approval-queue flow. */
        allowDestructiveTools: z.ZodDefault<z.ZodBoolean>;
        /** Tool names explicitly allowed to bypass the approval queue once approved once. Empty by default — opt-in only. */
        preApprovedToolNames: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        autonomousComputerControl: boolean;
        allowDestructiveTools: boolean;
        preApprovedToolNames: string[];
    }, {
        autonomousComputerControl?: boolean | undefined;
        allowDestructiveTools?: boolean | undefined;
        preApprovedToolNames?: string[] | undefined;
    }>>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    schemaVersion: "artist-operating-profile.v1";
    businessGoals: string[];
    creativeBoundaries: string[];
    installedSoftware: string[];
    connectedServiceIds: string[];
    permissions: {
        autonomousComputerControl: boolean;
        allowDestructiveTools: boolean;
        preApprovedToolNames: string[];
    };
    updatedAt?: string | undefined;
}, {
    schemaVersion: "artist-operating-profile.v1";
    updatedAt?: string | undefined;
    businessGoals?: string[] | undefined;
    creativeBoundaries?: string[] | undefined;
    installedSoftware?: string[] | undefined;
    connectedServiceIds?: string[] | undefined;
    permissions?: {
        autonomousComputerControl?: boolean | undefined;
        allowDestructiveTools?: boolean | undefined;
        preApprovedToolNames?: string[] | undefined;
    } | undefined;
}>;
export type ArtistOperatingProfilePermissions = z.infer<typeof ArtistOperatingProfilePermissionsSchema>;
export type ArtistOperatingProfile = z.infer<typeof ArtistOperatingProfileSchema>;
export declare const DEFAULT_ARTIST_OPERATING_PROFILE: ArtistOperatingProfile;
/**
 * Fail-closed permission check: an artist who has never created an AOP doc
 * (profile === null) has NOT opted into autonomous computer control.
 */
export declare function hasAutonomousComputerControl(profile: ArtistOperatingProfile | null | undefined): boolean;
//# sourceMappingURL=artistOperatingProfile.d.ts.map