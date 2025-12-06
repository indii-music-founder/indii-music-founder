import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { Project } from '@/core/store/slices/appSlice';
import { OrganizationService } from './OrganizationService';

export const ProjectService = {
    async getProjectsForOrg(orgId: string): Promise<Project[]> {
        try {
            const q = query(collection(db, 'projects'), where('orgId', '==', orgId));
            const querySnapshot = await getDocs(q);
            const projects = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Project));

            // Client-side sort to avoid composite index requirement
            return projects.sort((a, b) => b.date - a.date);
        } catch (e) {
            console.error("Error loading projects:", e);
            return [];
        }
    },

    async createProject(name: string, type: Project['type'], orgId: string): Promise<Project> {
        if (!orgId) throw new Error("No organization selected");

        const newProject: Omit<Project, 'id'> = {
            name,
            type,
            date: Date.now(),
            orgId
        };

        const docRef = await addDoc(collection(db, 'projects'), newProject);
        return { id: docRef.id, ...newProject };
    }
};
