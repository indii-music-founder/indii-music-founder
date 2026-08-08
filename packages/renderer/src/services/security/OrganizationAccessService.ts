import type {
    OrganizationAccessMatrix,
    OrganizationAccessRow,
    UpdateOrganizationAccessInput,
} from '@indii/shared';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';

export type {
    OrganizationAccessMatrix,
    OrganizationAccessModule,
    OrganizationAccessRow,
    OrganizationRole,
    UpdateOrganizationAccessInput,
} from '@indii/shared';

class OrganizationAccessServiceImpl {
    async getMatrix(orgId: string): Promise<OrganizationAccessMatrix> {
        if (!functions) throw new Error('Permission service is unavailable.');
        const callable = httpsCallable<{ orgId: string }, OrganizationAccessMatrix>(
            functions,
            'getOrganizationAccessMatrix',
        );
        const result = await callable({ orgId });
        return result.data;
    }

    async updateMember(input: UpdateOrganizationAccessInput): Promise<OrganizationAccessRow> {
        if (!functions) throw new Error('Permission service is unavailable.');
        const callable = httpsCallable<UpdateOrganizationAccessInput, OrganizationAccessRow>(
            functions,
            'updateOrganizationMemberAccess',
        );
        const result = await callable(input);
        return result.data;
    }
}

export const OrganizationAccessService = new OrganizationAccessServiceImpl();
