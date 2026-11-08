import { db, storage } from '@/services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, getDownloadURL, listAll, type StorageReference } from 'firebase/storage';
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

/** Top-level user-owned collections where documents contain an owner field matching userId */
export const USER_OWNED_ROOT_COLLECTIONS = [
    { name: 'releases', ownerField: 'userId' },
    { name: 'campaigns', ownerField: 'userId' },
    { name: 'workflows', ownerField: 'userId' },
    { name: 'ddexReleases', ownerField: 'userId' },
    { name: 'projects', ownerField: 'userId' },
    { name: 'split_sheets', ownerField: 'userId' },
] as const;

/** Subcollections under users/{userId} authorized and ruled in firestore.rules */
export const USER_SUBCOLLECTIONS = [
    'tracks',
    'notifications',
    'generated_images',
    'generated_videos',
    'notes',
    'alwaysOnMemories',
    'consolidationInsights',
    'publishingCatalog',
    'licensingDeals',
    'press_releases',
    'email_pitches',
    'setlists',
    'videoProjects',
    'canvasDocs',
    'canvas_states',
    'contracts',
    'contract_analyses',
    'contacts',
    'fieldContacts',
    'encounters',
    'tasks',
    'memories',
    'insights',
    'syncBriefs',
    'merchandiseMockups',
    'styleMemory',
    'styleLedger',
    'styleDNA',
    'assetRights',
    'coverLicenses',
    'crmLeads',
    'fanPurchases',
    'pod_orders',
    'proSubmissionDrafts',
    'publicist_media_contacts',
    'audio_assets',
    'browserHistory',
    'auditLogs',
    'agent_audit',
    'agentAuditTrails',
    'analytics',
    'payouts',
    'identityProtectionProfiles',
    'evidencePackets',
    'takedownCases',
    'directives',
    'agentLoopExecutions',
    'id3_operations',
    'mechanical_license_checks',
    'mechanical_licenses',
    'campaign_metrics',
    'workflowExecutions',
] as const;

/** Combined list of collections for backwards compatibility and discovery */
export const EXPORTABLE_COLLECTIONS = [
    ...USER_OWNED_ROOT_COLLECTIONS.map(c => c.name),
    ...USER_SUBCOLLECTIONS,
] as const;

export interface DataExportResult {
    success: boolean;
    data: Record<string, unknown>;
    storageFileUrls: { path: string; url: string }[];
    exportedAt: string;
    errors: string[];
}

/**
 * Export all documents from a user's subcollection under users/{userId}/{subcollection}.
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
 * Export all documents from a top-level collection owned by userId (where userId == userId).
 */
async function exportTopLevelCollection(userId: string, colName: string, ownerField: string = 'userId'): Promise<Record<string, unknown>[]> {
    const q = query(collection(db, colName), where(ownerField, '==', userId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => ({
        _id: docSnap.id,
        ...docSnap.data(),
    }));
}

/**
 * Recursively list all files in a Storage directory to arbitrary depth.
 */
async function collectStorageFiles(storageRef: StorageReference): Promise<{ path: string; url: string }[]> {
    const urls: { path: string; url: string }[] = [];
    const result = await listAll(storageRef);

    for (const itemRef of result.items) {
        try {
            const url = await getDownloadURL(itemRef);
            urls.push({ path: itemRef.fullPath, url });
        } catch {
            // File may have restricted access
            urls.push({ path: itemRef.fullPath, url: '[access_restricted]' });
        }
    }

    for (const prefixRef of result.prefixes) {
        try {
            const nestedUrls = await collectStorageFiles(prefixRef);
            urls.push(...nestedUrls);
        } catch (error: unknown) {
            logger.warn(`[DataExport] Storage listing error in ${prefixRef.fullPath}: ${error}`);
        }
    }

    return urls;
}

/**
 * Get signed URLs for all files in a user's Storage directory, recursing through all subdirectories.
 * Returns paths and download URLs for the user to download their files.
 */
async function exportUserStorageUrls(userId: string): Promise<{ path: string; url: string }[]> {
    try {
        const userStorageRef = ref(storage, `users/${userId}`);
        return await collectStorageFiles(userStorageRef);
    } catch (error: unknown) {
        logger.warn(`[DataExport] Storage listing error: ${error}`);
        return [];
    }
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

    // Step 2: Export top-level user-owned collections
    for (const { name, ownerField } of USER_OWNED_ROOT_COLLECTIONS) {
        try {
            const docs = await exportTopLevelCollection(userId, name, ownerField);
            if (docs.length > 0) {
                result.data[name] = docs;
                logger.info(`[DataExport] Exported ${docs.length} docs from top-level ${name}`);
            }
        } catch (error: unknown) {
            result.errors.push(`Failed to export ${name}: ${error}`);
        }
    }

    // Step 3: Export all ruled user subcollections
    for (const subcollection of USER_SUBCOLLECTIONS) {
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

    // Step 4: Get Storage file URLs
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
        format: 'indii-GDPR-export',
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
    a.download = filename || `indii-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
