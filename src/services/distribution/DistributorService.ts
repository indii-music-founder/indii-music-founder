/**
 * DistributorService
 * Main facade for managing releases across multiple music distributors
 * 
 * Phase 1 Hardening:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for failing APIs
 * - Request timeout handling
 * - Graceful degradation
 */

import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { DateRange, ValidationResult } from '@/services/ddex/types/common';
import type {
  DistributorId,
  ReleaseAssets,
  ReleaseResult,
  MultiDistributorReleaseRequest,
  MultiDistributorReleaseResult,
  AggregatedEarnings,
  DistributorConnection,
  DistributorCredentials,
  IDistributorAdapter,
  DashboardRelease,
  ReleaseStatus,
} from './types/distributor';
import type { ReleaseDeploymentDocument } from '@/types/firestore';

import { distributionStore } from './DistributionPersistenceService';
import { credentialService } from '@/services/security/CredentialService';
import { deliveryService, DeliveryResult } from './DeliveryService';
import { currencyConversionService } from './CurrencyConversionService';
// useStore removed
import { retryWithBackoff, CircuitBreaker, withTimeout } from '@/core/utils/resilience';
import {
  ExtendedGoldenMetadataSchema,
  DSRReportSchema,
  ReleaseAssetsSchema,
  DistributorEarningsSchema
} from '@/services/ddex/validation';

// Import default adapters
import { DistroKidAdapter } from './adapters/DistroKidAdapter';
import { TuneCoreAdapter } from './adapters/TuneCoreAdapter';
import { CDBabyAdapter } from './adapters/CDBabyAdapter';
import { SymphonicAdapter } from './adapters/SymphonicAdapter';

class DistributorServiceImpl {
  private adapters: Map<DistributorId, IDistributorAdapter> = new Map();
  private store: typeof distributionStore = distributionStore;
  private circuitBreakers: Map<DistributorId, CircuitBreaker> = new Map();

  constructor() {
    // Register default adapters for Alpha release
    this.registerAdapter(new DistroKidAdapter());
    this.registerAdapter(new TuneCoreAdapter());
    this.registerAdapter(new CDBabyAdapter());
    this.registerAdapter(new SymphonicAdapter());
  }

  // Allow injection for testing
  setPersistenceService(service: typeof distributionStore) {
    this.store = service;
  }

  /**
   * Register a distributor adapter
   */
  registerAdapter(adapter: IDistributorAdapter): void {
    this.adapters.set(adapter.id, adapter);
    this.circuitBreakers.set(adapter.id, new CircuitBreaker(5, 60000, 2));
    console.info(`[DistributorService] Registered adapter: ${adapter.name}`);
  }

  /**
   * Get all registered distributor IDs
   */
  getRegisteredDistributors(): DistributorId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get a specific adapter
   */
  getAdapter(distributorId: DistributorId): IDistributorAdapter | undefined {
    return this.adapters.get(distributorId);
  }

  /**
   * Connect to a distributor.
   * If credentials are provided, they are saved to secure storage.
   * If not provided, they are loaded from secure storage.
   */
  async connect(
    distributorId: DistributorId,
    credentials?: DistributorCredentials
  ): Promise<void> {
    const adapter = this.adapters.get(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    let finalCredentials = credentials;

    // 1. If credentials NOT provided, try to load them from secure storage
    if (!finalCredentials) {
      const stored = await credentialService.getCredentials(distributorId);
      if (stored) {
        finalCredentials = stored as DistributorCredentials;
      }
    }

    if (!finalCredentials) {
      throw new Error(`No credentials found for ${distributorId}. Please provide them to connect.`);
    }

    // 2. Attempt real connection via adapter with retry + timeout
    const breaker = this.circuitBreakers.get(distributorId);
    if (!breaker) {
      throw new Error(`Circuit breaker not initialized for ${distributorId}`);
    }

    try {
      await breaker.execute(async () => {
        return await retryWithBackoff(
          () => withTimeout(adapter.connect(finalCredentials), 30000, 'Connection timeout'),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[DistributorService] Connection retry ${attempt}/3 for ${distributorId}:`, error.message);
            },
          }
        );
      });

      console.info(`[DistributorService] Connection verified for ${adapter.name}`);

      // 3. Save successful credentials if they were passed in
      if (credentials) {
        await credentialService.saveCredentials(distributorId, credentials as Record<string, string | undefined>);
        console.info(`[DistributorService] Credentials saved for ${distributorId}`);
      }
    } catch (error) {
      console.error(`[DistributorService] Connection failed for ${distributorId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a distributor
   */
  async disconnect(distributorId: DistributorId): Promise<void> {
    const adapter = this.adapters.get(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    try {
      await adapter.disconnect();
      // Remove credentials from secure storage
      await credentialService.deleteCredentials(distributorId);
      console.info(`[DistributorService] Disconnected from ${adapter.name}`);
    } catch (error) {
      console.error(`[DistributorService] Disconnect failed for ${distributorId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection status for all distributors
   */
  async getConnectionStatus(): Promise<DistributorConnection[]> {
    const connections: DistributorConnection[] = [];

    for (const [id, adapter] of this.adapters) {
      const isConnected = await adapter.isConnected();
      connections.push({
        distributorId: id,
        isConnected,
        features: {
          canCreateRelease: true,
          canUpdateRelease: true,
          canTakedown: true,
          canFetchEarnings: true,
          canFetchAnalytics: true,
        },
      });
    }

    return connections;
  }

  /**
   * Validate metadata against a specific distributor's requirements
   */
  async validateForDistributor(
    distributorId: DistributorId,
    metadata: ExtendedGoldenMetadata,
    assets: ReleaseAssets
  ): Promise<ValidationResult> {
    const adapter = this.getAdapter(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    const breaker = this.circuitBreakers.get(distributorId);
    if (!breaker) {
      throw new Error(`Circuit breaker not initialized for ${distributorId}`);
    }

    // 4. Sanitize inputs using Zod for Phase 1.3
    let validatedMetadata: ExtendedGoldenMetadata;
    let validatedAssets: ReleaseAssets;

    try {
      // Validate metadata
      validatedMetadata = ExtendedGoldenMetadataSchema.parse(metadata) as ExtendedGoldenMetadata;
      // We'll trust ReleaseAssets type for now as it's complex, but we can add z.any() if needed
      validatedAssets = assets;
    } catch (error) {
      if (error instanceof Error) {
        return {
          isValid: false,
          errors: [{ code: 'VALIDATION_ERROR', message: `Metadata validation failed: ${error.message}`, severity: 'error' }],
          warnings: []
        };
      }
      throw error;
    }

    return await breaker.execute(async () => {
      return await retryWithBackoff(
        async () => {
          const metadataValidation = await withTimeout(
            adapter.validateMetadata(validatedMetadata),
            15000,
            `Metadata validation timeout for ${distributorId}`
          );
          const assetValidation = await withTimeout(
            adapter.validateAssets(validatedAssets),
            15000,
            `Asset validation timeout for ${distributorId}`
          );

          return {
            isValid: metadataValidation.isValid && assetValidation.isValid,
            errors: [...metadataValidation.errors, ...assetValidation.errors],
            warnings: [...metadataValidation.warnings, ...assetValidation.warnings],
          };
        },
        { maxAttempts: 2, initialDelayMs: 500 }
      );
    });
  }

  /**
   * Validate metadata against all selected distributors
   */
  async validateForMultipleDistributors(
    distributorIds: DistributorId[],
    metadata: ExtendedGoldenMetadata,
    assets: ReleaseAssets
  ): Promise<Record<DistributorId, ValidationResult>> {
    const results: Record<string, ValidationResult> = {};

    await Promise.all(
      distributorIds.map(async (id) => {
        results[id] = await this.validateForDistributor(id, metadata, assets);
      })
    );

    return results as Record<DistributorId, ValidationResult>;
  }

  /**
   * Release to a single distributor
   */
  async createRelease(
    distributorId: DistributorId,
    metadata: ExtendedGoldenMetadata & { id?: string }, // Ensure ID is accessible if passed
    assets: ReleaseAssets
  ): Promise<ReleaseResult> {
    const adapter = this.adapters.get(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    const internalId = metadata.id || 'unknown-release-id';

    // Get userId and orgId from store
    const { useStore } = await import('@/core/store');
    const { userProfile, currentOrganizationId } = useStore.getState();

    if (!userProfile?.id || !currentOrganizationId) {
      throw new Error('User or Organization not identified. Cannot create deployment.');
    }

    const userId = userProfile.id;
    const orgId = currentOrganizationId;

    // 1. Create Persistence Record (Pending)
    const deployment = await this.store.createDeployment(
      internalId,
      userId,
      orgId,
      distributorId,
      'validating',
      {
        title: metadata.releaseTitle || metadata.trackTitle,
        artist: metadata.artistName,
        coverArtUrl: assets.coverArt?.url
      }
    );

    try {
      // 2. Validate
      const validation = await this.validateForDistributor(
        distributorId,
        metadata,
        assets
      );

      if (!validation.isValid) {
        this.store.updateDeploymentStatus(deployment.id, 'failed', {
          errors: validation.errors
        });

        return {
          success: false,
          status: 'failed',
          errors: validation.errors.map((e) => ({
            code: e.code,
            message: e.message,
            field: e.field,
          })),
        };
      }

      // 3. Create release via Adapter with timeout + breaker
      const breaker = this.circuitBreakers.get(distributorId);
      if (!breaker) {
        throw new Error(`Circuit breaker not initialized for ${distributorId}`);
      }

      const result = await breaker.execute(async () => {
        // We use a longer timeout for release creation as it might involve large uploads/processing
        return await withTimeout(
          adapter.createRelease(metadata, assets),
          120000, // 2 minutes
          `Release creation timed out for ${distributorId}`
        );
      });

      // 4. Update Persistence Record with Result
      this.store.updateDeploymentStatus(deployment.id, result.status as ReleaseDeploymentDocument['status'], {
        externalId: result.distributorReleaseId
      });

      return result;

    } catch (error) {
      // Handle unexpected errors during submission
      this.store.updateDeploymentStatus(deployment.id, 'failed', {
        errors: [{ code: 'SUBMISSION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', severity: 'error' }]
      });
      throw error;
    }
  }

  /**
   * Release to multiple distributors simultaneously
   */
  async releaseToMultiple(
    request: MultiDistributorReleaseRequest
  ): Promise<MultiDistributorReleaseResult> {
    const { metadata, assets, distributors, options } = request;

    // Validate against all distributors first
    const validations = await this.validateForMultipleDistributors(
      distributors,
      metadata,
      assets
    );

    // Filter out distributors that failed validation (if option enabled)
    let targetDistributors = distributors;
    if (options?.skipFailedDistributors) {
      targetDistributors = distributors.filter(
        (id) => validations[id]?.isValid
      );
    }

    // Release to each distributor
    const results: Record<string, ReleaseResult> = {};
    const promises = targetDistributors.map(async (id) => {
      try {
        results[id] = await this.createRelease(id, metadata, assets);
      } catch (error) {
        results[id] = {
          success: false,
          status: 'failed',
          errors: [
            {
              code: 'RELEASE_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
        };
      }
    });

    await Promise.allSettled(promises);

    // Summarize results
    const successCount = Object.values(results).filter((r) => r.success).length;
    const failedCount = Object.values(results).filter(
      (r) => r.status === 'failed'
    ).length;
    const pendingCount = Object.values(results).filter((r) =>
      ['validating', 'pending_review', 'in_review', 'processing'].includes(r.status)
    ).length;

    return {
      overallSuccess: successCount > 0 && failedCount === 0,
      results: results as Record<DistributorId, ReleaseResult>,
      summary: {
        totalDistributors: distributors.length,
        successCount,
        failedCount,
        pendingCount,
      },
    };
  }

  /**
   * Get aggregated earnings across all distributors for a release
   */
  async getAggregatedEarnings(
    releaseId: string,
    period: DateRange,
    targetCurrency: string = 'USD'
  ): Promise<AggregatedEarnings> {
    const byDistributor = await Promise.all(
      Array.from(this.adapters.entries()).map(async ([id, adapter]) => {
        const breaker = this.circuitBreakers.get(id);
        if (!breaker) return null;

        try {
          return await breaker.execute(async () => {
            if (await adapter.isConnected()) {
              const earnings = await retryWithBackoff(
                () => withTimeout(adapter.getEarnings(releaseId, period), 45000, `Earnings fetch timeout from ${id}`),
                { maxAttempts: 3, initialDelayMs: 2000 }
              );

              // Validate/Sanitize earnings data from adapter
              return DistributorEarningsSchema.parse(earnings);
            }
            return null;
          });
        } catch (error: any) {
          console.warn(`[DistributorService] Failed to fetch earnings from ${id}:`, error instanceof Error ? error.message : error);
          return null;
        }
      })
    );

    const validEarnings = byDistributor.filter((e) => e !== null);

    // Aggregate
    let totalStreams = 0;
    let totalDownloads = 0;
    let totalGrossRevenue = 0;
    let totalFees = 0;
    let totalNetRevenue = 0;

    const platformMap = new Map<string, { streams: number; downloads: number; revenue: number }>();
    const territoryMap = new Map<string, { streams: number; downloads: number; revenue: number }>();

    // Process each distributor's earnings report
    for (const e of validEarnings) {
      if (!e) continue;

      // Determine conversion rate for this report
      const rate = await currencyConversionService.convert(1, e.currencyCode, targetCurrency);

      // Accumulate totals
      totalStreams += e.streams;
      totalDownloads += e.downloads;
      totalGrossRevenue += e.grossRevenue * rate;
      totalFees += e.distributorFee * rate;
      totalNetRevenue += e.netRevenue * rate;

      // Accumulate breakdown by platform
      e.breakdown?.forEach((b) => {
        const existing = platformMap.get(b.platform) || { streams: 0, downloads: 0, revenue: 0 };
        platformMap.set(b.platform, {
          streams: existing.streams + b.streams,
          downloads: existing.downloads + b.downloads,
          revenue: existing.revenue + (b.revenue * rate),
        });
      });

      // Accumulate breakdown by territory (Note: breakdown currently doesn't carry territory explicitly in the type definition above,
      // but assuming it matches EarningsBreakdown structure which has territoryCode)
      // Wait, looking at types: EarningsBreakdown has platform AND territoryCode.
      // So the same breakdown item contributes to platformMap AND territoryMap.

      e.breakdown?.forEach((b) => {
        const existing = territoryMap.get(b.territoryCode) || { streams: 0, downloads: 0, revenue: 0 };
        territoryMap.set(b.territoryCode, {
          streams: existing.streams + b.streams,
          downloads: existing.downloads + b.downloads,
          revenue: existing.revenue + (b.revenue * rate),
        });
      });
    }

    return {
      releaseId,
      period,
      totalStreams,
      totalDownloads,
      totalGrossRevenue,
      totalFees,
      totalNetRevenue,
      currencyCode: targetCurrency,
      byDistributor: validEarnings.filter((e) => e !== null) as typeof validEarnings[0] extends null ? never : typeof validEarnings[number][],
      byPlatform: Array.from(platformMap.entries()).map(([platform, data]) => ({
        platform,
        ...data,
      })),
      byTerritory: Array.from(territoryMap.entries()).map(([territoryCode, data]) => ({
        territoryCode,
        ...data,
      })),
    };
  }

  /**
   * Get release status across all distributors
   * Now updates persistence store if a connection is active
   */
  /**
   * Deliver a release package to a distributor via SFTP
   * @param releaseId Internal release ID
   * @param distributorId Target distributor
   * @param packagePath Path to the directory containing DDEX XML and assets
   */
  async deliverRelease(
    releaseId: string,
    distributorId: DistributorId,
    packagePath: string
  ): Promise<DeliveryResult> {
    const adapter = this.getAdapter(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    const breaker = this.circuitBreakers.get(distributorId);
    if (!breaker) {
      throw new Error(`Circuit breaker not initialized for ${distributorId}`);
    }

    // Delivering a package can take a long time, so we use a very generous timeout
    // but still protect the system from infinite hangs.
    return await breaker.execute(async () => {
      return await withTimeout(
        deliveryService.deliverRelease({
          releaseId,
          distributorId,
          packagePath,
        }),
        300000, // 5 minutes
        `Package delivery timed out for ${distributorId}`
      );
    });
  }

  async getReleaseStatusAcrossDistributors(
    releaseId: string
  ): Promise<Record<DistributorId, { status: string; error?: string }>> {
    const results: Record<string, { status: string; error?: string }> = {};

    // Get all known deployments for this release from store
    const deployments = await this.store.getDeploymentsForRelease(releaseId);

    await Promise.all(
      deployments.map(async (deployment: ReleaseDeploymentDocument) => {
        const distributorId = deployment.distributorId as DistributorId;
        const adapter = this.getAdapter(distributorId);
        const breaker = this.circuitBreakers.get(distributorId);

        if (!adapter || !breaker) return;

        try {
          await breaker.execute(async () => {
            if (await adapter.isConnected()) {
              // Fetch latest status
              const externalId = deployment.externalId || releaseId;
              const status = await retryWithBackoff(
                () => withTimeout(adapter.getReleaseStatus(externalId), 20000, `Status check timeout for ${distributorId}`),
                { maxAttempts: 2, initialDelayMs: 1000 }
              );

              // Update store
              this.store.updateDeploymentStatus(deployment.id, status as ReleaseDeploymentDocument['status']);

              results[distributorId] = { status };
            } else {
              results[distributorId] = { status: 'not_connected' };
            }
          });
        } catch (error: any) {
          results[distributorId] = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results as Record<DistributorId, { status: string; error?: string }>;
  }

  /**
   * Get all releases with their deployment statuses for the dashboard
   */
  async getAllReleases(): Promise<DashboardRelease[]> {
    // Get userId and orgId from store to filter deployments
    const { useStore } = await import('@/core/store');
    const { userProfile, currentOrganizationId } = useStore.getState();
    if (!userProfile?.id || !currentOrganizationId) {
      console.warn('[DistributorService] No user/org context for getAllReleases');
      return [];
    }

    const deployments = await this.store.getAllDeployments({
      userId: userProfile.id,
      orgId: currentOrganizationId
    });
    const grouped: Record<string, DashboardRelease> = {};

    deployments.forEach((d: ReleaseDeploymentDocument) => {
      if (!grouped[d.internalReleaseId]) {
        grouped[d.internalReleaseId] = {
          id: d.internalReleaseId,
          title: d.title || 'Untitled Release',
          artist: d.artist || 'Unknown Artist',
          coverArtUrl: d.coverArtUrl,
          releaseDate: d.submittedAt?.toDate().toISOString(),
          deployments: {},
        };
      }
      grouped[d.internalReleaseId].deployments[d.distributorId] = { status: d.status as unknown as ReleaseStatus };

      // Update metadata if a more complete record is found
      if (d.title && grouped[d.internalReleaseId].title === 'Untitled Release') {
        grouped[d.internalReleaseId].title = d.title;
      }
      if (d.artist && grouped[d.internalReleaseId].artist === 'Unknown Artist') {
        grouped[d.internalReleaseId].artist = d.artist;
      }
      if (d.coverArtUrl && !grouped[d.internalReleaseId].coverArtUrl) {
        grouped[d.internalReleaseId].coverArtUrl = d.coverArtUrl;
      }
    });

    return Object.values(grouped);
  }
}

// Export singleton
export const DistributorService = new DistributorServiceImpl();
