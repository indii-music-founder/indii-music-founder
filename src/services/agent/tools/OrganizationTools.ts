import { useStore } from '@/core/store';
import { OrganizationService } from '@/services/OrganizationService';
import { auth } from '@/services/firebase';

export const OrganizationTools = {
    list_organizations: async () => {
        const store = useStore.getState();
        const orgs = store.organizations || [];

        if (orgs.length === 0) {
            return "No organizations found.";
        }

        return orgs.map(org => `- ${org.name} [ID: ${org.id}] (Plan: ${org.plan})`).join('\n');
    },

    switch_organization: async (args: { orgId: string }) => {
        const store = useStore.getState();
        const org = store.organizations.find(o => o.id === args.orgId);

        if (!org) {
            return `Error: Organization with ID ${args.orgId} not found.`;
        }

        try {
            await OrganizationService.switchOrganization(args.orgId);
            // The service updates localStorage, but we might need to trigger store update if not reactive
            // store.setOrganization is not always enough if it needs full reload
            store.setOrganization(args.orgId);

            // Reload projects for new org
            await store.loadProjects();

            return `Successfully switched to organization: ${org.name}`;
        } catch (e: any) {
            return `Failed to switch organization: ${e.message}`;
        }
    },

    create_organization: async (args: { name: string }) => {
        try {
            const orgId = await OrganizationService.createOrganization(args.name);
            const store = useStore.getState();

            // Manually add to store to reflect immediate change
            const newOrg = {
                id: orgId,
                name: args.name,
                plan: 'free' as const,
                members: [auth.currentUser?.uid || 'me']
            };
            store.addOrganization(newOrg);
            store.setOrganization(orgId);

            return `Successfully created organization "${args.name}" (ID: ${orgId}) and switched to it.`;
        } catch (e: any) {
            return `Failed to create organization: ${e.message}`;
        }
    },

    get_organization_details: async () => {
        const store = useStore.getState();
        const org = store.organizations.find(o => o.id === store.currentOrganizationId);
        if (!org) return "Current organization not found.";

        return `
        ID: ${org.id}
        Name: ${org.name}
        Plan: ${org.plan}
        Members: ${org.members?.length || 0}
        `;
    }
};
