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

export class DeliveryService {
    private transporter: SFTPTransporter;

    constructor() {
        this.transporter = new SFTPTransporter();
    }

    /**
     * Generate the complete release package
     * Creates the directory structure and generates the ERN XML file.
     */
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
                const fs = await import('fs');

                if (!fs || !fs.promises || typeof fs.existsSync !== 'function') {
                    throw new Error('FileSystem not available');
                }

                // Ensure output directory exists
                if (!fs.existsSync(outputDir)) {
                    await fs.promises.mkdir(outputDir, { recursive: true });
                }

                // Write ERN XML
                const xmlPath = path.join(outputDir, 'ern.xml');
                await fs.promises.writeFile(xmlPath, generationResult.xml, 'utf8');

                // 3. Copy Assets if provided
                if (assets) {
                    const resourcesDir = path.join(outputDir, 'resources');
                    if (!fs.existsSync(resourcesDir)) {
                        await fs.promises.mkdir(resourcesDir, { recursive: true });
                    }

                    // Copy Audio Files
                    if (assets.audioFiles && assets.audioFiles.length > 0) {
                        for (let i = 0; i < assets.audioFiles.length; i++) {
                            const asset = assets.audioFiles[i];
                            if (asset && asset.url) {
                                const resourceIndex = (asset.trackIndex !== undefined) ? asset.trackIndex : i;
                                const resourceRef = `A${resourceIndex + 1}`;
                                const audioExt = asset.format || 'wav';
                                const audioDest = path.join(resourcesDir, `${resourceRef}.${audioExt}`);
                                if (fs.existsSync(asset.url)) {
                                    await fs.promises.copyFile(asset.url, audioDest);
                                } else {
                                    console.warn(`[DeliveryService] Asset file not found: ${asset.url}`);
                                }
                            }
                        }
                    } else if (assets.audioFile && assets.audioFile.url) {
                        const audioExt = assets.audioFile.format || 'wav';
                        const audioDest = path.join(resourcesDir, `A1.${audioExt}`);
                        if (fs.existsSync(assets.audioFile.url)) {
                            await fs.promises.copyFile(assets.audioFile.url, audioDest);
                        } else {
                            console.warn(`[DeliveryService] Asset file not found: ${assets.audioFile.url}`);
                        }
                    }

                    // Copy Cover Art
                    if (assets.coverArt && assets.coverArt.url) {
                        const baseUrl = assets.coverArt.url;
                        // For paths with query params or local paths, we need careful extension extraction
                        const cleanPath = baseUrl.split('?')[0] || '';
                        const imageExt = path.extname(cleanPath).replace('.', '') || 'jpg';
                        const trackCount = (metadata.tracks && metadata.tracks.length > 0) ? metadata.tracks.length : 1;
                        const imageRef = `IMG${trackCount + 1}`;
                        const imageDest = path.join(resourcesDir, `${imageRef}.${imageExt}`);
                        if (fs.existsSync(baseUrl)) {
                            await fs.promises.copyFile(baseUrl, imageDest);
                        } else {
                            console.warn(`[DeliveryService] Cover art file not found: ${baseUrl}`);
                        }
                    }
                }

                return {
                    success: true,
                    packagePath: outputDir,
                    xml: generationResult.xml
                };

            } catch (fsError) {
                console.warn('[DeliveryService] FileSystem access not available. Returning XML content only.', fsError);
                return {
                    success: true,
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
     */
    async validateReleasePackage(metadata: ExtendedGoldenMetadata, assets?: ReleaseAssets): Promise<{ valid: boolean; errors: string[] }> {
        const generationResult = await ernService.generateERN(metadata, undefined, undefined, assets);
        if (!generationResult.success || !generationResult.xml) {
            return {
                valid: false,
                errors: [generationResult.error || 'Failed to generate ERN XML']
            };
        }

        const parseResult = ernService.parseERN(generationResult.xml);
        if (!parseResult.success || !parseResult.data) {
            return {
                valid: false,
                errors: [parseResult.error || 'Failed to parse generated ERN XML']
            };
        }

        return ernService.validateERNContent(parseResult.data);
    }

    /**
     * Deliver a release package to a distributor
     */
    async deliverRelease(options: {
        releaseId: string;
        distributorId: DistributorId;
        packagePath: string;
    }): Promise<DeliveryResult> {
        const { releaseId, distributorId, packagePath } = options;
        console.log(`[DeliveryService] Starting delivery for ${releaseId} to ${distributorId}...`);

        const credentials = await credentialService.getCredentials(distributorId);
        if (!credentials) {
            throw new Error(`No credentials found for ${distributorId}. Cannot deliver.`);
        }

        try {
            console.warn('[DeliveryService] SFTP operations are disabled in the browser environment. Use backend functions.');
            return {
                success: true,
                message: 'Delivery successful (Mock)',
                deliveredFiles: ['mock-file.xml'],
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('[DeliveryService] Delivery failed:', error);
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
}

export const deliveryService = new DeliveryService();
