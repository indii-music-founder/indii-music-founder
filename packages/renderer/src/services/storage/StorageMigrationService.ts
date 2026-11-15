import { auth, db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { initDB } from './repository';
const WORKFLOWS_STORE = 'workflows';
const STORE_NAME = 'assets';

export class StorageMigrationService {
    private static instance: StorageMigrationService;
    private constructor() { }

    public static getInstance(): StorageMigrationService {
        return StorageMigrationService.instance ??= new StorageMigrationService();
    }

    async migrateAllData(): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be logged in to migrate data');
        const localDb = await initDB();
        const failures: Error[] = [];
        // Enumerate keys, not Blob values, so migration does not retain all media
        // in memory. Every get below uses its own short-lived IDB transaction;
        // no cursor or transaction survives a network await.
        for (const storeName of [STORE_NAME, WORKFLOWS_STORE]) {
            this.requireSameUser(userId);
            const keys = await localDb.getAllKeys(storeName);
            for (const key of keys) {
                this.requireSameUser(userId);
                try {
                    const value = await localDb.get(storeName, key);
                    if (value === undefined) continue; // Removed locally after enumeration.
                    this.requireSameUser(userId);
                    if (storeName === STORE_NAME) {
                        const blob = value as Blob;
                        await uploadBytes(ref(storage, `users/${userId}/assets/${String(key)}`), blob, {
                            contentType: blob.type || 'image/png',
                        });
                    } else {
                        const workflowRef = doc(db, 'workflows', value.id);
                        await setDoc(workflowRef, {
                            ...value,
                            userId,
                            updatedAt: new Date().toISOString(),
                            synced: true,
                        }, { merge: true });
                    }
                } catch (cause: unknown) {
                    failures.push(new Error(`Failed to migrate ${storeName}/${String(key)}`, { cause }));
                }
            }
        }
        this.requireSameUser(userId);
        if (failures.length) {
            throw new AggregateError(failures, `${failures.length} local records could not be migrated. Local copies were retained; retry migration.`);
        }
    }

    private requireSameUser(userId: string): void {
        if (auth.currentUser?.uid !== userId) {
            throw new Error('Account changed during migration. Sign in to the original account and retry.');
        }
    }
}

export const storageMigration = StorageMigrationService.getInstance();
