
import { where, getDoc, doc, updateDoc } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { db } from './firebase';

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    members: string[]; // List of user IDs
    createdAt: number;
}

class OrganizationServiceImpl extends FirestoreService<Organization> {
    constructor() {
        super('organizations');
    }

    async createOrganization(name: string, userId: string): Promise<string> {
        if (!userId) throw new Error("User ID is required to create an organization");

        const orgData: Omit<Organization, 'id'> = {
            name,
            ownerId: userId,
            members: [userId],
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

    async addUserToOrg(userId: string, orgId: string) {
        // 1. Add user to Org members
        // Using direct references here as this is specific business logic not covered by generic update
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const members = orgData.members || [];
            if (!members.includes(userId)) {
                await updateDoc(orgRef, { members: [...members, userId] });
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

        localStorage.setItem('currentOrgId', orgId);
        return orgId;
    }

    getCurrentOrgId(): string | null {
        return localStorage.getItem('currentOrgId');
    }
}

export const OrganizationService = new OrganizationServiceImpl();
