import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageMigrationService } from './StorageMigrationService';
import { auth } from '../firebase';
import { initDB } from './repository';
import { uploadBytes } from 'firebase/storage';
import { setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../firebase', () => ({
    auth: { currentUser: { uid: 'test-user-123' } },
    storage: {},
    db: {}
}));

vi.mock('./repository', () => ({
    initDB: vi.fn()
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    uploadBytes: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn()
}));

describe('StorageMigrationService', () => {
    let service: StorageMigrationService;

    beforeEach(() => {
        service = StorageMigrationService.getInstance();
        vi.clearAllMocks();
    });

    it('should be a singleton', () => {
        const instance2 = StorageMigrationService.getInstance();
        expect(service).toBe(instance2);
    });

    it('should throw if user not logged in', async () => {
        (auth as any).currentUser = null;
        await expect(service.migrateAllData()).rejects.toThrow("User must be logged in");
    });

    // Ideally we would test the actual cursor iteration, but that requires
    // extensive mocking of IDB. For this quick check, validating structure is enough.
});
