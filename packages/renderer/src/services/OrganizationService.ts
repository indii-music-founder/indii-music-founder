/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */

import { where, getDoc, doc, updateDoc } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { db } from './firebase';

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    members: string[]; // List of user IDs
    memberRoles?: Record<string, 'owner' | 'manager' | 'producer' | 'member'>; // userId -> role mapping
    createdAt: number;
}

class OrganizationServiceImpl extends FirestoreService<Organization> {
    private useStore: any = null;

    constructor() {
        super('organizations');
    }

    /**
     * Get the current active organization ID for the user.
     * Synchronous access for filters and path generation.
     */
    getCurrentOrgId(): string | null {
        // Attempt to get from store if initialized
        try {
            // Static reference to avoid circular deps if possible
            if (!this.useStore) {
                // We don't import at top level to avoid cycles during init
                return null;
            }
            return this.useStore.getState().currentOrganizationId || 'personal';
        } catch (_e: unknown) {
            return 'personal';
        }
    }

    /**
     * Set the store reference once initialized.
     */
    setStore(store: any) {
        this.useStore = store;
    }

    async createOrganization(name: string, userId: string): Promise<string> {
        if (!userId) throw new Error("User ID is required to create an organization");

        const orgData: Omit<Organization, 'id'> = {
            name,
            ownerId: userId,
            members: [userId],
            memberRoles: { [userId]: 'owner' },
            createdAt: Date.now()
        };

        const id = await this.add(orgData);

        // Also update the user's profile to include this org (legacy requirement)
        await this.addUserToOrg(userId, id);

        return id;
    }

    // getOrganization(id) is already provided by super.get(id) 
    // but we can alias it if preferred, or just let consumers use .get()
    // To match existing API exactly:
    async getOrganization(orgId: string): Promise<Organization | null> {
        return this.get(orgId);
    }

    async getUserOrganizations(userId: string): Promise<Organization[]> {
        return this.list([where('members', 'array-contains', userId)]);
    }

    async addUserToOrg(userId: string, orgId: string, role: 'owner' | 'manager' | 'producer' | 'member' = 'member') {
        // 1. Add user to Org members
        // Using direct references here as this is specific business logic not covered by generic update
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const members = orgData.members || [];
            const memberRoles = orgData.memberRoles || {};
            
            const updates: Record<string, any> = {};
            if (!members.includes(userId)) {
                updates.members = [...members, userId];
            }
            if (memberRoles[userId] !== role) {
                updates[`memberRoles.${userId}`] = role;
            }
            
            if (Object.keys(updates).length > 0) {
                await updateDoc(orgRef, updates);
            }
        }
    }

    async switchOrganization(orgId: string, userId: string): Promise<string> {
        if (!userId) {
            throw new Error('User ID required to switch organizations');
        }

        // Validate user is a member of the target organization
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (!orgDoc.exists()) {
            throw new Error(`Organization ${orgId} not found`);
        }

        const members = orgDoc.data()?.members || [];
        if (!members.includes(userId)) {
            throw new Error(`You are not a member of this organization`);
        }

        // Update the user's Firestore document
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { currentOrganizationId: orgId });

        return orgId;
    }

    async inviteMember(orgId: string, email: string, role: 'manager' | 'producer' | 'member'): Promise<string> {
        // Mock invitation logic - in reality this would create an invite doc and trigger an email
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (!orgSnap.exists()) {
            throw new Error(`Organization ${orgId} not found`);
        }

        console.log(`[OrganizationService] Mock inviting ${email} to ${orgId} as ${role}`);
        // Return a mock invitation ID
        return `inv_${Date.now()}`;
    }

    async updateMemberRole(orgId: string, userId: string, role: 'manager' | 'producer' | 'member'): Promise<void> {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (!orgSnap.exists()) {
            throw new Error(`Organization ${orgId} not found`);
        }

        const orgData = orgSnap.data() as Organization;
        if (!orgData.members.includes(userId)) {
            throw new Error(`User ${userId} is not a member of organization ${orgId}`);
        }
        
        if (orgData.ownerId === userId) {
            throw new Error(`Cannot change role of organization owner`);
        }

        await updateDoc(orgRef, {
            [`memberRoles.${userId}`]: role
        });
    }

    async removeMember(orgId: string, userId: string): Promise<void> {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (!orgSnap.exists()) {
            throw new Error(`Organization ${orgId} not found`);
        }

        const orgData = orgSnap.data() as Organization;
        if (orgData.ownerId === userId) {
            throw new Error(`Cannot remove the organization owner. Transfer ownership first.`);
        }

        const members = orgData.members || [];
        const newMembers = members.filter(id => id !== userId);

        const updates: Record<string, any> = {
            members: newMembers
        };
        
        // Use dot notation to remove from map by setting to null or using deleteField
        // Since we don't have deleteField imported, we can just replace the whole map
        if (orgData.memberRoles) {
            const newRoles = { ...orgData.memberRoles };
            delete newRoles[userId];
            updates.memberRoles = newRoles;
        }

        await updateDoc(orgRef, updates);
    }
}

export const OrganizationService = new OrganizationServiceImpl();
