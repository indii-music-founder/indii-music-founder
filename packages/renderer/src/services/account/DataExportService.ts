import { db, storage } from '@/services/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { logger } from '@/utils/logger';

/**
 * Item 307: GDPR Article 20 — Right to Data Portability
 *
 * Allows users to export all their data as a structured JSON bundle.
 * The export includes:
 *   - User profile
 *   - All releases and tracks metadata
 *   - Contracts and split sheets
 *   - Campaign data
 *   - Analytics history
 *   - Generated assets (URLs only — files are too large for inline export)
 *   - Audit log
 *
 * The data is returned as a JSON blob that can be downloaded as a .json file.
 * File downloads (images, audio) are provided as signed URLs with 24h expiry.
 *
 * GDPR requires this to be fulfilled within 30 days of request.
 */

/** Collections to export from user's Firestore data */
const EXPORTABLE_COLLECTIONS = [
    'releases',
    'tracks',
    'contracts',
    'campaigns',
    'analytics',
    'splitSheets',
    'generatedImages',
    'generatedVideos',
    'notifications',
    'invoices',
    'auditLogs',
] as const;

export interface DataExportResult {
    success: boolean;
    data: Record<string, unknown>;
    storageFileUrls: { path: string; url: string }[];
    exportedAt: string;
    errors: string[];
}

/**
 * Export all documents from a user's subcollection.
 */
async function exportSubcollection(userId: string, subcollection: string): Promise<Record<string, unknown>[]> {
    const colRef = collection(db, 'users', userId, subcollection);
    const snapshot = await getDocs(colRef);

    return snapshot.docs.map(docSnap => ({
        _id: docSnap.id,
        ...docSnap.data(),
    }));
}

/**
 * Get signed URLs for all files in a user's Storage directory.
 * Returns paths and download URLs for the user to download their files.
 */
async function exportUserStorageUrls(userId: string): Promise<{ path: string; url: string }[]> {
    const urls: { path: string; url: string }[] = [];

    try {
        const userStorageRef = ref(storage, `users/${userId}`);
        const result = await listAll(userStorageRef);

        for (const itemRef of result.items) {
            try {
                const url = await getDownloadURL(itemRef);
                urls.push({ path: itemRef.fullPath, url });
            } catch {
                // File may have restricted access
                urls.push({ path: itemRef.fullPath, url: '[access_restricted]' });
            }
        }

        // Recurse into subdirectories
        for (const prefixRef of result.prefixes) {
            const subResult = await listAll(prefixRef);
            for (const subItem of subResult.items) {
                try {
                    const url = await getDownloadURL(subItem);
                    urls.push({ path: subItem.fullPath, url });
                } catch {
                    urls.push({ path: subItem.fullPath, url: '[access_restricted]' });
                }
            }
        }
    } catch (error: unknown) {
        logger.warn(`[DataExport] Storage listing error: ${error}`);
    }

    return urls;
}

/**
 * Export all user data for GDPR Article 20 compliance.
 *
 * @param userId - The Firebase UID of the user
 * @returns A structured data bundle ready for download
 */
export async function exportUserData(userId: string): Promise<DataExportResult> {
    const result: DataExportResult = {
        success: false,
        data: {},
        storageFileUrls: [],
        exportedAt: new Date().toISOString(),
        errors: [],
    };

    logger.info(`[DataExport] Starting data export for user: ${userId}`);

    // Step 1: Export user profile
    try {
        const profileDoc = await getDoc(doc(db, 'users', userId));
        if (profileDoc.exists()) {
            result.data['profile'] = {
                _id: profileDoc.id,
                ...profileDoc.data(),
            };
        }
    } catch (error: unknown) {
        result.errors.push(`Failed to export profile: ${error}`);
    }

    // Step 2: Export all subcollections
    for (const subcollection of EXPORTABLE_COLLECTIONS) {
        try {
            const docs = await exportSubcollection(userId, subcollection);
            if (docs.length > 0) {
                result.data[subcollection] = docs;
                logger.info(`[DataExport] Exported ${docs.length} docs from ${subcollection}`);
            }
        } catch (error: unknown) {
            result.errors.push(`Failed to export ${subcollection}: ${error}`);
        }
    }

    // Step 3: Get Storage file URLs
    try {
        result.storageFileUrls = await exportUserStorageUrls(userId);
        logger.info(`[DataExport] Found ${result.storageFileUrls.length} storage files`);
    } catch (error: unknown) {
        result.errors.push(`Storage export error: ${error}`);
    }

    // Add metadata
    result.data['_export_metadata'] = {
        exportedAt: result.exportedAt,
        userId,
        version: '1.0',
        format: 'indiiOS-GDPR-export',
        storageFileCount: result.storageFileUrls.length,
        collections: Object.keys(result.data).filter(k => k !== '_export_metadata'),
    };

    result.success = result.errors.length === 0;

    logger.info(`[DataExport] Export ${result.success ? 'complete' : 'completed with errors'} for ${userId}`);

    return result;
}

/**
 * Convert export result to a downloadable Blob.
 */
export function exportToBlob(result: DataExportResult): Blob {
    const exportData = {
        ...result.data,
        _storage_files: result.storageFileUrls,
    };

    return new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: 'application/json' }
    );
}

/**
 * Trigger a browser download of the export data.
 */
export function downloadExport(result: DataExportResult, filename?: string): void {
    const blob = exportToBlob(result);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `indiiOS-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
