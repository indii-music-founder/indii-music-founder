import { db, auth } from './firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    members: string[]; // List of user IDs
    createdAt: number;
}

export const OrganizationService = {
    async createOrganization(name: string): Promise<string> {
        const user = auth.currentUser;
        if (!user) throw new Error("User must be logged in to create an organization");

        const orgData: Omit<Organization, 'id'> = {
            name,
            ownerId: user.uid,
            members: [user.uid],
            createdAt: Date.now()
        };

        const docRef = await addDoc(collection(db, 'organizations'), orgData);

        // Also update the user's profile to include this org
        await this.addUserToOrg(user.uid, docRef.id);

        return docRef.id;
    },

    async getOrganization(orgId: string): Promise<Organization | null> {
        const docRef = doc(db, 'organizations', orgId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Organization;
        } else {
            return null;
        }
    },

    async getUserOrganizations(userId: string): Promise<Organization[]> {
        // This assumes we have a way to query orgs by member. 
        // For scalability, we should store orgIds on the user document, but for now query is okay if array-contains is used.
        const q = query(collection(db, 'organizations'), where('members', 'array-contains', userId));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
    },

    async addUserToOrg(userId: string, orgId: string) {
        // 1. Add user to Org members
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const members = orgData.members || [];
            if (!members.includes(userId)) {
                await updateDoc(orgRef, { members: [...members, userId] });
            }
        }

        // 2. Add Org to User's list (Optional but recommended for fast lookup)
        // We'll skip this for now to keep it simple and rely on the 'members' array query
    },

    async switchOrganization(orgId: string) {
        // In a real app, this would update a local state or user preference
        localStorage.setItem('currentOrgId', orgId);
        return orgId;
    },

    getCurrentOrgId(): string | null {
        return localStorage.getItem('currentOrgId');
    }
};
