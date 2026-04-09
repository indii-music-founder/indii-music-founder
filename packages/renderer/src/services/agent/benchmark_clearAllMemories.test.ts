import { describe, it, expect, vi } from 'vitest';
import { userMemoryService } from './UserMemoryService';
import { FirestoreService } from '../FirestoreService';

// Mock dependencies
vi.mock('../FirestoreService', () => {
  return {
    FirestoreService: vi.fn()
  }
});

describe('UserMemoryService Benchmark', () => {
  it('measures performance of clearAllMemories', async () => {
    const numMemories = 1000;
    const dummyMemories = Array.from({ length: numMemories }, (_, i) => ({ id: `mem_${i}` }));

    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockDeleteMany = vi.fn().mockResolvedValue(undefined);
    const mockList = vi.fn().mockResolvedValue(dummyMemories);

    vi.mocked(FirestoreService).mockImplementation(function() {
      return {
        list: mockList,
        delete: mockDelete,
        deleteMany: mockDeleteMany,
      } as any;
    } as any);

    const start = performance.now();
    await userMemoryService.clearAllMemories('test_user');
    const end = performance.now();

    console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
    console.log(`Deletes called: ${mockDelete.mock.calls.length}`);
    console.log(`DeleteMany called: ${mockDeleteMany.mock.calls.length}`);

    expect(true).toBe(true);
  });
});
