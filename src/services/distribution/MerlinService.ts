import { distributionService } from './DistributionService';
import { DistributionSyncService } from './DistributionSyncService';
import { DDEXReleaseRecord } from '@/services/metadata/types';
import { SFTPConfig, DDEXMetadata } from '@/types/distribution';
import { credentialService } from '@/services/security/CredentialService';

export class MerlinService {
    private readonly MERLIN_SFTP_HOST = 'sftp.merlinnetwork.org';
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

            // 2. Fetch Credentials
            const creds = await credentialService.getCredentials('merlin');
            if (!creds || !creds.username || !creds.password) {
                throw new Error('Merlin SFTP credentials not found. Please configure them in Settings > Distribution.');
            }

            // 3. Generate DDEX XML
            const ddexXml = await this.generatePackage(release);

            // 4. Stage Release (Local FS)
            // Staging ensures the package is physically ready on disk for the SFTP engine
            if (window.electronAPI?.distribution?.stageRelease) {
                await window.electronAPI.distribution.stageRelease(releaseId, [
                    { type: 'metadata', data: ddexXml, name: 'release.xml' }
                ]);
            }

            // 5. Transmit via SFTP
            await this.transmitPackage(release, creds.username, creds.password);

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
                duration: t.durationSeconds || 0,
                explicit: t.explicit || false,
                filename: t.filename || '', // Map real filename
                file_hash: t.fileHash || '',
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
    private async transmitPackage(release: DDEXReleaseRecord, user: string, pass: string): Promise<void> {
        const config: SFTPConfig = {
            host: this.MERLIN_SFTP_HOST,
            port: this.MERLIN_SFTP_PORT,
            user: user,
            password: pass,
            remotePath: `/incoming/${release.metadata.upc}/`,
            // The stageRelease call in deliverRelease handles the physical placement.
            // In the desktop app, stageRelease places files in a predictable staging directory.
            localPath: `staged/${release.id}/release.xml`
        };

        const result = await distributionService.transmit(config);
        if (result.status !== 'SUCCESS') {
            throw new Error(`SFTP Transmission failed: ${result.message}`);
        }
    }
}

export const merlinService = new MerlinService();
