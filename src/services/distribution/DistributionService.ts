/**
 * DistributionService.ts
 * 
 * Central coordinator for the Direct Distribution Engine in the renderer process.
 * Manages the state of distribution tasks and communicates with Electron IPC.
 */

import { auth, db } from '@/services/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';

export interface DistributionTask {
    id: string;
    userId: string;
    type: 'QC' | 'STAGING' | 'PACKAGING' | 'DELIVERY';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    title: string;
    subtext?: string;
    error?: string;
    createdAt: any;
    updatedAt: any;
    metadata?: any;
}

class DistributionService {
    private collectionName = 'distribution_tasks';

    /**
     * Track a new distribution task in Firestore
     */
    async createTask(type: DistributionTask['type'], title: string, metadata: any = {}): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated');

        const docRef = await addDoc(collection(db, this.collectionName), {
            userId,
            type,
            status: 'PENDING',
            progress: 0,
            title,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            metadata
        });

        return docRef.id;
    }

    /**
     * Update task progress and status
     */
    async updateTask(taskId: string, updates: Partial<Pick<DistributionTask, 'status' | 'progress' | 'subtext' | 'error' | 'metadata'>>) {
        const taskRef = doc(db, this.collectionName, taskId);
        await updateDoc(taskRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Subscribe to active distribution tasks for the current user
     */
    subscribeTasks(callback: (tasks: DistributionTask[]) => void) {
        const userId = auth.currentUser?.uid;
        if (!userId) return () => { };

        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DistributionTask));
            callback(tasks);
        });
    }

    /**
     * Execute local audio forensics via Electron IPC
     */
    async runLocalForensics(taskId: string, filePath: string): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for forensics');
        }

        await this.updateTask(taskId, { status: 'RUNNING', subtext: 'Initializing spectral analysis...' });

        try {
            const result = await window.electronAPI.distribution.runForensics(filePath);

            if (!result.success) {
                await this.updateTask(taskId, { status: 'FAILED', error: result.error });
                return result;
            }

            const status = result.report.status === 'PASS' ? 'COMPLETED' : 'FAILED';
            await this.updateTask(taskId, {
                status,
                progress: 100,
                subtext: result.report.status,
                metadata: { report: result.report }
            });

            return result.report;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown forensics error';
            await this.updateTask(taskId, { status: 'FAILED', error: errorMsg });
            throw error;
        }
    }

    /**
     * Calculate tax withholding via Electron IPC (uses Python engine)
     */
    async calculateWithholding(userId: string, amount: number): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for tax calculations');
        }

        const result = await window.electronAPI.distribution.calculateTax(userId, amount);
        if (!result.success) {
            throw new Error(result.error || 'Tax calculation failed');
        }
        return result.report;
    }

    /**
     * Execute industrial waterfall payout via Electron IPC (uses Python engine)
     */
    async executeWaterfall(data: { gross: number; splits: Record<string, number>; recoupment?: number; indii_fee_percent?: number }): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for waterfall execution');
        }

        const result = await window.electronAPI.distribution.executeWaterfall(data);
        if (!result.success) {
            throw new Error(result.error || 'Waterfall execution failed');
        }
        return result.report;
    }
}

export const distributionService = new DistributionService();
