/**
 * CEO Sync Service — Encrypted Cloud Backup & Restore
 *
 * Enables artists to create encrypted snapshots of their critical
 * career data and sync them across devices. Uses SovereignVaultService
 * for AES-GCM 256 encryption before writing to Firebase Storage.
 *
 * The passphrase is never stored — only the artist can decrypt their backup.
 *
 * Backup includes:
 * - Golden Metadata for all releases
 * - Split sheets and royalty configurations
 * - Contract records (references, not files)
 * - Financial summaries
 * - Brand kit preferences
 * - ISWC work registry
 *
 * Workflow:
 * 1. Artist triggers "Backup Career" from Settings
 * 2. Service collects data from Firestore collections
 * 3. Data is encrypted client-side with artist's passphrase
 * 4. Encrypted blob is uploaded to Firebase Storage
 * 5. Restore reverses the process: download → decrypt → hydrate Firestore
 */

import {
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    doc,
    serverTimestamp,
} from 'firebase/firestore';
import {
    ref,
    uploadString,
    getDownloadURL,
    listAll,
} from 'firebase/storage';
import { db, auth, storage } from '@/services/firebase';
import { SovereignVaultService, EncryptedPayload } from '@/services/security/SovereignVaultService';

/** Collections included in a CEO Sync backup */
const BACKUP_COLLECTIONS = [
    'releases',
    'split_sheets',
    'contracts',
    'financial_summaries',
    'brand_kits',
    'iswc_works',
    'career_events',
] as const;

/** Backup manifest stored alongside the encrypted data */
export interface BackupManifest {
    /** Unique backup ID */
    id: string;

    /** ISO 8601 creation time */
    createdAt: string;

    /** Number of documents in backup */
    documentCount: number;

    /** Collections backed up */
    collections: string[];

    /** App version that created the backup */
    appVersion: string;

    /** SHA-256 hash of plaintext for integrity check */
    integrityHash: string;
}

/** Result of a backup operation */
export interface BackupResult {
    success: boolean;
    manifest: BackupManifest;
    storagePath: string;
}

/** Result of a restore operation */
export interface RestoreResult {
    success: boolean;
    documentsRestored: number;
    collectionsRestored: string[];
}

export class CEOSyncService {
    /**
     * Create an encrypted backup of the artist's career data.
     *
     * @param passphrase - Artist's encryption passphrase
     * @returns BackupResult with manifest and storage path
     */
    static async createBackup(passphrase: string): Promise<BackupResult> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        // 1. Collect all data from backed-up collections
        const backupData: Record<string, Record<string, unknown>[]> = {};
        let totalDocs = 0;

        for (const collectionName of BACKUP_COLLECTIONS) {
            const q = query(
                collection(db, collectionName),
                where('userId', '==', user.uid),
            );
            const snap = await getDocs(q);
            backupData[collectionName] = snap.docs.map(d => ({
                _docId: d.id,
                ...d.data(),
            }));
            totalDocs += snap.size;
        }

        // 2. Serialize to JSON
        const plaintext = JSON.stringify(backupData);

        // 3. Compute integrity hash
        const integrityHash = await CEOSyncService.sha256(plaintext);

        // 4. Encrypt client-side
        const encrypted = await SovereignVaultService.encrypt(plaintext, passphrase);

        // 5. Build manifest
        const backupId = `backup_${Date.now()}_${crypto.getRandomValues(new Uint8Array(4)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}`;
        const manifest: BackupManifest = {
            id: backupId,
            createdAt: new Date().toISOString(),
            documentCount: totalDocs,
            collections: [...BACKUP_COLLECTIONS],
            appVersion: '1.3.0',
            integrityHash,
        };

        // 6. Upload encrypted payload to Firebase Storage
        const storagePath = `ceo_sync/${user.uid}/${backupId}`;

        const payloadRef = ref(storage, `${storagePath}/data.enc`);
        await uploadString(payloadRef, JSON.stringify(encrypted), 'raw');

        const manifestRef = ref(storage, `${storagePath}/manifest.json`);
        await uploadString(manifestRef, JSON.stringify(manifest), 'raw');

        return {
            success: true,
            manifest,
            storagePath,
        };
    }

    /**
     * Restore a backup from Firebase Storage.
     *
     * @param backupId - The backup ID (from manifest)
     * @param passphrase - Artist's encryption passphrase
     * @returns RestoreResult
     */
    static async restoreBackup(backupId: string, passphrase: string): Promise<RestoreResult> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const storagePath = `ceo_sync/${user.uid}/${backupId}`;

        // 1. Download manifest
        const manifestRef = ref(storage, `${storagePath}/manifest.json`);
        const manifestUrl = await getDownloadURL(manifestRef);
        const manifestRes = await fetch(manifestUrl);
        const manifest: BackupManifest = await manifestRes.json();

        // 2. Download encrypted payload
        const payloadRef = ref(storage, `${storagePath}/data.enc`);
        const payloadUrl = await getDownloadURL(payloadRef);
        const payloadRes = await fetch(payloadUrl);
        const encrypted: EncryptedPayload = await payloadRes.json();

        // 3. Decrypt client-side
        const plaintext = await SovereignVaultService.decrypt(encrypted, passphrase);

        // 4. Integrity check
        const hash = await CEOSyncService.sha256(plaintext);
        if (hash !== manifest.integrityHash) {
            throw new Error('Backup integrity check failed. Data may be corrupted or the wrong passphrase was used.');
        }

        // 5. Parse and hydrate Firestore
        const backupData: Record<string, Record<string, unknown>[]> = JSON.parse(plaintext);
        let documentsRestored = 0;
        const collectionsRestored: string[] = [];

        for (const [collectionName, documents] of Object.entries(backupData)) {
            if (documents.length === 0) continue;

            const batch = writeBatch(db);
            for (const docData of documents) {
                const docId = docData._docId as string;
                const { _docId, ...cleanData } = docData;
                const docRef = doc(db, collectionName, docId);
                batch.set(docRef, {
                    ...cleanData,
                    restoredAt: serverTimestamp(),
                    restoredFromBackup: backupId,
                }, { merge: true });
                documentsRestored++;
            }
            await batch.commit();
            collectionsRestored.push(collectionName);
        }

        return {
            success: true,
            documentsRestored,
            collectionsRestored,
        };
    }

    /**
     * List all available backups for the current user.
     */
    static async listBackups(): Promise<BackupManifest[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const backupsRef = ref(storage, `ceo_sync/${user.uid}`);
        const result = await listAll(backupsRef);
        const manifests: BackupManifest[] = [];

        for (const prefix of result.prefixes) {
            try {
                const manifestRef = ref(storage, `${prefix.fullPath}/manifest.json`);
                const url = await getDownloadURL(manifestRef);
                const res = await fetch(url);
                manifests.push(await res.json());
            } catch {
                // Skip corrupted or incomplete backups
                continue;
            }
        }

        // Sort newest first
        manifests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return manifests;
    }

    /**
     * SHA-256 hash of a string for integrity verification.
     */
    private static async sha256(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data).buffer as ArrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
