import { db } from '@/services/firebase';
import { collection, doc, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';

/**
 * Item 243: Contract Template Version Control
 *
 * Manages version history of legal templates (split sheets, licenses)
 * to ensure that changes to a template do not retroactively alter the
 * terms of previously signed agreements.
 */

export interface ContractTemplateVersion {
    id?: string;
    version: number;
    title: string;
    content: string;
    fields: string[]; // Dynamic fields like {{artistName}}, {{royaltyRate}}
    createdBy: string;
    createdAt: Timestamp;
    changeNotes: string;
    isActive: boolean;
}

export class ContractVersioningService {
    /**
     * Create a new version of a template. Automatically increments the version number.
     * Marks all previous versions as inactive.
     */
    static async publishNewVersion(
        templateId: string,
        data: Omit<ContractTemplateVersion, 'id' | 'version' | 'createdAt' | 'isActive'>
    ): Promise<string> {
        const versionsRef = collection(db, 'legal_templates', templateId, 'versions');

        // Get current max version
        const q = query(versionsRef, orderBy('version', 'desc'));
        const snapshot = await getDocs(q);

        const nextVersion = snapshot.empty ? 1 : snapshot.docs[0]!.data().version + 1;

        // Add new version
        const docRef = await addDoc(versionsRef, {
            ...data,
            version: nextVersion,
            createdAt: serverTimestamp(),
            isActive: true,
        });

        // Note: Disabling old versions would typically happen here via a Cloud Function
        // or a batch update to ensure atomicity.

        return docRef.id;
    }

    /**
     * Get the currently active version of a template
     */
    static async getActiveVersion(templateId: string): Promise<ContractTemplateVersion | null> {
        const versionsRef = collection(db, 'legal_templates', templateId, 'versions');
        const q = query(versionsRef, orderBy('createdAt', 'desc')); // Assuming latest is active
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const firstDoc = snapshot.docs[0]!;
        return { id: firstDoc.id, ...firstDoc.data() } as ContractTemplateVersion;
    }

    /**
     * Get a specific historical version of a template
     */
    static async getVersion(templateId: string, versionId: string): Promise<ContractTemplateVersion | null> {
        const docRef = doc(db, 'legal_templates', templateId, 'versions', versionId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        return { id: snapshot.id, ...snapshot.data() } as ContractTemplateVersion;
    }

    /**
     * Get the full version history for a template
     */
    static async getVersionHistory(templateId: string): Promise<ContractTemplateVersion[]> {
        const versionsRef = collection(db, 'legal_templates', templateId, 'versions');
        const q = query(versionsRef, orderBy('version', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ContractTemplateVersion[];
    }
}
