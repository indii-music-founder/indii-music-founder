import type {
    OrganizationAccessMatrix,
    OrganizationAccessRow,
    UpdateOrganizationAccessInput,
    OrganizationAccessModule,
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

import { isFirebaseE2EMockEnabled, getE2EMockUser } from '@/utils/e2eMode';

class OrganizationAccessServiceImpl {
    async getMatrix(orgId: string): Promise<OrganizationAccessMatrix> {
        console.log('[DEBUG] getMatrix called for org:', orgId, 'isFirebaseE2EMockEnabled:', isFirebaseE2EMockEnabled());
        if (isFirebaseE2EMockEnabled()) {
            console.log('[DEBUG] E2E mode enabled! Returning mock matrix.');
            return {
                orgId,
                canManage: true,
                viewerUserId: getE2EMockUser<any>().uid,
                members: [
                    {
                        userId: getE2EMockUser<any>().uid,
                        displayName: 'E2E Mock User',
                        email: 'test@indii.com',
                        role: 'owner',
                        allowedModules: [
                            'agent', 'analytics', 'audio-analyzer', 'brand', 'campaign', 'creative', 'crm', 'debug', 'devops', 'distribution', 'files', 'finance', 'history', 'knowledge', 'legal', 'licensing', 'marketing', 'marketplace', 'memory', 'merch', 'notes', 'observability', 'publicist', 'publishing', 'registration', 'road', 'screenwriter', 'security', 'social', 'workflow'
                        ] as OrganizationAccessModule[],
                        source: 'owner',
                        updatedAt: new Date().toISOString(),
                    }
                ]
            };
        }

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
