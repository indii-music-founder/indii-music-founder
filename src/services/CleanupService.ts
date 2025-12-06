/**
 * CleanupService - Database Vacuum / Garbage Collection
 *
 * Identifies and removes orphaned Firestore records:
 * - History items referencing deleted projects
 * - Projects referencing deleted organizations
 * - Optionally cleans up orphaned Firebase Storage files
 */

import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { ProjectService } from './ProjectService';
import { OrganizationService } from './OrganizationService';

export interface CleanupReport {
    orphanedHistoryItems: OrphanedRecord[];
    orphanedProjects: OrphanedRecord[];
    orphanedStorageFiles: string[];
    summary: {
        historyItemsFound: number;
        projectsFound: number;
        storageFilesFound: number;
        totalOrphaned: number;
    };
}

export interface OrphanedRecord {
    id: string;
    collection: string;
    reason: string;
    data?: Record<string, unknown>;
}

export interface CleanupOptions {
    dryRun?: boolean;
    includeStorage?: boolean;
    onProgress?: (message: string, current: number, total: number) => void;
}

class CleanupServiceImpl {
    /**
     * Scan for orphaned records without deleting (dry run by default)
     */
    async scan(options: CleanupOptions = {}): Promise<CleanupReport> {
        const { includeStorage = false, onProgress } = options;

        const report: CleanupReport = {
            orphanedHistoryItems: [],
            orphanedProjects: [],
            orphanedStorageFiles: [],
            summary: {
                historyItemsFound: 0,
                projectsFound: 0,
                storageFilesFound: 0,
                totalOrphaned: 0
            }
        };

        // Step 1: Get all valid project IDs
        onProgress?.('Fetching projects...', 0, 3);
        const validProjectIds = await this.getAllProjectIds();

        // Step 2: Get all valid organization IDs
        onProgress?.('Fetching organizations...', 1, 3);
        const validOrgIds = await this.getAllOrganizationIds();

        // Step 3: Find orphaned history items
        onProgress?.('Scanning history items...', 2, 3);
        const historyRef = collection(db, 'history');
        const historySnapshot = await getDocs(historyRef);

        for (const docSnap of historySnapshot.docs) {
            const data = docSnap.data();
            const projectId = data.projectId;
            const orgId = data.orgId;

            // Check if project exists
            if (projectId && projectId !== 'default' && !validProjectIds.has(projectId)) {
                report.orphanedHistoryItems.push({
                    id: docSnap.id,
                    collection: 'history',
                    reason: `Project '${projectId}' no longer exists`,
                    data: { projectId, orgId, type: data.type, prompt: data.prompt?.slice(0, 50) }
                });
            }
            // Also check if org exists (secondary check)
            else if (orgId && orgId !== 'personal' && orgId !== 'org-default' && !validOrgIds.has(orgId)) {
                report.orphanedHistoryItems.push({
                    id: docSnap.id,
                    collection: 'history',
                    reason: `Organization '${orgId}' no longer exists`,
                    data: { projectId, orgId, type: data.type }
                });
            }
        }

        // Step 4: Find orphaned projects
        const projectsRef = collection(db, 'projects');
        const projectsSnapshot = await getDocs(projectsRef);

        for (const docSnap of projectsSnapshot.docs) {
            const data = docSnap.data();
            const orgId = data.orgId;

            if (orgId && orgId !== 'personal' && orgId !== 'org-default' && !validOrgIds.has(orgId)) {
                report.orphanedProjects.push({
                    id: docSnap.id,
                    collection: 'projects',
                    reason: `Organization '${orgId}' no longer exists`,
                    data: { name: data.name, type: data.type, orgId }
                });
            }
        }

        // Step 5: Optionally scan storage for orphaned files
        if (includeStorage) {
            onProgress?.('Scanning storage files...', 3, 4);
            report.orphanedStorageFiles = await this.findOrphanedStorageFiles(validProjectIds);
        }

        // Calculate summary
        report.summary = {
            historyItemsFound: report.orphanedHistoryItems.length,
            projectsFound: report.orphanedProjects.length,
            storageFilesFound: report.orphanedStorageFiles.length,
            totalOrphaned: report.orphanedHistoryItems.length +
                report.orphanedProjects.length +
                report.orphanedStorageFiles.length
        };

        onProgress?.('Scan complete', 3, 3);
        return report;
    }

    /**
     * Execute cleanup based on a scan report
     */
    async execute(report: CleanupReport, options: CleanupOptions = {}): Promise<{
        deletedHistory: number;
        deletedProjects: number;
        deletedStorageFiles: number;
        errors: string[];
    }> {
        const { onProgress } = options;
        const result = {
            deletedHistory: 0,
            deletedProjects: 0,
            deletedStorageFiles: 0,
            errors: [] as string[]
        };

        const totalItems = report.orphanedHistoryItems.length +
            report.orphanedProjects.length +
            report.orphanedStorageFiles.length;
        let processed = 0;

        // Delete orphaned history items
        for (const item of report.orphanedHistoryItems) {
            try {
                await deleteDoc(doc(db, 'history', item.id));
                result.deletedHistory++;
                processed++;
                onProgress?.(`Deleted history item ${item.id}`, processed, totalItems);
            } catch (error) {
                result.errors.push(`Failed to delete history/${item.id}: ${error}`);
            }
        }

        // Delete orphaned projects
        for (const item of report.orphanedProjects) {
            try {
                await deleteDoc(doc(db, 'projects', item.id));
                result.deletedProjects++;
                processed++;
                onProgress?.(`Deleted project ${item.id}`, processed, totalItems);
            } catch (error) {
                result.errors.push(`Failed to delete projects/${item.id}: ${error}`);
            }
        }

        // Delete orphaned storage files
        for (const filePath of report.orphanedStorageFiles) {
            try {
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef);
                result.deletedStorageFiles++;
                processed++;
                onProgress?.(`Deleted storage file ${filePath}`, processed, totalItems);
            } catch (error) {
                result.errors.push(`Failed to delete storage/${filePath}: ${error}`);
            }
        }

        return result;
    }

    /**
     * Convenience method: Scan and execute in one call
     */
    async vacuum(options: CleanupOptions = {}): Promise<{
        report: CleanupReport;
        result: {
            deletedHistory: number;
            deletedProjects: number;
            deletedStorageFiles: number;
            errors: string[];
        };
    }> {
        const report = await this.scan(options);

        if (options.dryRun) {
            return {
                report,
                result: {
                    deletedHistory: 0,
                    deletedProjects: 0,
                    deletedStorageFiles: 0,
                    errors: []
                }
            };
        }

        const result = await this.execute(report, options);
        return { report, result };
    }

    // Helper methods

    private async getAllProjectIds(): Promise<Set<string>> {
        const projectsRef = collection(db, 'projects');
        const snapshot = await getDocs(projectsRef);
        return new Set(snapshot.docs.map(doc => doc.id));
    }

    private async getAllOrganizationIds(): Promise<Set<string>> {
        const orgsRef = collection(db, 'organizations');
        const snapshot = await getDocs(orgsRef);
        return new Set(snapshot.docs.map(doc => doc.id));
    }

    private async findOrphanedStorageFiles(validProjectIds: Set<string>): Promise<string[]> {
        const orphaned: string[] = [];

        try {
            // Check 'generated/' folder - these are keyed by history item ID
            const generatedRef = ref(storage, 'generated');
            const generatedList = await listAll(generatedRef);

            // For now, we'll check if files exist without corresponding history records
            // This is expensive, so it's optional
            const historyRef = collection(db, 'history');
            const historySnapshot = await getDocs(historyRef);
            const validHistoryIds = new Set(historySnapshot.docs.map(doc => doc.id));

            for (const item of generatedList.items) {
                const fileName = item.name;
                // File names are typically the history item ID
                if (!validHistoryIds.has(fileName)) {
                    orphaned.push(`generated/${fileName}`);
                }
            }
        } catch (error) {
            console.warn('Error scanning storage:', error);
            // Storage scanning is best-effort
        }

        return orphaned;
    }

    /**
     * Get a summary without full scan (quick check)
     */
    async quickCheck(): Promise<{
        historyCount: number;
        projectCount: number;
        orgCount: number;
    }> {
        const [historySnap, projectsSnap, orgsSnap] = await Promise.all([
            getDocs(collection(db, 'history')),
            getDocs(collection(db, 'projects')),
            getDocs(collection(db, 'organizations'))
        ]);

        return {
            historyCount: historySnap.size,
            projectCount: projectsSnap.size,
            orgCount: orgsSnap.size
        };
    }
}

export const CleanupService = new CleanupServiceImpl();
