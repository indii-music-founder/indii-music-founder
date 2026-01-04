// import * as fs from 'fs';
// import * as path from 'path';
import { ernService } from '@/services/ddex/ERNService';
import { DDEX_CONFIG } from '@/core/config/ddex';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { ReleaseAssets } from '../types/distributor';

/**
 * CD Baby Package Builder
 * Generates DDEX ERN packages formatted for CD Baby ingestion.
 * Convention: Folder named by UPC, containing Metadata.xml and Assets.
 */
export class CDBabyPackageBuilder {
    private stagingBaseDir: string;

    constructor(stagingDir?: string) {
        // Delay directory resolution to buildPackage to avoid eager fs/path usage
        this.stagingBaseDir = stagingDir || '';
    }

    /**
     * Build the complete delivery package for a release
     * CD Baby often prefers the folder name to be the UPC 
     */
    async buildPackage(
        metadata: ExtendedGoldenMetadata,
        assets: ReleaseAssets,
        releaseId: string
    ): Promise<{ packagePath: string; files: string[] }> {
        const fs = await import('fs');
        const path = await import('path');

        // Initialize staging dir if not set in constructor
        if (!this.stagingBaseDir) {
            this.stagingBaseDir = path.resolve(process.cwd(), 'ddex_staging', 'cdbaby');
        }
        if (!fs.existsSync(this.stagingBaseDir)) {
            fs.mkdirSync(this.stagingBaseDir, { recursive: true });
        }

        // 1. Create Release Folder (UPC is standard convention)
        const folderName = metadata.upc || metadata.catalogNumber || `REL-${releaseId}`;
        const packagePath = path.join(this.stagingBaseDir, folderName);

        if (fs.existsSync(packagePath)) {
            // Clean up existing folder if retrying
            fs.rmSync(packagePath, { recursive: true, force: true });
        }
        fs.mkdirSync(packagePath, { recursive: true });

        const packagedFiles: string[] = [];

        // 2. Generate and Write XML
        const xmlResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'cdbaby');

        if (!xmlResult.success || !xmlResult.xml) {
            throw new Error(`Failed to generate ERN for CD Baby: ${xmlResult.error}`);
        }

        const xmlPath = path.join(packagePath, 'Metadata.xml'); // UpperCamelCase often preferred
        fs.writeFileSync(xmlPath, xmlResult.xml);
        packagedFiles.push(xmlPath);

        // 3. Process Audio (Rename and Copy)
        // Convention: {ISRC}.wav or {TrackNumber}_{Title}.wav. 
        // Using {TrackNumber}_{Title}.wav for clarity similar to Symphonic unless specific CD Baby spec mandates otherwise.
        if (assets.audioFile && assets.audioFile.url) {
            const ext = path.extname(assets.audioFile.url) || '.wav';
            const safeTitle = metadata.trackTitle.replace(/[^a-zA-Z0-9]/g, '_');
            const audioFileName = `01_${safeTitle}${ext}`;
            const destAudioPath = path.join(packagePath, audioFileName);

            await this.copyAsset(assets.audioFile.url, destAudioPath);
            packagedFiles.push(destAudioPath);
        }

        // 4. Process Cover Art
        // Convention: {UPC}.jpg or Front.jpg
        if (assets.coverArt && assets.coverArt.url) {
            const ext = path.extname(assets.coverArt.url) || '.jpg';
            const coverFileName = `Front${ext}`; // UpperCamelCase
            const destCoverPath = path.join(packagePath, coverFileName);

            await this.copyAsset(assets.coverArt.url, destCoverPath);
            packagedFiles.push(destCoverPath);
        }

        console.info(`[CDBabyBuilder] Built package at ${packagePath} with ${packagedFiles.length} files.`);

        return { packagePath, files: packagedFiles };
    }

    /**
     * Helper to copy assets from source URL (file://) to destination
     */
    private async copyAsset(sourceUrl: string, destPath: string): Promise<void> {
        const fs = await import('fs');
        // Strip file:// prefix if present
        const sourcePath = sourceUrl.replace('file://', '');

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source asset not found: ${sourcePath}`);
        }

        fs.copyFileSync(sourcePath, destPath);
    }
}
