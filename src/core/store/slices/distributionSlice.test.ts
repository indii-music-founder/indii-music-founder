import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDistributionSlice } from './distributionSlice';
import { DistributorService } from '@/services/distribution/DistributorService';
import { DistributorId } from '@/services/distribution/types/distributor';

// Mock dependencies
vi.mock('@/services/distribution/DistributorService', () => ({
  DistributorService: {
    getRegisteredDistributors: vi.fn(),
    getConnectionStatus: vi.fn(),
    connect: vi.fn(),
  }
}));

vi.mock('@/services/distribution/DistributionSyncService', () => ({
  DistributionSyncService: {
    fetchReleases: vi.fn(),
    subscribeToReleases: vi.fn(),
  }
}));

describe('distributionSlice', () => {
  let set: any;
  let get: any;
  let slice: any;

  beforeEach(() => {
    set = vi.fn((fn) => {
        // partial mock of zustand set
        if (typeof fn === 'function') {
            slice.distribution = fn({ distribution: slice.distribution }).distribution;
        } else {
             // Handle object update if necessary, but the slice uses function updates
        }
    });
    get = vi.fn();

    // Initialize slice state
    const api = createDistributionSlice(set, get, {} as any);
    slice = { ...api, distribution: (api as any).distribution }; // Helper to access state
  });

  describe('fetchDistributors', () => {
    it('should attempt auto-connect for all registered distributors', async () => {
      // Setup mocks
      const mockDistributors = ['distrokid', 'tunecore'] as DistributorId[];
      vi.mocked(DistributorService.getRegisteredDistributors).mockReturnValue(mockDistributors);
      vi.mocked(DistributorService.getConnectionStatus).mockResolvedValue([]);
      vi.mocked(DistributorService.connect).mockResolvedValue(undefined);

      // Execute
      await slice.fetchDistributors();

      // Verify
      expect(DistributorService.getRegisteredDistributors).toHaveBeenCalled();

      // We expect connect to be called for each distributor (Logic to be implemented)
      // Current implementation DOES NOT do this, so this test serves as TDD for the new feature
      expect(DistributorService.connect).toHaveBeenCalledWith('distrokid');
      expect(DistributorService.connect).toHaveBeenCalledWith('tunecore');
    });

    it('should handle auto-connect failures gracefully', async () => {
        const mockDistributors = ['distrokid'] as DistributorId[];
        vi.mocked(DistributorService.getRegisteredDistributors).mockReturnValue(mockDistributors);
        vi.mocked(DistributorService.getConnectionStatus).mockResolvedValue([]);

        // Mock connect to fail (e.g. no credentials)
        vi.mocked(DistributorService.connect).mockRejectedValue(new Error('No credentials'));

        // Execute
        await slice.fetchDistributors();

        // Verify it doesn't throw
        expect(DistributorService.connect).toHaveBeenCalledWith('distrokid');
    });
  });

  describe('connectDistributor', () => {
    it('should pass credentials to DistributorService.connect', async () => {
      const mockCreds = { apiKey: 'real-key' };
      vi.mocked(DistributorService.connect).mockResolvedValue(undefined);
      vi.mocked(DistributorService.getConnectionStatus).mockResolvedValue([]);

      // Execute with credentials (Logic to be implemented)
      await slice.connectDistributor('distrokid', mockCreds);

      // Verify
      expect(DistributorService.connect).toHaveBeenCalledWith('distrokid', mockCreds);
    });

    it('should not use ALPHA_MOCK_KEY', async () => {
        const mockCreds = { apiKey: 'real-key' };
        vi.mocked(DistributorService.connect).mockResolvedValue(undefined);
        vi.mocked(DistributorService.getConnectionStatus).mockResolvedValue([]);

        await slice.connectDistributor('distrokid', mockCreds);

        // Verify we are NOT passing the mock key
        // Note: This test will fail on the current codebase because it forces ALPHA_MOCK_KEY
        expect(DistributorService.connect).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ apiKey: 'ALPHA_MOCK_KEY' }));
    });
  });
});
