import { logger } from '@/utils/logger';

export interface NetworkQuality {
  rtt: number; // Round-trip time in ms
  downlink: number; // Mbps
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  saveData: boolean; // User prefers reduced data usage
}

type QualityChangeCallback = (quality: NetworkQuality) => void;

/**
 * NetworkQualityMonitor
 *
 * Monitors network connection quality using the Network Information API.
 * Provides metrics for adaptive request batching and media loading strategies.
 */
export class NetworkQualityMonitor {
  private quality: NetworkQuality | null = null;
  private qualityListeners: Set<QualityChangeCallback> = new Set();
  private connectionInfo: any = null;

  async initialize(): Promise<void> {
    // Check if Network Information API is available
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) {
      logger.warn(
        'NetworkQualityMonitor: Network Information API not available, using defaults'
      );
      this.quality = this.getDefaultQuality();
      return;
    }

    this.connectionInfo = connection;
    this.updateQuality();

    // Listen for quality changes
    connection.addEventListener('change', () => {
      this.updateQuality();
    });

    logger.info('NetworkQualityMonitor: initialized');
  }

  private updateQuality(): void {
    if (!this.connectionInfo) {
      this.quality = this.getDefaultQuality();
      return;
    }

    const effectiveType =
      (this.connectionInfo.effectiveType as '4g' | '3g' | '2g' | 'slow-2g') ||
      '4g';
    const downlink = this.connectionInfo.downlink || 10; // Mbps
    const rtt = this.connectionInfo.rtt || 50; // ms
    const saveData = this.connectionInfo.saveData || false;

    const newQuality: NetworkQuality = {
      effectiveType,
      downlink,
      rtt,
      saveData,
    };

    const changed =
      !this.quality ||
      JSON.stringify(this.quality) !== JSON.stringify(newQuality);

    this.quality = newQuality;

    if (changed) {
      logger.debug(
        `NetworkQualityMonitor: quality changed to ${effectiveType} (${downlink}Mbps, ${rtt}ms RTT)`
      );
      this.notifyListeners();
    }
  }

  private getDefaultQuality(): NetworkQuality {
    return {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
    };
  }

  /**
   * Get current network quality
   */
  getQuality(): NetworkQuality {
    if (!this.quality) {
      this.quality = this.getDefaultQuality();
    }
    return { ...this.quality };
  }

  /**
   * Determine if requests should be batched
   * Batch on: slow 2G/3G or if RTT > 100ms
   */
  shouldBatchRequests(): boolean {
    const quality = this.getQuality();
    return (
      quality.effectiveType === '2g' ||
      quality.effectiveType === '3g' ||
      quality.effectiveType === 'slow-2g' ||
      quality.rtt > 100
    );
  }

  /**
   * Determine if media should be lazy-loaded
   * Lazy-load on: slow 2G/3G or saveData enabled
   */
  shouldLazyLoadMedia(): boolean {
    const quality = this.getQuality();
    return (
      quality.saveData ||
      quality.effectiveType === '2g' ||
      quality.effectiveType === '3g' ||
      quality.effectiveType === 'slow-2g'
    );
  }

  /**
   * Get recommended batch size (smaller for slower connections)
   */
  getRecommendedBatchSize(): number {
    const quality = this.getQuality();

    switch (quality.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 5;
      case '3g':
        return 10;
      case '4g':
      default:
        return 25;
    }
  }

  /**
   * Get recommended batch delay (longer for slower connections)
   */
  getRecommendedBatchDelayMs(): number {
    const quality = this.getQuality();

    switch (quality.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 2000; // 2s
      case '3g':
        return 1000; // 1s
      case '4g':
      default:
        return 500; // 500ms
    }
  }

  /**
   * Subscribe to quality changes
   */
  onQualityChange(callback: QualityChangeCallback): () => void {
    this.qualityListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.qualityListeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    if (!this.quality) return;
    this.qualityListeners.forEach((callback) => {
      callback(this.quality!);
    });
  }
}

// Singleton instance
let networkQualityMonitor: NetworkQualityMonitor | null = null;

export async function initializeNetworkQualityMonitor(): Promise<
  NetworkQualityMonitor
> {
  if (!networkQualityMonitor) {
    networkQualityMonitor = new NetworkQualityMonitor();
    await networkQualityMonitor.initialize();
  }
  return networkQualityMonitor;
}

export function getNetworkQualityMonitor(): NetworkQualityMonitor {
  if (!networkQualityMonitor) {
    throw new Error(
      'NetworkQualityMonitor not initialized. Call initializeNetworkQualityMonitor first.'
    );
  }
  return networkQualityMonitor;
}
