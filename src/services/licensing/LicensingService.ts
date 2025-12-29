
import { FirestoreService } from '../FirestoreService';
import { License, LicenseRequest } from './types';
import { query, where, orderBy, limit } from 'firebase/firestore';

export class LicensingService {
    private licensesStore = new FirestoreService<License>('licenses');
    private requestsStore = new FirestoreService<LicenseRequest>('license_requests');

    /**
     * Get active licenses for the current project.
     * Note: In a real project-scoped app, we would filter by projectId.
     */
    async getActiveLicenses(): Promise<License[]> {
        return this.licensesStore.list([
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc')
        ]);
    }

    /**
     * Get pending license requests.
     */
    async getPendingRequests(): Promise<LicenseRequest[]> {
        return this.requestsStore.list([
            where('status', 'in', ['checking', 'pending_approval', 'negotiating']),
            orderBy('updatedAt', 'desc')
        ]);
    }

    /**
     * Create a new license request.
     */
    async createRequest(request: Omit<LicenseRequest, 'id' | 'requestedAt' | 'updatedAt'>): Promise<string> {
        return this.requestsStore.add({
            ...request,
            status: request.status || 'checking'
        } as any);
    }

    /**
     * Update an existing request.
     */
    async updateRequest(id: string, data: Partial<LicenseRequest>): Promise<void> {
        return this.requestsStore.update(id, data);
    }

    /**
     * Convenience method to update set status.
     */
    async updateRequestStatus(id: string, status: LicenseRequest['status']): Promise<void> {
        return this.updateRequest(id, { status });
    }
}

export const licensingService = new LicensingService();
