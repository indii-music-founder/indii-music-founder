
import { where } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { Project } from '@/core/store/slices/appSlice';

class ProjectServiceImpl extends FirestoreService<Project> {
    constructor() {
        super('projects');
    }

    async getProjectsForOrg(orgId: string): Promise<Project[]> {
        const constraints = [where('orgId', '==', orgId)];

        // If it's the personal workspace, we MUST filter by userId to satisfy security rules
        if (orgId === 'org-default' || orgId === 'personal') {
            const { auth } = await import('./firebase');
            if (auth.currentUser) {
                constraints.push(where('userId', '==', auth.currentUser.uid));
            } else {
                return []; // No user, no personal projects
            }
        }

        return this.query(
            constraints,
            (a, b) => b.date - a.date
        );
    }

    async createProject(name: string, type: Project['type'], orgId: string): Promise<Project> {
        if (!orgId) throw new Error("No organization selected");

        const { auth } = await import('./firebase');
        const user = auth.currentUser;
        if (!user) throw new Error("User must be logged in to create a project");

        const newProjectData = {
            name,
            type,
            date: Date.now(),
            orgId,
            userId: user.uid // Ensure userId is attached for ownership checks
        };

        const id = await this.add(newProjectData as unknown as Project);

        return {
            id,
            ...newProjectData
        } as Project;
    }
}

export const ProjectService = new ProjectServiceImpl();
