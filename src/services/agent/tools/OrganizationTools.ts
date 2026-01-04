import { useStore } from '@/core/store';
import { OrganizationService } from '@/services/OrganizationService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const OrganizationTools: Record<string, AnyToolFunction> = {
    list_organizations: wrapTool('list_organizations', async () => {
        const store = useStore.getState();
        const orgs = store.organizations || [];

        if (orgs.length === 0) {
            return {
                message: "No organizations found.",
                orgs: []
            };
        }

        return {
            orgs,
            message: `Found ${orgs.length} organizations.`
        };
    }),

    switch_organization: wrapTool('switch_organization', async (args: { orgId: string }) => {
        const store = useStore.getState();
        const org = store.organizations.find(o => o.id === args.orgId);

        if (!org) {
            return toolError(`Organization with ID ${args.orgId} not found.`, "NOT_FOUND");
        }

        const userId = store.userProfile?.id;
        if (!userId) {
            return toolError("User profile not found. Please log in.", "AUTH_REQUIRED");
        }

        await OrganizationService.switchOrganization(args.orgId, userId);
        store.setOrganization(args.orgId);

        // Reload projects for new org
        await store.loadProjects();

        return {
            orgId: args.orgId,
            orgName: org.name,
            message: `Successfully switched to organization: ${org.name}`
        };
    }),

    create_organization: wrapTool('create_organization', async (args: { name: string }) => {
        const store = useStore.getState();
        const userId = store.userProfile?.id;
        if (!userId) {
            return toolError("User profile not found. Please log in to create an organization.", "AUTH_REQUIRED");
        }

        const orgId = await OrganizationService.createOrganization(args.name, userId);

        // Manually add to store to reflect immediate change
        const newOrg = {
            id: orgId,
            name: args.name,
            plan: 'free' as const,
            members: [userId]
        };
        store.addOrganization(newOrg);
        store.setOrganization(orgId);

        return {
            orgId,
            orgName: args.name,
            message: `Successfully created organization "${args.name}" (ID: ${orgId}) and switched to it.`
        };
    }),

    get_organization_details: wrapTool('get_organization_details', async () => {
        const store = useStore.getState();
        const org = store.organizations.find(o => o.id === store.currentOrganizationId);
        if (!org) {
            return toolError("Current organization not found.", "NOT_FOUND");
        }

        return {
            ...org,
            message: `Details retrieved for ${org.name}.`
        };
    })
};
