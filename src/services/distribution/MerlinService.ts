import { distributionService } from './DistributionService';
import { DistributionSyncService } from './DistributionSyncService';
import { DDEXReleaseRecord } from '@/services/metadata/types';
import { SFTPConfig, DDEXMetadata } from '@/types/distribution';

export class MerlinService {
    private readonly MERLIN_SFTP_HOST = 'sftp.merlinnetwork.org';
    private readonly MERLIN_SFTP_USER = process.env.VITE_MERLIN_SFTP_USER || 'mock_user';
    private readonly MERLIN_SFTP_PORT = 22;

    /**
     * Orchestrates the full delivery of a release to Merlin Network via SFTP
     */
    async deliverRelease(releaseId: string): Promise<{ success: boolean; message: string }> {
        console.log(`[Merlin] Starting delivery for release: ${releaseId}`);

        try {
            // 1. Fetch Release Data
            const release = await DistributionSyncService.getRelease(releaseId);
            if (!release) {
                throw new Error(`Release not found: ${releaseId}`);
            }

            // 2. Generate DDEX XML
            const ddexXml = await this.generatePackage(release);

            // 3. Transmit via SFTP (Fallback mode: No Aspera)
            await this.transmitPackage(release, ddexXml);

            return { success: true, message: 'Delivered to Merlin via SFTP' };
        } catch (error) {
            console.error('[Merlin] Delivery failed:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown Merlin delivery error'
            };
        }
    }

    /**
     * Generates the DDEX ERN package
     */
    private async generatePackage(release: DDEXReleaseRecord): Promise<string> {
        const metadata: DDEXMetadata = {
            releaseId: release.id,
            title: release.metadata.releaseTitle || release.metadata.trackTitle || 'Untitled Release',
            artist: release.metadata.artistName,
            artists: [release.metadata.artistName],
            tracks: release.metadata.tracks?.map((t: any) => ({
                isrc: t.isrc || '',
                title: t.trackTitle || '',
                duration: t.durationSeconds || 0, // Fallback to 0 if not yet computed in ExtendedGoldenMetadata
                explicit: t.explicit || false,
                filename: '', // File info handled separately by asset upload stage
                file_hash: '',
                genre: t.genre || release.metadata.genre || '',
                label: t.labelName || release.metadata.labelName || ''
            })) || [],
            label: release.metadata.labelName || '',
            upc: release.metadata.upc,
            genre: release.metadata.genre,
            release_date: release.metadata.releaseDate
        };

        const xml = await distributionService.generateDDEX(metadata);
        if (!xml) throw new Error('Failed to generate DDEX XML');
        return xml;
    }

    /**
     * Transmits the package using the core DistributionService SFTP engine
     */
    private async transmitPackage(release: DDEXReleaseRecord, xmlContent: string): Promise<void> {
        const config: SFTPConfig = {
            host: this.MERLIN_SFTP_HOST,
            port: this.MERLIN_SFTP_PORT,
            user: this.MERLIN_SFTP_USER,
            password: 'MOCK_PASSWORD_DO_NOT_USE', // In prod, this comes from secure vault/keytar
            remotePath: `/incoming/${release.metadata.upc}/`,
            localPath: '/tmp/release.xml' // Placeholder path, needs real file logic
        };

        const result = await distributionService.transmit(config);
        if (result.status !== 'SUCCESS') {
            throw new Error(`SFTP Transmission failed: ${result.message}`);
        }
    }
}

export const merlinService = new MerlinService();
