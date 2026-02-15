import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageMigrationService } from './StorageMigrationService';
import { auth, db, storage } from '../firebase';
import { initDB } from './repository';
import { uploadBytes } from 'firebase/storage';
import { setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock('./repository', () => ({
  initDB: vi.fn(),
}));

describe('StorageMigrationService', () => {
  const mockUserId = 'test-user-123';
  let mockIDB: any;
  let mockCursor: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock Auth
    (auth as any).currentUser = { uid: mockUserId };

    // Setup IDB Mock chain
    // initDB() -> db -> transaction() -> store -> openCursor() -> cursor

    mockCursor = {
      key: 'asset-1',
      value: new Blob(['test-data']),
      continue: vi.fn().mockResolvedValue(null), // Stop after first iteration by default
    };

    const mockStore = {
      openCursor: vi.fn().mockResolvedValue(mockCursor),
    };

    const mockTx = {
      objectStore: vi.fn().mockReturnValue(mockStore),
    };

    mockIDB = {
      transaction: vi.fn().mockReturnValue(mockTx),
    };

    (initDB as any).mockResolvedValue(mockIDB);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should migrate assets and workflows from IDB to Firebase', async () => {
    // Setup specific cursor behaviors for this test
    // We need to handle two calls to openCursor: one for assets, one for workflows

    // Asset Cursor
    const assetCursor = {
      key: 'asset-legacy-1',
      value: new Blob(['legacy-asset-content']),
      continue: vi.fn().mockResolvedValue(null),
    };

    // Workflow Cursor
    const workflowCursor = {
      key: 'workflow-legacy-1',
      value: { id: 'workflow-legacy-1', name: 'Legacy Workflow' },
      continue: vi.fn().mockResolvedValue(null),
    };

    // Mock store.openCursor to return assetCursor first, then workflowCursor second?
    // Actually, `migrateAllData` calls `migrateAssets` then `migrateWorkflows`.
    // Each calls `initDB` and then `transaction(STORE_NAME/WORKFLOWS_STORE)`.
    // We can distinguish based on the store name passed to transaction.

    const mockAssetStore = {
      openCursor: vi.fn().mockResolvedValue(assetCursor),
    };

    const mockWorkflowStore = {
      openCursor: vi.fn().mockResolvedValue(workflowCursor),
    };

    const mockTx = {
      objectStore: vi.fn().mockImplementation((storeName) => {
        if (storeName === 'assets') return mockAssetStore;
        if (storeName === 'workflows') return mockWorkflowStore;
        return { openCursor: vi.fn() };
      }),
    };

    mockIDB.transaction.mockReturnValue(mockTx);

    // Run migration
    await StorageMigrationService.getInstance().migrateAllData();

    // Verify Asset Migration
    expect(mockIDB.transaction).toHaveBeenCalledWith('assets', 'readonly');
    expect(mockAssetStore.openCursor).toHaveBeenCalled();
    expect(uploadBytes).toHaveBeenCalled();
    // We can check if it was called with the right blob
    // The first argument is the storageRef, which we mocked as undefined result of `ref` call.
    // In our mock, `ref` returns undefined by default unless configured.
    // The implementation is `const storageRef = ref(storage, ...); await uploadBytes(storageRef, blob);`
    // Since we mocked `ref` with `vi.fn()` and didn't set a return value, it returns undefined.
    expect(uploadBytes).toHaveBeenCalledWith(undefined, assetCursor.value);

    // Verify Workflow Migration
    expect(mockIDB.transaction).toHaveBeenCalledWith('workflows', 'readonly');
    expect(mockWorkflowStore.openCursor).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
            id: 'workflow-legacy-1',
            name: 'Legacy Workflow',
            synced: true
        }),
        { merge: true }
    );
  });

  it('should throw error if user is not logged in', async () => {
    (auth as any).currentUser = null;
    await expect(StorageMigrationService.getInstance().migrateAllData()).rejects.toThrow("User must be logged in");
  });
});
