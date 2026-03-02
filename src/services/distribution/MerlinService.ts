import { distributionService } from './DistributionService';
import { DistributionSyncService } from './DistributionSyncService';
import { DDEXReleaseRecord } from '@/services/metadata/types';
import { SFTPConfig, DDEXMetadata } from '@/types/distribution';
import { credentialService } from '@/services/security/CredentialService';
import { db } from '@/services/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Merlin's real DDEX Party ID from the DDEX registry (dpid.ddex.net)
const MERLIN_DPID = 'PADPIDA2012110501U';

// Known DDEX error codes returned in Merlin acknowledgment XML
const MERLIN_ERROR_CODES: Record<string, string> = {
    'ERR-001': 'Invalid DDEX Party ID. Verify sender DPID matches Merlin registration.',
    'ERR-002': 'Malformed ERN XML. Run DDEX validator before resubmission.',
    'ERR-003': 'Duplicate release — ISRC/UPC already registered in Merlin catalog.',
    'ERR-004': 'Missing mandatory field. Check Title, Artist, ISRC, and UPC.',
    'ERR-005': 'Invalid ISRC format. Must conform to CC-XXX-YY-NNNNN.',
    'ERR-006': 'Invalid UPC format. Must be 12-digit GS1 barcode.',
    'ERR-007': 'Asset missing — audio or artwork file not found in package.',
    'ERR-008': 'Audio spec failure — file must be 44.1kHz/16-bit minimum.',
    'ERR-009': 'Artwork spec failure — must be 3000x3000 JPG/PNG.',
    'ERR-010': 'Territory deal missing — release must specify at least worldwide deal.',
};

export type MerlinDeliveryStatus =
    | 'queued'
    | 'staged'
    | 'transmitting'
    | 'delivered'
    | 'acknowledged'
    | 'failed'
    | 'rejected';

export interface MerlinDeliveryResult {
    success: boolean;
    status: MerlinDeliveryStatus;
    message: string;
    deliveryId?: string;
    errors?: string[];
}

export class MerlinService {
    readonly dpid = MERLIN_DPID;

    private readonly MERLIN_SFTP_HOST = 'sftp.merlinnetwork.org';
    private readonly MERLIN_SFTP_PORT = 22;
    // Merlin places acknowledged packages in this directory — polled post-delivery
    private readonly MERLIN_ACK_REMOTE_DIR = '/ack';

    /**
     * Orchestrates the full delivery of a release to Merlin Network via SFTP.
     * Updates Firestore deployments collection with real-time status.
     */
    async deliverRelease(releaseId: string): Promise<MerlinDeliveryResult> {
        console.log(`[Merlin] Starting delivery for release: ${releaseId}`);

        const deploymentRef = doc(db, 'deployments', `${releaseId}_merlin`);

        try {
            // Record delivery attempt in Firestore
            await setDoc(deploymentRef, {
                releaseId,
                distributor: 'merlin',
                distributorDpid: MERLIN_DPID,
                status: 'queued' as MerlinDeliveryStatus,
                startedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 1. Fetch Release Data
            const release = await DistributionSyncService.getRelease(releaseId);
            if (!release) {
                throw new Error(`Release not found: ${releaseId}`);
            }

            // 2. Validate critical IDs — Merlin rejects anything without real ISRC/UPC
            if (!release.metadata.upc) {
                throw new Error('UPC is required for Merlin delivery. Generate a UPC in the Authority Panel first.');
            }
            const tracks = release.metadata.tracks || [];
            const missingIsrc = tracks.find((t: any) => !t.isrc);
            if (missingIsrc) {
                throw new Error(`Track "${missingIsrc.trackTitle}" is missing an ISRC. Assign ISRCs in the Authority Panel first.`);
            }

            // 3. Fetch Merlin SFTP Credentials (stored in OS keyring via CredentialService)
            const creds = await credentialService.getCredentials('merlin');
            if (!creds || !creds.username || (!creds.password && !creds.privateKey)) {
                throw new Error(
                    'Merlin SFTP credentials not configured. Go to Settings > Distribution > Merlin to enter your SFTP credentials.'
                );
            }

            // 4. Generate DDEX ERN package
            await updateDoc(deploymentRef, { status: 'staged', updatedAt: serverTimestamp() });
            const ddexXml = await this.generatePackage(release);

            // 5. Stage release on local filesystem
            if (window.electronAPI?.distribution?.stageRelease) {
                await window.electronAPI.distribution.stageRelease(releaseId, [
                    { type: 'content', data: ddexXml, name: 'release.xml' }
                ]);
            }

            // 6. Transmit via SFTP to Merlin's incoming directory
            await updateDoc(deploymentRef, { status: 'transmitting', updatedAt: serverTimestamp() });
            await this.transmitPackage(release, creds.username, creds.password, creds.privateKey);

            const deliveryId = `MERLIN-${releaseId}-${Date.now()}`;

            await updateDoc(deploymentRef, {
                status: 'delivered' as MerlinDeliveryStatus,
                deliveryId,
                deliveredAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            console.log(`[Merlin] Delivery complete. ID: ${deliveryId}`);
            return {
                success: true,
                status: 'delivered',
                message: 'Delivered to Merlin Network via SFTP. Acknowledgment typically arrives within 24 hours.',
                deliveryId,
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Merlin delivery error';
            console.error('[Merlin] Delivery failed:', error);

            await updateDoc(deploymentRef, {
                status: 'failed' as MerlinDeliveryStatus,
                errorMessage: message,
                updatedAt: serverTimestamp(),
            }).catch(() => {/* best-effort */ });

            return { success: false, status: 'failed', message };
        }
    }

    /**
     * Polls the Merlin SFTP acknowledgment directory for response XML files.
     * Merlin places *_ACK.xml (success) or *_ERR.xml (rejection) files here.
     * Call this after deliverRelease — typically on a scheduled check.
     */
    async pollAcknowledgments(releaseId: string): Promise<{
        status: 'acknowledged' | 'rejected' | 'pending';
        errors?: string[];
    }> {
        console.log(`[Merlin] Polling acknowledgments for release: ${releaseId}`);

        try {
            const creds = await credentialService.getCredentials('merlin');
            if (!creds?.username) {
                return { status: 'pending' };
            }

            // Use Electron SFTP bridge to list files in the ack directory
            if (!window.electronAPI?.distribution?.listRemoteFiles) {
                // Not in Electron desktop environment
                return { status: 'pending' };
            }

            const remoteFiles: string[] = await window.electronAPI.distribution.listRemoteFiles({
                host: this.MERLIN_SFTP_HOST,
                port: this.MERLIN_SFTP_PORT,
                username: creds.username,
                password: creds.password,
                privateKey: creds.privateKey,
                remotePath: this.MERLIN_ACK_REMOTE_DIR,
            });

            // Merlin names ack files after the UPC: <upc>_ACK.xml or <upc>_ERR.xml
            const ackFile = remoteFiles.find(f => f.includes(releaseId) && f.endsWith('_ACK.xml'));
            const errFile = remoteFiles.find(f => f.includes(releaseId) && f.endsWith('_ERR.xml'));

            const deploymentRef = doc(db, 'deployments', `${releaseId}_merlin`);

            if (ackFile) {
                await updateDoc(deploymentRef, {
                    status: 'acknowledged' as MerlinDeliveryStatus,
                    acknowledgedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                return { status: 'acknowledged' };
            }

            if (errFile) {
                // Download and parse the error file for actionable codes
                const errContent: string = await window.electronAPI.distribution.downloadRemoteFile({
                    host: this.MERLIN_SFTP_HOST,
                    port: this.MERLIN_SFTP_PORT,
                    username: creds.username,
                    password: creds.password,
                    privateKey: creds.privateKey,
                    remotePath: `${this.MERLIN_ACK_REMOTE_DIR}/${errFile}`,
                });

                const errors = this.parseErrorXml(errContent);

                await updateDoc(deploymentRef, {
                    status: 'rejected' as MerlinDeliveryStatus,
                    rejectionErrors: errors,
                    updatedAt: serverTimestamp(),
                });

                return { status: 'rejected', errors };
            }

            return { status: 'pending' };

        } catch (error) {
            console.error('[Merlin] Acknowledgment poll failed:', error);
            return { status: 'pending' };
        }
    }

    /**
     * Parses a Merlin error XML response and returns human-readable error messages.
     */
    private parseErrorXml(xml: string): string[] {
        const errors: string[] = [];

        // Extract error codes from DDEX acknowledgment XML
        // Pattern: <ErrorCode>ERR-XXX</ErrorCode> or <Message>...</Message>
        const codeMatches = xml.matchAll(/<ErrorCode[^>]*>([^<]+)<\/ErrorCode>/g);
        for (const match of codeMatches) {
            const code = match[1].trim();
            errors.push(MERLIN_ERROR_CODES[code] || `Unknown error code: ${code}`);
        }

        const msgMatches = xml.matchAll(/<Message[^>]*>([^<]+)<\/Message>/g);
        for (const match of msgMatches) {
            const msg = match[1].trim();
            if (msg && !errors.some(e => e.includes(msg))) {
                errors.push(msg);
            }
        }

        return errors.length > 0 ? errors : ['Release rejected by Merlin. Contact support@merlinnetwork.org.'];
    }

    /**
     * Generates the DDEX ERN package XML for a release.
     */
    private async generatePackage(release: DDEXReleaseRecord): Promise<string> {
        const metadata: DDEXMetadata = {
            releaseId: release.id,
            title: release.metadata.releaseTitle || release.metadata.trackTitle || 'Untitled Release',
            artist: release.metadata.artistName,
            artists: [release.metadata.artistName],
            tracks: (release.metadata.tracks || []).map((t: Partial<import('@/services/metadata/types').ExtendedGoldenMetadata> & { filename?: string; fileHash?: string; durationSeconds?: number }) => ({
                isrc: t.isrc || '',
                title: t.trackTitle || '',
                duration: t.durationSeconds || 0,
                explicit: t.explicit || false,
                filename: t.filename || '',
                file_hash: t.fileHash || '',
                genre: t.genre || release.metadata.genre || '',
                label: t.labelName || release.metadata.labelName || ''
            })),
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
     * Transmits the staged release package to Merlin's SFTP incoming directory.
     * Remote path format: /incoming/<upc>/ (Merlin's standard ingestion structure)
     */
    private async transmitPackage(
        release: DDEXReleaseRecord,
        username: string,
        password?: string,
        privateKey?: string
    ): Promise<void> {
        const config: SFTPConfig = {
            host: this.MERLIN_SFTP_HOST,
            port: this.MERLIN_SFTP_PORT,
            user: username,
            password,
            privateKey,
            remotePath: `/incoming/${release.metadata.upc}/`,
            localPath: `staged/${release.id}/`
        };

        const result = await distributionService.transmit(config);
        if (result.status !== 'SUCCESS') {
            throw new Error(`SFTP Transmission failed: ${result.message}`);
        }
    }
}

export const merlinService = new MerlinService();
