import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

import { FirestoreService } from '../FirestoreService';
import { License, LicenseRequest } from './types';
import { query, where, orderBy, limit, Unsubscribe } from 'firebase/firestore';

export class LicensingService {
    private licensesStore = new FirestoreService<License>('licenses');
    private requestsStore = new FirestoreService<LicenseRequest>('license_requests');

    /**
     * Get active licenses for the current project.
     * Note: In a real project-scoped app, we would filter by projectId.
     */
    /**
     * Get active licenses for the current project.
     */
    async getActiveLicenses(userId?: string): Promise<License[]> {
        const constraints = [
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc')
        ];

        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.licensesStore.list(constraints);
    }

    /**
     * Get pending license requests.
     */
    async getPendingRequests(userId?: string): Promise<LicenseRequest[]> {
        const constraints = [
            where('status', 'in', ['checking', 'pending_approval', 'negotiating']),
            orderBy('updatedAt', 'desc')
        ];

        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.requestsStore.list(constraints);
    }

    /**
     * Create a new license.
     */
    async createLicense(license: Omit<License, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        return this.licensesStore.add(license as any);
    }

    /**
     * Create a new license request.
     */
    async createRequest(request: Omit<LicenseRequest, 'id' | 'requestedAt' | 'updatedAt'>): Promise<string> {
        // We cast to any to satisfy the store's simplified generic constraints
        // while maintaining internal type safety from the method signature.
        // Fixing the strict type chain for Omit<T, K> -> Partial<T> is out of scope for this hotfix.
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

    /**
     * Subscribe to real-time active licenses.
     */
    subscribeToActiveLicenses(callback: (licenses: License[]) => void, userId?: string, onError?: (error: Error) => void): Unsubscribe {
        const constraints = [where('status', '==', 'active')];
        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.licensesStore.subscribe(constraints, (data) => {
            // Client-side sort to avoid index requirements
            const sorted = data.sort((a, b) => {
                const dateA = a.updatedAt?.toMillis() || 0;
                const dateB = b.updatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            callback(sorted);
        }, onError);
    }

    /**
     * Subscribe to real-time pending requests.
     */
    subscribeToPendingRequests(callback: (requests: LicenseRequest[]) => void, userId?: string, onError?: (error: Error) => void): Unsubscribe {
        const constraints = [where('status', 'in', ['checking', 'pending_approval', 'negotiating'])];
        if (userId) {
            constraints.push(where('userId', '==', userId));
        }

        return this.requestsStore.subscribe(constraints, (data) => {
            // Client-side sort to avoid index requirements
            const sorted = data.sort((a, b) => {
                const dateA = a.updatedAt?.toMillis() || 0;
                const dateB = b.updatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            callback(sorted);
        }, onError);
    }

}

export const licensingService = new LicensingService();
