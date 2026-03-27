import { Timestamp } from 'firebase/firestore';
import { FirestoreService } from '../FirestoreService';
import { Directive, DirectiveStatus, AgentRole } from './DirectiveTypes';

/**
 * DirectiveService — The execution tracker and goal ancestry manager.
 * Implements the "Paperclip" orchestration layer tickets paradigm.
 */
export class DirectiveService {
    private static cache = new Map<string, FirestoreService<Directive>>();

    private static getService(userId: string): FirestoreService<Directive> {
        let service = this.cache.get(userId);
        if (!service) {
            service = new FirestoreService<Directive>(`users/${userId}/directives`);
            this.cache.set(userId, service);
        }
        return service;
    }

    /**
     * Creates a new Directive, logging the "Why" and establishing the compute bounds.
     */
    static async create(userId: string, data: Omit<Directive, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'conversationThread'>): Promise<Directive> {
        const service = this.getService(userId);
        const now = Timestamp.now();
        const directive: Omit<Directive, 'id'> = {
            ...data,
            userId,
            conversationThread: [],
            createdAt: now,
            updatedAt: now,
        };

        const docId = await service.add(directive);
        return {
            ...directive,
            id: docId
        };
    }

    /**
     * Retrieves an existing Directive.
     */
    static async get(userId: string, directiveId: string): Promise<Directive> {
        const service = this.getService(userId);
        const directive = await service.get(directiveId);
        if (!directive) {
            throw new Error(`Directive ${directiveId} not found for user ${userId}`);
        }
        return directive as Directive; // The service.get returns Partial<T> or T depending on implementation, casting for strictness
    }

    /**
     * Updates the status of the Directive, often transitioning between IN_PROGRESS and WAITING_ON_HANDSHAKE.
     */
    static async updateStatus(userId: string, directiveId: string, status: DirectiveStatus): Promise<void> {
        const service = this.getService(userId);
        await service.update(directiveId, {
            status,
            updatedAt: Timestamp.now()
        } as Partial<Directive>);
    }

    /**
     * Fetches active directives specifically for an agent, usually called during the Neural Sync.
     */
    static async getActiveDirectivesForAgent(userId: string, agentRole: AgentRole): Promise<Directive[]> {
        const service = this.getService(userId);
        const allDirectives = await service.list();
        return allDirectives.filter((d: Directive) =>
            d.assignedAgent === agentRole &&
            (d.status === 'OPEN' || d.status === 'IN_PROGRESS')
        );
    }
}
