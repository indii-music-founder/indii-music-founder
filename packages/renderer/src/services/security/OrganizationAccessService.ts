import type {
    OrganizationAccessMatrix,
    OrganizationAccessRow,
    UpdateOrganizationAccessInput,
    OrganizationAccessModule,
} from '@indii/shared';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

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
        logger.debug('[OrganizationAccessService] Loading access matrix.', {
            orgId,
            isFirebaseE2EMockEnabled: isFirebaseE2EMockEnabled(),
        });
        if (isFirebaseE2EMockEnabled()) {
            logger.debug('[OrganizationAccessService] Returning the explicit E2E access matrix.');
            const mockUser = getE2EMockUser<{ uid: string }>();
            if (!mockUser) {
                throw new Error('E2E access matrix requested without an E2E user.');
            }
            return {
                orgId,
                canManage: true,
                viewerUserId: mockUser.uid,
                members: [
                    {
                        userId: mockUser.uid,
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
