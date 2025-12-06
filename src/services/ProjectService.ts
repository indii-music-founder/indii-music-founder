
import { where } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { Project } from '@/core/store/slices/appSlice';

class ProjectServiceImpl extends FirestoreService<Project> {
    constructor() {
        super('projects');
    }

    async getProjectsForOrg(orgId: string): Promise<Project[]> {
        return this.query(
            [where('orgId', '==', orgId)],
            (a, b) => b.date - a.date
        );
    }

    async createProject(name: string, type: Project['type'], orgId: string): Promise<Project> {
        if (!orgId) throw new Error("No organization selected");

        const id = await this.add({
            name,
            type,
            date: Date.now(),
            orgId
        } as Project); // Casting as Project for convenience, though strictly it's Omit<Project, 'id'> which matches

        // We need to return the full object. 'add' returns just the ID.
        // We can construct it optimistically since we just created it.
        return {
            id,
            name,
            type,
            date: Date.now(), // slight drift risk but acceptable for UI display immediately
            orgId
        } as Project;
    }
}

export const ProjectService = new ProjectServiceImpl();
