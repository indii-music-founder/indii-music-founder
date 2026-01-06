import { auth, db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { initDB } from './repository';
const WORKFLOWS_STORE = 'workflows';

export class StorageMigrationService {
    private static instance: StorageMigrationService;

    private constructor() { }

    public static getInstance(): StorageMigrationService {
        if (!StorageMigrationService.instance) {
            StorageMigrationService.instance = new StorageMigrationService();
        }
        return StorageMigrationService.instance;
    }

    async migrateAllData(): Promise<void> {
        const user = auth.currentUser;
        if (!user) throw new Error("User must be logged in to migrate data");

        // Starting migration for user: user.uid

        await this.migrateAssets(user.uid);
        await this.migrateWorkflows(user.uid);

        // Migration complete
    }

    private async migrateAssets(userId: string): Promise<void> {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        let cursor = await store.openCursor();

        while (cursor) {
            const assetId = cursor.key as string;
            const blob = cursor.value as Blob;

            // Check if already in cloud (optimization)
            // For now, easier to just try upload or check existence if metadata exists
            // We'll upload blindly for "last write wins" or if missing

            try {
                const storageRef = ref(storage, `users/${userId}/assets/${assetId}`);
                await uploadBytes(storageRef, blob);
                // Migrated asset: ${assetId}
            } catch (_e) {
                // Failed to migrate asset ${assetId}
            }

            cursor = await cursor.continue();
        }
    }

    private async migrateWorkflows(userId: string): Promise<void> {
        const localDb = await initDB();
        const tx = localDb.transaction(WORKFLOWS_STORE, 'readonly');
        const store = tx.objectStore(WORKFLOWS_STORE);

        let cursor = await store.openCursor();

        while (cursor) {
            const workflow = cursor.value;
            const workflowId = workflow.id;

            try {
                const workflowRef = doc(db, 'users', userId, 'workflows', workflowId);
                await setDoc(workflowRef, {
                    ...workflow,
                    updatedAt: new Date().toISOString(),
                    synced: true
                }, { merge: true });
                // Migrated workflow: ${workflowId}
            } catch (_e) {
                // Failed to migrate workflow
            }

            cursor = await cursor.continue();
        }
    }
}

export const storageMigration = StorageMigrationService.getInstance();
