
import { doc, updateDoc, deleteDoc, where, serverTimestamp, getDocs, query } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';
import { Project } from '@/core/store/slices/appSlice';
import { logger } from '@/utils/logger';
import { db } from '@/services/firebase';
import { isDemoUserId } from '@/utils/authGuards';

export type ProjectStatus = 'active' | 'paused' | 'archived';

class ProjectServiceImpl extends FirestoreService<Project> {
    constructor() {
        super('projects');
    }

    async getProjectsForOrg(orgId: string, includeArchived = false): Promise<Project[]> {
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

        if (!includeArchived) {
            return results.filter(p => !p.status || p.status === 'active' || p.status === 'paused');
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
            orgId,
            userId: user.uid,
            status: 'active' as const,
            assetCount: 0,
            date: Date.now(),
            lastModified: Date.now(),
            defaultParticipants: ['indii'], // Project-scoped agent arrangement
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const id = await this.add(newProjectData as unknown as Project);

        return {
            id,
            ...newProjectData
        } as Project;
    }

    async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
        const docRef = doc(db, 'projects', projectId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
    }

    async setStatus(projectId: string, status: ProjectStatus): Promise<void> {
        const docRef = doc(db, 'projects', projectId);
        await updateDoc(docRef, {
            status,
            ...(status === 'archived' && { archivedAt: serverTimestamp() }),
            updatedAt: serverTimestamp(),
        });
    }

    async deleteProject(projectId: string): Promise<void> {
        const docRef = doc(db, 'projects', projectId);
        await deleteDoc(docRef);
    }

    private inboxCreationPromise: Promise<Project> | null = null;

    async ensureInbox(userId: string): Promise<Project> {
        const { auth } = await import('./firebase');
        const isCurrentAnonymousUser = auth.currentUser?.uid === userId && auth.currentUser?.isAnonymous;
        if (isDemoUserId(userId) || isCurrentAnonymousUser) {
            throw new Error('A real authenticated user ID is required to create or load an inbox project.');
        }

        if (this.inboxCreationPromise) {
            return this.inboxCreationPromise;
        }

        const promise = (async () => {
            try {
                // Determine orgId for personal workspace
                const orgId = 'personal';
                const existing = await this.getProjectsForOrg(orgId, true);
                let inbox = existing.find((p) => p.name === 'Inbox');

                const allInboxes = existing.filter(p => p.name === 'Inbox').sort((a, b) => {
                    const timeA = a.date || 0;
                    const timeB = b.date || 0;
                    return timeA - timeB;
                });

                if (allInboxes.length > 1) {
                    inbox = allInboxes[0];
                    for (let i = 1; i < allInboxes.length; i++) {
                        const dupId = allInboxes[i]?.id;
                        if (dupId) await this.deleteProject(dupId);
                    }
                }

                if (inbox) {
                    // Ensure it is active
                    if (inbox.status === 'archived') {
                        await this.setStatus(inbox.id, 'active');
                        inbox.status = 'active';
                    }
                    return inbox;
                }

                return await this.createProject('Inbox', 'creative', orgId);
            } finally {
                this.inboxCreationPromise = null;
            }
        })();

        this.inboxCreationPromise = promise;
        return promise;
    }
}

export const ProjectService = new ProjectServiceImpl();
