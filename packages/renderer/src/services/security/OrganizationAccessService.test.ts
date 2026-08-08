import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    functions: { region: 'us-central1' },
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

import { OrganizationAccessService } from './OrganizationAccessService';

describe('OrganizationAccessService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.httpsCallable.mockReturnValue(mocks.callable);
    });

    it('loads the server-attested organization matrix', async () => {
        const matrix = {
            orgId: 'org-1',
            canManage: false,
            viewerUserId: 'member-1',
            members: [{
                userId: 'member-1',
                displayName: 'Member',
                email: null,
                role: 'member',
                allowedModules: ['files'],
                source: 'explicit',
                updatedAt: null,
            }],
        };
        mocks.callable.mockResolvedValue({ data: matrix });

        await expect(OrganizationAccessService.getMatrix('org-1')).resolves.toEqual(matrix);
        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            { region: 'us-central1' },
            'getOrganizationAccessMatrix',
        );
        expect(mocks.callable).toHaveBeenCalledWith({ orgId: 'org-1' });
    });

    it('sends only the selected member policy to the protected update callable', async () => {
        const row = {
            userId: 'member-1',
            displayName: 'Member',
            email: null,
            role: 'producer',
            allowedModules: ['creative', 'files'],
            source: 'explicit',
            updatedAt: '2026-08-08T13:00:00.000Z',
        };
        mocks.callable.mockResolvedValue({ data: row });

        await expect(OrganizationAccessService.updateMember({
            orgId: 'org-1',
            targetUserId: 'member-1',
            role: 'producer',
            allowedModules: ['creative', 'files'],
        })).resolves.toEqual(row);
        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            { region: 'us-central1' },
            'updateOrganizationMemberAccess',
        );
        expect(mocks.callable).toHaveBeenCalledWith({
            orgId: 'org-1',
            targetUserId: 'member-1',
            role: 'producer',
            allowedModules: ['creative', 'files'],
        });
    });
});
