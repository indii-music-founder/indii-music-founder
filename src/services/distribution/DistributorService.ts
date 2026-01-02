/**
 * DistributorService
 * Main facade for managing releases across multiple music distributors
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
import type { ReleaseDeployment } from './types/persistence';


import { distributionStore } from './DistributionPersistenceService';
import { credentialService } from '@/services/security/CredentialService';
import { deliveryService, DeliveryResult } from './DeliveryService';
import { currencyConversionService } from './CurrencyConversionService';

// Import default adapters
import { DistroKidAdapter } from './adapters/DistroKidAdapter';
import { TuneCoreAdapter } from './adapters/TuneCoreAdapter';
import { CDBabyAdapter } from './adapters/CDBabyAdapter';
import { SymphonicAdapter } from './adapters/SymphonicAdapter';

class DistributorServiceImpl {
  private adapters: Map<DistributorId, IDistributorAdapter> = new Map();
  private store: typeof distributionStore = distributionStore;

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
    console.log(`[DistributorService] Registered adapter: ${adapter.name}`);
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

    // 1. If credentials provided, save them
    if (credentials) {
      await credentialService.saveCredentials(distributorId, credentials as Record<string, string | undefined>);
    }
    // 2. If not provided, try to load them
    else {
      const stored = await credentialService.getCredentials(distributorId);
      if (stored) {
        finalCredentials = stored as DistributorCredentials;
      }
    }

    // 3. Connect (or fail if no credentials found)
    if (!finalCredentials) {
      throw new Error(`No credentials found for ${distributorId}. Please provide them to connect.`);
    }

    await adapter.connect(finalCredentials);
    console.log(`[DistributorService] Connected to ${adapter.name}`);
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
    const adapter = this.adapters.get(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    const metadataValidation = await adapter.validateMetadata(metadata);
    const assetValidation = await adapter.validateAssets(assets);

    return {
      isValid: metadataValidation.isValid && assetValidation.isValid,
      errors: [...metadataValidation.errors, ...assetValidation.errors],
      warnings: [...metadataValidation.warnings, ...assetValidation.warnings],
    };
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

    // 1. Create Persistence Record (Pending)
    const deployment = await this.store.createDeployment(internalId, distributorId, 'validating', {
      title: metadata.releaseTitle || metadata.trackTitle,
      artist: metadata.artistName,
      coverArtUrl: assets.coverArt?.url
    });

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

      // Update status to processing/submitting
      this.store.updateDeploymentStatus(deployment.id, 'processing');

      // 3. Create release via Adapter
      const result = await adapter.createRelease(metadata, assets);

      // 4. Update Persistence Record with Result
      this.store.updateDeploymentStatus(deployment.id, result.status, {
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
        try {
          if (await adapter.isConnected()) {
            return await adapter.getEarnings(releaseId, period);
          }
        } catch (error) {
          console.warn(`Failed to fetch earnings from ${id}:`, error);
        }
        return null;
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
    const adapter = this.adapters.get(distributorId);
    if (!adapter) {
      throw new Error(`Unknown distributor: ${distributorId}`);
    }

    // Update status to delivering
    // Note: In a real app we'd want to find the specific deployment ID, 
    // but for now we'll assume the most recent one or handle it in the calling layer.
    // Ideally createRelease returns the deploymentId to track this lifecycle.

    return await deliveryService.deliverRelease({
      releaseId,
      distributorId,
      packagePath,
    });
  }

  async getReleaseStatusAcrossDistributors(
    releaseId: string
  ): Promise<Record<DistributorId, { status: string; error?: string }>> {
    const results: Record<string, { status: string; error?: string }> = {};

    // Get all known deployments for this release from store
    const deployments = await this.store.getDeploymentsForRelease(releaseId);

    await Promise.all(
      deployments.map(async (deployment: ReleaseDeployment) => {
        const adapter = this.adapters.get(deployment.distributorId);
        if (!adapter) return;

        try {
          if (await adapter.isConnected()) {
            // Fetch latest status
            // Note: Most APIs need the EXTERNAL ID, not our internal one.
            const externalId = deployment.externalId || releaseId;
            const status = await adapter.getReleaseStatus(externalId);

            // Update store
            this.store.updateDeploymentStatus(deployment.id, status);

            results[deployment.distributorId] = { status };
          } else {
            results[deployment.distributorId] = { status: 'not_connected' };
          }
        } catch (error) {
          results[deployment.distributorId] = {
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
    const deployments = await this.store.getAllDeployments();
    const grouped: Record<string, DashboardRelease> = {};

    deployments.forEach((d: ReleaseDeployment) => {
      if (!grouped[d.internalReleaseId]) {
        grouped[d.internalReleaseId] = {
          id: d.internalReleaseId,
          title: d.title || 'Untitled Release',
          artist: d.artist || 'Unknown Artist',
          coverArtUrl: d.coverArtUrl,
          releaseDate: d.submittedAt,
          deployments: {},
        };
      }
      grouped[d.internalReleaseId].deployments[d.distributorId] = { status: d.status };

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
