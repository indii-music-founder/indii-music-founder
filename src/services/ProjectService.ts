
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
        let userId: string | undefined;
        if (orgId === 'org-default' || orgId === 'personal') {
            const { auth } = await import('./firebase');
            if (auth.currentUser) {
                userId = auth.currentUser.uid;
                constraints.push(where('userId', '==', userId));
            } else {
                return []; // No user, no personal projects
            }
        }

        const results = await this.query(
            constraints,
            (a, b) => b.date - a.date
        );

        // Auto-seed Demo Project if empty and valid user
        if (results.length === 0 && userId && (orgId === 'org-default' || orgId === 'personal')) {
            console.info("No projects found, seeding Demo Project...");
            try {
                const demoProject = await this.createProject('Demo Project', 'creative', orgId);
                return [demoProject];
            } catch (e) {
                console.error("Failed to seed demo project", e);
                return [];
            }
        }

        return results;
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
