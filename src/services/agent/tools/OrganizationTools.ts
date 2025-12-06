import { genkit } from 'genkit';
import { z } from 'zod';
import { useStore } from '@/core/store';
import { OrganizationService } from '@/services/OrganizationService';

const ai = genkit({});

export const listOrganizationsTool = ai.defineTool(
    {
        name: 'listOrganizations',
        description: 'Lists all organizations the current user belongs to.',
        inputSchema: z.object({}),
        outputSchema: z.object({
            organizations: z.array(z.object({
                id: z.string(),
                name: z.string(),
                plan: z.string(),
                membersCount: z.number()
            }))
        })
    },
    async () => {
        const store = useStore.getState();
        // Return from store if populated, or fetch? Store is source of truth for UI
        const orgs = store.organizations || [];

        return {
            organizations: orgs.map(org => ({
                id: org.id,
                name: org.name,
                plan: org.plan,
                membersCount: org.members ? org.members.length : 0
            }))
        };
    }
);

export const switchOrganizationTool = ai.defineTool(
    {
        name: 'switchOrganization',
        description: 'Switches the current active organization context.',
        inputSchema: z.object({
            orgId: z.string().describe('The ID of the organization to switch to')
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string()
        })
    },
    async ({ orgId }) => {
        const store = useStore.getState();
        const org = store.organizations.find(o => o.id === orgId);

        if (!org) {
            throw new Error(`Organization with ID ${orgId} not found.`);
        }

        try {
            await OrganizationService.switchOrganization(orgId);
            store.setOrganization(orgId);
            await store.initializeHistory();
            await store.loadProjects();

            return {
                success: true,
                message: `Switched to organization: ${org.name}`
            };
        } catch (e: any) {
            throw new Error(`Failed to switch organization: ${e.message}`);
        }
    }
);

export const createOrganizationTool = ai.defineTool(
    {
        name: 'createOrganization',
        description: 'Creates a new organization.',
        inputSchema: z.object({
            name: z.string().describe('The name of the new organization')
        }),
        outputSchema: z.object({
            orgId: z.string(),
            success: z.boolean()
        })
    },
    async ({ name }) => {
        try {
            const orgId = await OrganizationService.createOrganization(name);
            const store = useStore.getState();

            // We need to refetch or manually update store. 
            // The service creates it, but store might not know immediately unless we call addOrganization
            // Ideally we re-initialize auth or explicitly add it.

            const newOrg = {
                id: orgId,
                name: name,
                plan: 'free' as const,
                members: ['me'] // Simplified, real backend might add actual user ID
            };
            store.addOrganization(newOrg);

            return { orgId, success: true };
        } catch (e: any) {
            throw new Error(`Failed to create organization: ${e.message}`);
        }
    }
);

export const organizationTools = [listOrganizationsTool, switchOrganizationTool, createOrganizationTool];
