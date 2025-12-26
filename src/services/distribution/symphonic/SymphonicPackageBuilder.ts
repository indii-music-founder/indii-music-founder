import * as fs from 'fs';
import * as path from 'path';
import { ernService } from '@/services/ddex/ERNService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { ReleaseAssets } from '../types/distributor';

/**
 * Symphonic Package Builder
 * Prepares release assets and metadata for SFTP transmission
 */
export class SymphonicPackageBuilder {
    private stagingBaseDir: string;

    constructor(stagingDir?: string) {
        // Default to a 'staging' folder in the project root if not specified
        this.stagingBaseDir = stagingDir || path.resolve(process.cwd(), 'ddex_staging');

        // Ensure base directory exists
        if (!fs.existsSync(this.stagingBaseDir)) {
            fs.mkdirSync(this.stagingBaseDir, { recursive: true });
        }
    }

    /**
     * Build the complete delivery package for a release
     */
    async buildPackage(
        metadata: ExtendedGoldenMetadata,
        assets: ReleaseAssets,
        releaseId: string
    ): Promise<{ packagePath: string; files: string[] }> {
        // 1. Create Release Folder (e.g. /CatalogNumber/)
        // Symphonic prefers folders named by UPC or Catalog Number
        const folderName = metadata.catalogNumber || metadata.upc || `REL-${releaseId}`;
        const packagePath = path.join(this.stagingBaseDir, folderName);

        if (fs.existsSync(packagePath)) {
            // Clean up existing folder if retrying
            fs.rmSync(packagePath, { recursive: true, force: true });
        }
        fs.mkdirSync(packagePath, { recursive: true });

        const packagedFiles: string[] = [];

        // 2. Generate and Write XML
        const xmlResult = await ernService.generateERN(metadata, 'PADPIDA2014040101U', 'SYMPHONIC_ID');
        if (!xmlResult.success || !xmlResult.xml) {
            throw new Error(`Failed to generate ERN for Symphonic: ${xmlResult.error}`);
        }

        const xmlPath = path.join(packagePath, 'metadata.xml');
        fs.writeFileSync(xmlPath, xmlResult.xml);
        packagedFiles.push(xmlPath);

        // 3. Process Audio (Rename and Copy)
        // Symphonic Convention: {TrackNumber}_{TrackTitle}.wav
        if (assets.audioFile && assets.audioFile.url) {
            const ext = path.extname(assets.audioFile.url) || '.wav';
            const safeTitle = metadata.trackTitle.replace(/[^a-zA-Z0-9]/g, '_');
            const audioFileName = `01_${safeTitle}${ext}`;
            const destAudioPath = path.join(packagePath, audioFileName);

            await this.copyAsset(assets.audioFile.url, destAudioPath);
            packagedFiles.push(destAudioPath);
        }

        // 4. Process Cover Art
        // Symphonic Convention: {UPC}.jpg or front.jpg
        if (assets.coverArt && assets.coverArt.url) {
            const ext = path.extname(assets.coverArt.url) || '.jpg';
            const coverFileName = `front${ext}`;
            const destCoverPath = path.join(packagePath, coverFileName);

            await this.copyAsset(assets.coverArt.url, destCoverPath);
            packagedFiles.push(destCoverPath);
        }

        console.log(`[SymphonicBuilder] Built package at ${packagePath} with ${packagedFiles.length} files.`);

        return { packagePath, files: packagedFiles };
    }

    /**
     * Helper to copy assets from source URL (file://) to destination
     */
    private async copyAsset(sourceUrl: string, destPath: string): Promise<void> {
        // Strip file:// prefix if present
        const sourcePath = sourceUrl.replace('file://', '');

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source asset not found: ${sourcePath}`);
        }

        fs.copyFileSync(sourcePath, destPath);
    }
}
