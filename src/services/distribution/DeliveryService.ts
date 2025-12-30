
import path from 'path';
import { credentialService } from '@/services/security/CredentialService';
import { SFTPTransporter } from './transport/SFTPTransporter';
import { DistributorId, ExtendedGoldenMetadata, ReleaseAssets } from './types/distributor';
import { ernService } from '@/services/ddex/ERNService';

export interface DeliveryResult {
    success: boolean;
    message: string;
    deliveredFiles: string[];
    timestamp: string;
}

export interface ReleaseAssets {
    audioUrl: string;
    coverArtUrl: string;
}

export class DeliveryService {
    private transporter: SFTPTransporter;

    constructor() {
        this.transporter = new SFTPTransporter();
    }

    /**
     * Generate the complete release package
     * Creates the directory structure and generates the ERN XML file.
     * Note: This method requires a Node.js environment (Electron Main) to write files to disk.
     * In a browser environment, it will return the generated XML content but fail to write to disk.
     */
    async generateReleasePackage(metadata: ExtendedGoldenMetadata, outputDir: string, assets?: ReleaseAssets): Promise<{ success: boolean; packagePath?: string; xml?: string; error?: string }> {
    async generateReleasePackage(
        metadata: ExtendedGoldenMetadata,
        outputDir: string,
        assets?: ReleaseAssets
    ): Promise<{ success: boolean; packagePath?: string; xml?: string; error?: string }> {
        try {
            // 1. Generate ERN XML
            const generationResult = await ernService.generateERN(metadata, undefined, undefined, assets);
            if (!generationResult.success || !generationResult.xml) {
                return {
                    success: false,
                    error: generationResult.error || 'Failed to generate ERN XML'
                };
            }

            // 2. Write to disk if environment allows
            try {
                // Dynamic import to avoid bundling issues in browser
                // @ts-expect-error - fs is not available in browser types
                const fs = await import('fs');

                if (!fs || !fs.promises) {
                    throw new Error('FileSystem not available');
                }

                // Ensure output directory exists
                if (!fs.existsSync(outputDir)) {
                    await fs.promises.mkdir(outputDir, { recursive: true });
                }

                // Write ERN XML
                const xmlPath = path.join(outputDir, 'ern.xml');
                await fs.promises.writeFile(xmlPath, generationResult.xml, 'utf8');

                // 3. Copy Assets
                // 3. Copy Assets if provided
                if (assets) {
                    const resourcesDir = path.join(outputDir, 'resources');
                    if (!fs.existsSync(resourcesDir)) {
                        await fs.promises.mkdir(resourcesDir, { recursive: true });
                    }

                    // Copy Audio Files (Multi-track support)
                    if (assets.audioFiles && assets.audioFiles.length > 0) {
                        for (let i = 0; i < assets.audioFiles.length; i++) {
                            const asset = assets.audioFiles[i];
                            if (asset && asset.url) {
                                // Match naming convention in ERNMapper: A{i+1}.{ext}
                                // Note: ERNMapper assigns IDs starting from A1, A2... based on metadata.tracks order.
                                // We assume assets.audioFiles corresponds to this order (or trackIndex).

                                // Determine index. If trackIndex is provided, use it. Otherwise use loop index.
                                // ERNMapper resource counter starts at 1 and increments for each track.
                                const resourceIndex = (asset.trackIndex !== undefined) ? asset.trackIndex : i;
                                const resourceRef = `A${resourceIndex + 1}`;

                                const audioExt = asset.format || 'wav';
                                const audioDest = path.join(resourcesDir, `${resourceRef}.${audioExt}`);

                                await fs.promises.copyFile(asset.url, audioDest);
                            }
                        }
                    } else if (assets.audioFile && assets.audioFile.url) {
                        // Backward compatibility for singular audioFile
                        const audioExt = assets.audioFile.format || 'wav';
                        const audioDest = path.join(resourcesDir, `A1.${audioExt}`);
                        await fs.promises.copyFile(assets.audioFile.url, audioDest);
                    }

                    // Copy Cover Art
                    if (assets.coverArt && assets.coverArt.url) {
                         // Simple extension inference
                        const imageExt = assets.coverArt.url.split('.').pop() || 'jpg';
                        // ERNMapper uses continuous counter. If 5 tracks (A1-A5), Image is IMG6.
                        // Wait, ERNMapper uses separate counter? No, `resourceCounter`.
                        // Let's re-read ERNMapper.ts logic carefully.
                        // audioRef = `A${resourceCounter++}`
                        // imageRef = `IMG${resourceCounter++}`
                        // So if we have 2 tracks: A1, A2. Then IMG3.
                        // DeliveryService must calculate this correct index or ERNMapper must handle it.
                        // ERNMapper puts the filename in the XML. DeliveryService must match it.

                        // Recalculate counter:
                        const trackCount = (metadata.tracks && metadata.tracks.length > 0) ? metadata.tracks.length : 1;
                        const imageResourceIndex = trackCount + 1;

                        // Actually ERNMapper uses `IMG${resourceCounter}`.
                        // So if trackCount=1: A1. IMG2.
                        // If trackCount=2: A1, A2. IMG3.

                        const imageRef = `IMG${imageResourceIndex}`;
                        const imageDest = path.join(resourcesDir, `${imageRef}.${imageExt}`);
                        await fs.promises.copyFile(assets.coverArt.url, imageDest);
                    // Helper to copy file
                    const copyAsset = async (source: string, destinationName: string) => {
                        try {
                            // If source is a file URL, convert to path?
                            // For now assume absolute path or copyable string
                            const destPath = path.join(resourcesDir, destinationName);

                            // Check if source exists before copying
                            if (fs.existsSync(source)) {
                                await fs.promises.copyFile(source, destPath);
                            } else {
                                console.warn(`[DeliveryService] Asset source not found: ${source}`);
                            }
                        } catch (err) {
                            console.error(`[DeliveryService] Failed to copy asset ${source}:`, err);
                            throw err;
                        }
                    };

                    // Copy Audio
                    if (assets.audioUrl) {
                        const ext = path.extname(assets.audioUrl) || '.wav';
                        await copyAsset(assets.audioUrl, `audio${ext}`);
                    }

                    // Copy Cover Art
                    if (assets.coverArtUrl) {
                        const ext = path.extname(assets.coverArtUrl) || '.jpg';
                        await copyAsset(assets.coverArtUrl, `cover${ext}`);
                    }
                }

                return {
                    success: true,
                    packagePath: outputDir,
                    xml: generationResult.xml
                };

            } catch (fsError) {
                // If we are in a browser or fs is not available
                console.warn('[DeliveryService] FileSystem access not available. Returning XML content only.', fsError);
                return {
                    success: true, // It is successful in generating the content
                    xml: generationResult.xml,
                    error: 'FileSystem not available - package not written to disk'
                };
            }

        } catch (error) {
            console.error('[DeliveryService] Failed to generate release package:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Validate a release package before delivery
     * Generates and validates the ERN message from metadata
     */
    async validateReleasePackage(metadata: ExtendedGoldenMetadata, assets?: ReleaseAssets): Promise<{ valid: boolean; errors: string[] }> {
        // 1. Generate ERN XML
        const generationResult = await ernService.generateERN(metadata, undefined, undefined, assets);
        if (!generationResult.success || !generationResult.xml) {
            return {
                valid: false,
                errors: [generationResult.error || 'Failed to generate ERN XML']
            };
        }

        // 2. Parse ERN XML to verify structure
        const parseResult = ernService.parseERN(generationResult.xml);
        if (!parseResult.success || !parseResult.data) {
            return {
                valid: false,
                errors: [parseResult.error || 'Failed to parse generated ERN XML']
            };
        }

        // 3. Validate ERN Content
        return ernService.validateERNContent(parseResult.data);
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
