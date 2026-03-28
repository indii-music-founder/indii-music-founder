// useStore removed

import { OrganizationService } from '@/services/OrganizationService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

export const OrganizationTools = {
    list_organizations: wrapTool('list_organizations', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        // Phase 3.6: Read state through execution context when available
        const orgs = toolContext
            ? toolContext.get('organizations') || []
            : useStore.getState().organizations || [];

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

    switch_organization: wrapTool('switch_organization', async (args: { orgId: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const organizations = (toolContext
            ? toolContext.get('organizations')
            : store.organizations) || [];

        const org = organizations.find(o => o.id === args.orgId);

        if (!org) {
            return toolError(`Organization with ID ${args.orgId} not found.`, "NOT_FOUND");
        }

        const userProfile = toolContext
            ? toolContext.get('userProfile')
            : store.userProfile;

        const userId = userProfile?.id;
        if (!userId) {
            return toolError("User profile not found. Please log in.", "AUTH_REQUIRED");
        }

        // Mutations still go through store actions
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

    create_organization: wrapTool('create_organization', async (args: { name: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const userProfile = toolContext
            ? toolContext.get('userProfile')
            : store.userProfile;

        const userId = userProfile?.id;
        if (!userId) {
            return toolError("User profile not found. Please log in to create an organization.", "AUTH_REQUIRED");
        }

        const orgId = await OrganizationService.createOrganization(args.name, userId);

        // Manually add to store to reflect immediate change (mutations still go through store)
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

    get_organization_details: wrapTool('get_organization_details', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const organizations = (toolContext
            ? toolContext.get('organizations')
            : useStore.getState().organizations) || [];

        const currentOrganizationId = toolContext
            ? toolContext.get('currentOrganizationId')
            : useStore.getState().currentOrganizationId;

        const org = organizations.find(o => o.id === currentOrganizationId);
        if (!org) {
            return toolError("Current organization not found.", "NOT_FOUND");
        }

        return {
            ...org,
            message: `Details retrieved for ${org.name}.`
        };
    }),

    add_contact: wrapTool('add_contact', async (args: { name: string; email: string; phone?: string; role?: string; company?: string }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to add a contact.");
            }

            const docRef = await addDoc(collection(db, 'users', uid, 'contacts'), {
                ...args,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            return {
                contactId: docRef.id,
                ...args,
                message: `Successfully added contact "${args.name}" to directory.`
            };
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to add contact: ${error.message}`);
        }
    }),

    list_contacts: wrapTool('list_contacts', async (args: { role?: string; company?: string }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to list contacts.");
            }

            let contactsQuery = query(collection(db, 'users', uid, 'contacts'), orderBy('name', 'asc'));
            if (args.role) {
                contactsQuery = query(contactsQuery, where('role', '==', args.role));
            }
            if (args.company) {
                contactsQuery = query(contactsQuery, where('company', '==', args.company));
            }

            const snapshot = await getDocs(contactsQuery);
            const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            return {
                contacts,
                message: `Found ${contacts.length} contacts matching criteria.`
            };
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to list contacts: ${error.message}`);
        }
    }),

    schedule_event: wrapTool('schedule_event', async (args: { title: string; date: string; attendees?: string[]; description?: string }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to schedule an event.");
            }

            const docRef = await addDoc(collection(db, 'users', uid, 'events'), {
                ...args,
                status: 'scheduled',
                createdAt: serverTimestamp()
            });

            return {
                eventId: docRef.id,
                ...args,
                message: `Successfully scheduled event "${args.title}" on ${args.date}.`
            };
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to schedule event: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;
