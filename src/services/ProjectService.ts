
import { where } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { Project } from '@/core/store/slices/appSlice';
import { logger } from '@/utils/logger';

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
            (a, b) => (b.date || 0) - (a.date || 0)
        );

        // Auto-seed Demo Project if empty and valid user
        if (results.length === 0 && userId && (orgId === 'org-default' || orgId === 'personal')) {
            console.info("No projects found, seeding Demo Project...");
            try {
                const demoProject = await this.createProject('Demo Project', 'creative', orgId);
                return [demoProject];
            } catch (e) {
                logger.error("Failed to seed demo project", e);
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

        // SEEDING: indii Branding Injection
        // We inject a default branding template into this project's isolated knowledge container.
        try {
            const { knowledgeBaseService } = await import('@/modules/knowledge/services/KnowledgeBaseService');
            // Create a Blob pretending to be a file
            const brandingTemplate = `
# BRANDING GUIDELINES for Project: ${name}
## Core Identity
- Tone: [Undefined - Please Edit]
- Visual Style: [Undefined - Please Edit]

## Colors
- Primary: #000000
- Secondary: #FFFFFF

## Rules
- All assets must align with the mood of ${type}.
            `.trim();

            const file = new File([brandingTemplate], 'branding_guidelines.md', { type: 'text/markdown' });

            // Helper to wrap single file in FileList-like object if needed, 
            // but knowledgeBaseService.uploadFiles expects FileList. 
            // We can assume we might need a direct ingestion method or mock FileList.
            // For now, we'll skip the upload helper and call the processor directly if accessible, 
            // or just use the uploadFiles with a DataTransfer trick.

            const dt = new DataTransfer();
            dt.items.add(file);
            await knowledgeBaseService.uploadFiles(dt.files, id);
            console.info(`[ProjectService] Seeded branding guidelines for project ${id}`);

        } catch (e) {
            logger.warn("[ProjectService] Failed to seed branding guidelines:", e);
            // Don't fail project creation just because seeding failed
        }

        return {
            id,
            ...newProjectData
        } as Project;
    }
}

export const ProjectService = new ProjectServiceImpl();
