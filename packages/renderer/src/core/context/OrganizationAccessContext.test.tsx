import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    state: {
        user: { uid: 'member-1' },
        currentOrganizationId: 'org-1',
        organizations: [{
            id: 'org-1',
            name: 'Studio',
            plan: 'free',
            members: ['member-1'],
            ownerId: 'owner-1',
        }],
    },
    getMatrix: vi.fn(),
    updateMember: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock('@/services/security/OrganizationAccessService', () => ({
    OrganizationAccessService: {
        getMatrix: mocks.getMatrix,
        updateMember: mocks.updateMember,
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn() },
}));

import {
    OrganizationAccessProvider,
    useOrganizationAccess,
} from './OrganizationAccessContext';

const wrapper = ({ children }: { children: ReactNode }) => (
    <OrganizationAccessProvider>{children}</OrganizationAccessProvider>
);

describe('OrganizationAccessProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getMatrix.mockResolvedValue({
            orgId: 'org-1',
            canManage: false,
            viewerUserId: 'member-1',
            members: [{
                userId: 'member-1',
                displayName: 'Member',
                email: null,
                role: 'member',
                allowedModules: ['files', 'notes'],
                source: 'explicit',
                updatedAt: null,
            }],
        });
    });

    it('allows only server-returned controlled modules for the active organization', async () => {
        const { result } = renderHook(() => useOrganizationAccess(), { wrapper });
        await waitFor(() => expect(result.current.status).toBe('ready'));

        expect(result.current.canAccessModule('dashboard')).toBe(true);
        expect(result.current.canAccessModule('files')).toBe(true);
        expect(result.current.canAccessModule('finance')).toBe(false);
        expect(mocks.getMatrix).toHaveBeenCalledWith('org-1');
    });

    it('fails closed for controlled modules when verification fails and retries explicitly', async () => {
        mocks.getMatrix.mockRejectedValueOnce(new Error('permission service offline'));
        const { result } = renderHook(() => useOrganizationAccess(), { wrapper });
        await waitFor(() => expect(result.current.status).toBe('error'));

        expect(result.current.canAccessModule('files')).toBe(false);
        expect(result.current.canAccessModule('dashboard')).toBe(true);

        mocks.getMatrix.mockResolvedValueOnce({
            orgId: 'org-1',
            canManage: false,
            viewerUserId: 'member-1',
            members: [{
                userId: 'member-1',
                displayName: null,
                email: null,
                role: 'member',
                allowedModules: ['files'],
                source: 'explicit',
                updatedAt: null,
            }],
        });
        await act(async () => result.current.refresh());
        expect(result.current.status).toBe('ready');
        expect(result.current.canAccessModule('files')).toBe(true);
    });
});
