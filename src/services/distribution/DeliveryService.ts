
import { credentialService } from '@/services/security/CredentialService';
import { SFTPTransporter } from './transport/SFTPTransporter';
import { DistributorId } from './types/distributor';
// import { ERNService } from '@/services/ddex/ERNService'; // TODO: integrate when ERNService is ready for full pkg generation
// import { PackageBuilder } from '@/services/ddex/PackageBuilder'; // Potential future service

export interface DeliveryResult {
    success: boolean;
    message: string;
    deliveredFiles: string[];
    timestamp: string;
}

export class DeliveryService {
    private transporter: SFTPTransporter;

    constructor() {
        this.transporter = new SFTPTransporter();
    }

    /**
     * Deliver a release package to a distributor
     * @param options.releaseId - Internal release ID
     * @param options.distributorId - Target distributor
     * @param options.packagePath - Path to the pre-built directory containing DDEX XML and assets
     */
    async deliverRelease(options: {
        releaseId: string;
        distributorId: DistributorId;
        packagePath: string;
    }): Promise<DeliveryResult> {
        const { releaseId, distributorId, packagePath } = options;

        console.log(`[DeliveryService] Starting delivery for ${releaseId} to ${distributorId}...`);

        // 1. Fetch Credentials
        const credentials = await credentialService.getCredentials(distributorId);
        if (!credentials) {
            throw new Error(`No credentials found for ${distributorId}. Cannot deliver.`);
        }

        try {
            console.warn('[DeliveryService] SFTP operations are disabled in the browser environment. Use backend functions.');

            // Mock success
            return {
                success: true,
                message: 'Delivery successful (Mock)',
                deliveredFiles: ['mock-file.xml'],
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            console.error('[DeliveryService] Delivery failed:', error);
            // Ensure we disconnect on error
            if (await this.transporter.isConnected()) {
                await this.transporter.disconnect();
            }

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown delivery error',
                deliveredFiles: [],
                timestamp: new Date().toISOString(),
            };
        }
    }

    private getDefaultHost(distributorId: string): string {
        // Mock defaults for known distributors if not in credentials
        switch (distributorId) {
            case 'symphonic': return 'ftp.symphonic.com'; // Example
            case 'distrokid': return 'sftp.distrokid.com'; // Example
            default: return 'localhost';
        }
    }
}

export const deliveryService = new DeliveryService();
