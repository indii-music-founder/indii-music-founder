import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
    where: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
}));

import { releaseWorkspaceFilter, resolveReleaseWorkspace } from './releaseWorkspace';

describe('resolveReleaseWorkspace (ISSUE-1696)', () => {
    it('treats the placeholder, the personal id, the uid and no selection as the personal workspace', () => {
        for (const currentOrganizationId of ['org-default', 'personal', 'user-1', '', null, undefined]) {
            expect(resolveReleaseWorkspace({ currentOrganizationId, organizations: [], userId: 'user-1' }))
                .toEqual({ kind: 'personal', orgId: 'personal', userId: 'user-1' });
        }
    });

    it('uses a loaded organization the user belongs to', () => {
        expect(resolveReleaseWorkspace({ currentOrganizationId: 'org-7', organizations: [{ id: 'org-7' }], userId: 'user-1' }))
            .toEqual({ kind: 'organization', orgId: 'org-7', userId: 'user-1' });
    });

    it('refuses an organization that is not loaded, and a missing user', () => {
        expect(resolveReleaseWorkspace({ currentOrganizationId: 'org-7', organizations: [{ id: 'org-8' }], userId: 'user-1' })).toBeNull();
        expect(resolveReleaseWorkspace({ currentOrganizationId: 'org-default', organizations: [], userId: '  ' })).toBeNull();
    });
});

describe('releaseWorkspaceFilter (ISSUE-1695)', () => {
    it('reads personal releases by owner and organization releases by orgId', () => {
        expect(releaseWorkspaceFilter({ kind: 'personal', orgId: 'personal', userId: 'user-1' })).toEqual({ field: 'userId', op: '==', value: 'user-1' });
        expect(releaseWorkspaceFilter({ kind: 'organization', orgId: 'org-7', userId: 'user-1' })).toEqual({ field: 'orgId', op: '==', value: 'org-7' });
    });
});
