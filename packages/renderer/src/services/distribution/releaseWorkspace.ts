/**
 * Which workspace a release belongs to, and how to read a workspace's
 * releases under the Firestore rules (ISSUE-1695 / ISSUE-1696).
 *
 * A solo artist has no organization document: the store keeps the
 * pre-resolution placeholder `'org-default'` and an empty `organizations`
 * list. That is the personal workspace. Its releases are stored with
 * `orgId: 'personal'` (allowed by `clientIdentityFieldsMatchCaller`) and must be
 * read by `userId`, because the rules cannot prove membership of a
 * placeholder org and reject an `orgId`-only query outright.
 */
import { where, type QueryFieldFilterConstraint } from 'firebase/firestore';

export const PERSONAL_WORKSPACE_ORG_ID = 'personal';

/** Ids the app uses for "no organization": the store placeholder and the canonical personal scope. */
const PERSONAL_WORKSPACE_ALIASES: ReadonlySet<string> = new Set(['org-default', PERSONAL_WORKSPACE_ORG_ID]);

export type ReleaseWorkspace =
    | { kind: 'personal'; orgId: typeof PERSONAL_WORKSPACE_ORG_ID; userId: string }
    | { kind: 'organization'; orgId: string; userId: string };

export interface ReleaseWorkspaceInput {
    currentOrganizationId: string | null | undefined;
    organizations: ReadonlyArray<{ id: string }>;
    userId: string | null | undefined;
}

/**
 * Returns null when there is no signed-in user, or when the selected id names
 * an organization that is not loaded for this user (membership unproven), so
 * callers can refuse with a clear message instead of guessing a scope.
 */
export function resolveReleaseWorkspace({ currentOrganizationId, organizations, userId }: ReleaseWorkspaceInput): ReleaseWorkspace | null {
    const uid = userId?.trim();
    if (!uid) return null;
    const orgId = currentOrganizationId?.trim();
    if (orgId && organizations.some(org => org.id === orgId)) {
        return { kind: 'organization', orgId, userId: uid };
    }
    if (!orgId || PERSONAL_WORKSPACE_ALIASES.has(orgId) || orgId === uid) {
        return { kind: 'personal', orgId: PERSONAL_WORKSPACE_ORG_ID, userId: uid };
    }
    return null;
}

/** The one filter that lets the rules prove every returned release is readable. */
export function releaseWorkspaceFilter(workspace: ReleaseWorkspace): QueryFieldFilterConstraint {
    return workspace.kind === 'personal'
        ? where('userId', '==', workspace.userId)
        : where('orgId', '==', workspace.orgId);
}
