import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributorService } from './DistributorService';
import { distributionStore } from './DistributionPersistenceService';
import { currencyConversionService } from './CurrencyConversionService';
import { useStore } from '@/core/store';
import { DistributorAdapter, DistributorEarnings, DateRange } from './types/distributor';

// Mock CurrencyConversionService
vi.mock('./CurrencyConversionService', () => ({
  currencyConversionService: {
    convert: vi.fn(),
  }
}));

// Mock DistributionPersistenceService
vi.mock('./DistributionPersistenceService', () => ({
  distributionStore: {
    createDeployment: vi.fn(),
    updateDeploymentStatus: vi.fn(),
    getDeploymentsForRelease: vi.fn(),
    getAllDeployments: vi.fn(),
  }
}));

// Mock CredentialService
vi.mock('@/services/security/CredentialService', () => ({
  credentialService: {
    saveCredentials: vi.fn(),
    getCredentials: vi.fn(),
  }
}));

// Mock Store
vi.mock('@/core/store', () => ({
  useStore: {
    getState: vi.fn(() => ({
      userProfile: { id: 'test-user-id' },
      currentOrganizationId: 'test-org-id'
    }))
  }
}));

// Mock Adapters
const mockAdapter1: DistributorAdapter = {
  id: 'distrokid',
  name: 'DistroKid',
  requirements: {} as unknown as DistributorAdapter['requirements'],
  isConnected: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  createRelease: vi.fn(),
  updateRelease: vi.fn(),
  getReleaseStatus: vi.fn(),
  takedownRelease: vi.fn(),
  getEarnings: vi.fn(),
  getAllEarnings: vi.fn(),
  validateMetadata: vi.fn(),
  validateAssets: vi.fn(),
};

const mockAdapter2: DistributorAdapter = {
  id: 'tunecore',
  name: 'TuneCore',
  requirements: {} as unknown as DistributorAdapter['requirements'],
  isConnected: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  createRelease: vi.fn(),
  updateRelease: vi.fn(),
  getReleaseStatus: vi.fn(),
  takedownRelease: vi.fn(),
  getEarnings: vi.fn(),
  getAllEarnings: vi.fn(),
  validateMetadata: vi.fn(),
  validateAssets: vi.fn(),
};

describe('DistributorService.getAggregatedEarnings', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Register mock adapters
    DistributorService.registerAdapter(mockAdapter1);
    DistributorService.registerAdapter(mockAdapter2);
  });

  it('should aggregate earnings from multiple distributors and convert to target currency', async () => {
    const period: DateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
    const releaseId = 'release-123';

    // Mock isConnected to return true
    vi.mocked(mockAdapter1.isConnected).mockResolvedValue(true);
    vi.mocked(mockAdapter2.isConnected).mockResolvedValue(true);

    // Mock earnings from Adapter 1 (USD)
    const earnings1: DistributorEarnings = {
      distributorId: 'distrokid',
      releaseId,
      period,
      streams: 1000,
      downloads: 10,
      grossRevenue: 100, // USD
      distributorFee: 10,
      netRevenue: 90,
      currencyCode: 'USD',
      lastUpdated: '2023-02-01T00:00:00Z',
      breakdown: []
    };
    vi.mocked(mockAdapter1.getEarnings).mockResolvedValue(earnings1);

    // Mock earnings from Adapter 2 (EUR)
    const earnings2: DistributorEarnings = {
      distributorId: 'tunecore',
      releaseId,
      period,
      streams: 500,
      downloads: 5,
      grossRevenue: 100, // EUR
      distributorFee: 5,
      netRevenue: 95,
      currencyCode: 'EUR',
      lastUpdated: '2023-02-01T00:00:00Z',
      breakdown: []
    };
    vi.mocked(mockAdapter2.getEarnings).mockResolvedValue(earnings2);

    // Mock Currency Conversion
    // 1 USD = 1 USD
    vi.mocked(currencyConversionService.convert).mockImplementation((amount: number, from: string, to?: string) => {
      if (from === to) return Promise.resolve(amount);
      if (from === 'USD' && to === 'EUR') return Promise.resolve(amount * 0.92);
      if (from === 'EUR' && to === 'USD') return Promise.resolve(amount * 1.08); // Approx
      return Promise.resolve(amount);
    });

    // Act: Call getAggregatedEarnings
    const result = await DistributorService.getAggregatedEarnings(releaseId, period);

    // Assert
    expect(mockAdapter1.isConnected).toHaveBeenCalled();
    expect(mockAdapter1.getEarnings).toHaveBeenCalled();
    expect(mockAdapter2.getEarnings).toHaveBeenCalled();
    expect(currencyConversionService.convert).toHaveBeenCalled();

    // Total Revenue calculation check (in USD currently)
    // 100 USD -> 100 USD
    // 100 EUR -> 108 USD (approx)
    // Total = 208 USD
    expect(result.currencyCode).toBe('USD');
    expect(result.totalGrossRevenue).toBeCloseTo(208, 0);

    const resultEUR = await DistributorService.getAggregatedEarnings(releaseId, period, 'EUR');
    expect(resultEUR.currencyCode).toBe('EUR');
  });
});

describe('DistributorService.createRelease', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    DistributorService.registerAdapter(mockAdapter1);
    vi.mocked(mockAdapter1.createRelease).mockResolvedValue({
      success: true,
      status: 'delivered',
      distributorReleaseId: 'DIST-123'
    });
    vi.mocked(mockAdapter1.validateMetadata).mockResolvedValue({ isValid: true, errors: [], warnings: [] });
    vi.mocked(mockAdapter1.validateAssets).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    // Mock store creation return
    const mockDeployment = { id: 'deploy-123' };
    vi.mocked(distributionStore.createDeployment).mockResolvedValue(mockDeployment as any);
  });

  it('should pass userId and orgId to persistence service', async () => {
    // Arrange
    const metadata = { id: 'rel-1', trackTitle: 'Test', artistName: 'Artist' } as unknown as Parameters<typeof DistributorService.createRelease>[1];
    const assets = { coverArt: { url: 'http://test.com/img.jpg' } } as unknown as Parameters<typeof DistributorService.createRelease>[2];

    // Act
    await DistributorService.createRelease('distrokid', metadata, assets);

    // Assert
    expect(distributionStore.createDeployment).toHaveBeenCalledWith(
      'rel-1',            // internalId
      'test-user-id',     // userId
      'test-org-id',      // orgId
      'distrokid',        // distributorId
      'validating',       // status
      expect.anything()   // snapshot
    );
  });

  it('should throw if userProfile is missing', async () => {
    // Arrange
    vi.mocked(useStore.getState).mockReturnValueOnce({ userProfile: null, currentOrganizationId: 'test-org-id' } as unknown as import('@/core/store').StoreState);

    const metadata = { id: 'rel-1' } as unknown as Parameters<typeof DistributorService.createRelease>[1];
    const assets = {} as unknown as Parameters<typeof DistributorService.createRelease>[2];

    // Act & Assert
    await expect(DistributorService.createRelease('distrokid', metadata, assets))
      .rejects.toThrow('User or Organization not identified');
  });
});
