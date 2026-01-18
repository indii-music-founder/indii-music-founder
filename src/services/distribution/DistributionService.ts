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
            console.warn('[Distribution] Electron API missing for tax calculation');
            throw new Error('Electron environment required for tax calculations');
        }

        try {
            // Updated to pass object as single argument matching new IPC signature
            const result = await window.electronAPI.distribution.calculateTax({ userId, amount });
            if (!result.success) {
                console.error('[Distribution] Tax calculation failed:', result.error);
                throw new Error(result.error || 'Tax calculation failed');
            }
            return result.report;
        } catch (error) {
            console.error('[Distribution] Unexpected tax engine error:', error);
            throw error;
        }
    }

    /**
     * Execute revenue waterfall via Electron IPC
     */
    async executeWaterfall(data: any): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for waterfall execution');
        }

        try {
            const result = await window.electronAPI.distribution.executeWaterfall(data);
            if (!result.success) {
                throw new Error(result.error || 'Waterfall execution failed');
            }
            return result.report;
        } catch (error) {
            console.error('[Distribution] Waterfall engine error:', error);
            throw error;
        }
    }

    /**
     * Validate release metadata via Electron IPC
     */
    async validateReleaseMetadata(metadata: any): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for metadata validation');
        }

        try {
            const result = await window.electronAPI.distribution.validateMetadata(metadata);
            if (!result.success) {
                console.warn('[Distribution] Metadata validation failed:', result.report);
                // Don't throw error if validation fails, just return report so UI can show errors
                // Unless it's an execution error
                if (result.error) throw new Error(result.error);
            }
            return result.report;
        } catch (error) {
            console.error('[Distribution] Validation engine error:', error);
            throw error;
        }
    }

    /**
     * Generate Content ID CSV Assets
     */
    async generateContentIdAssets(data: any): Promise<string> {
        if (!window.electronAPI) {
            console.warn('[Distribution] Electron API missing for Content ID generation');
            throw new Error('Electron environment required for Content ID generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateContentIdCSV(data);
            if (!result.success || (!result.csvData && !result.report)) {
                console.error('[Distribution] Content ID generation failed:', result.error);
                throw new Error(result.error || 'Content ID generation failed');
            }
            return result.csvData || JSON.stringify(result.report);
        } catch (error) {
            console.error('[Distribution] Content ID engine error:', error);
            throw error;
        }
    }

    /**
     * Generate a new ISRC via Python engine
     */
    async assignISRCs(options?: any): Promise<string> {
        if (!window.electronAPI) {
            console.warn('[Distribution] Electron API missing for ISRC generation');
            throw new Error('Electron environment required for ISRC generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateISRC(options);
            if (!result.success || !result.isrc) {
                console.error('[Distribution] ISRC Generation failed:', result.error);
                throw new Error(result.error || 'ISRC Generation failed');
            }
            return result.isrc;
        } catch (error) {
            console.error('[Distribution] ISRC engine error:', error);
            throw error;
        }
    }

    /**
     * Generate a new UPC via Python engine
     */
    async generateUPC(options?: any): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for UPC generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateUPC(options);
            if (!result.success || !result.upc) {
                throw new Error(result.error || 'UPC Generation failed');
            }
            return result.upc;
        } catch (error) {
            console.error('[Distribution] UPC engine error:', error);
            throw error;
        }
    }

    /**
     * Generate DDEX ERN 4.3 XML via Python engine
     */
    async generateDDEX(metadata: any): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for DDEX generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateDDEX(metadata);
            if (!result.success || !result.xml) {
                throw new Error(result.error || 'DDEX Generation failed');
            }
            return result.xml;
        } catch (error) {
            console.error('[Distribution] DDEX engine error:', error);
            throw error;
        }
    }

    /**
     * Check Merlin Network compliance status
     */
    async checkMerlinStatus(data: any): Promise<any> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for Merlin check');
        }

        try {
            const result = await window.electronAPI.distribution.checkMerlinStatus(data);
            if (!result.success) {
                throw new Error(result.error || 'Merlin status check failed');
            }
            return result.report;
        } catch (error) {
            console.error('[Distribution] Merlin engine error:', error);
            throw error;
        }
    }

    /**
     * Generate BWARM CSV report
     */
    async generateBWARM(data: any): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for BWARM generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateBWARM(data);
            if (!result.success || (!result.csv && !result.report)) {
                throw new Error(result.error || 'BWARM generation failed');
            }
            return result.csv || JSON.stringify(result.report);
        } catch (error) {
            console.error('[Distribution] BWARM engine error:', error);
            throw error;
        }
    }
}

export const distributionService = new DistributionService();
