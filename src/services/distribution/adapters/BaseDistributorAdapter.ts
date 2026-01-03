import type {
  IDistributorAdapter,
  DistributorId,
  DistributorRequirements,
  DistributorCredentials,
  ReleaseStatus,
  ReleaseResult,
  DistributorEarnings,
  ValidationResult,
  ReleaseAssets,
  ExtendedGoldenMetadata,
  DateRange
} from '../types/distributor';

export abstract class BaseDistributorAdapter implements IDistributorAdapter {
  abstract readonly id: DistributorId;
  abstract readonly name: string;
  abstract readonly requirements: DistributorRequirements;

  protected connected = false;
  protected credentials?: DistributorCredentials;

  async isConnected(): Promise<boolean> {
    // If we're in Electron, we can also check the actual SFTP connection status
    if (typeof window !== 'undefined' && window.electronAPI?.sftp) {
      const isSftpConnected = await window.electronAPI.sftp.isConnected();
      return this.connected && (this.credentials?.sftpHost ? isSftpConnected : true);
    }
    return this.connected;
  }

  async connect(credentials: DistributorCredentials): Promise<void> {
    console.log(`[${this.name}Adapter] Attempting real connection...`);

    try {
      // 1. If SFTP credentials provided, try to establish a real connection
      if (credentials.sftpHost && window.electronAPI?.sftp) {
        const result = await window.electronAPI.sftp.connect({
          host: credentials.sftpHost,
          port: credentials.sftpPort ? parseInt(credentials.sftpPort) : 22,
          username: credentials.sftpUsername || credentials.username || '',
          password: credentials.sftpPassword || credentials.password || ''
        });

        if (!result.success) {
          throw new Error(`Failed to establish SFTP connection to ${credentials.sftpHost}`);
        }
        console.log(`[${this.name}Adapter] SFTP Connection Verified.`);
      }

      // 2. If API Key provided, we'd ideally verify it here via fetch
      // For now, if either SFTP or basic creds are present, we count as connected
      if (credentials.apiKey || credentials.username || credentials.sftpHost) {
        this.credentials = credentials;
        this.connected = true;
        console.log(`[${this.name}Adapter] Connected successfully.`);
      } else {
        throw new Error(`Missing required credentials for ${this.name}`);
      }
    } catch (error) {
      this.connected = false;
      this.credentials = undefined;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI?.sftp) {
      await window.electronAPI.sftp.disconnect();
    }
    this.connected = false;
    this.credentials = undefined;
  }

  abstract createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult>;
  abstract updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult>;
  abstract getReleaseStatus(releaseId: string): Promise<ReleaseStatus>;
  abstract takedownRelease(releaseId: string): Promise<ReleaseResult>;
  abstract getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings>;
  abstract getAllEarnings(period: DateRange): Promise<DistributorEarnings[]>;
  abstract validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult>;
  abstract validateAssets(assets: ReleaseAssets): Promise<ValidationResult>;
}
