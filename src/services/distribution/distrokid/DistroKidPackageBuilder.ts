import * as fs from 'fs';
import * as path from 'path';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { ReleaseAssets } from '@/services/distribution/types/distributor';

/**
 * DistroKid Package Builder
 * Generates a folder compatible with manual/bulk DistroKid upload flows.
 * - metadata.csv (mapped to DK columns)
 * - Organized Assets
 */
export class DistroKidPackageBuilder {
    private stagingBaseDir: string;

    constructor(stagingDir?: string) {
        this.stagingBaseDir = stagingDir || path.resolve(process.cwd(), 'distrokid_staging');
        if (!fs.existsSync(this.stagingBaseDir)) {
            fs.mkdirSync(this.stagingBaseDir, { recursive: true });
        }
    }

    async buildPackage(
        metadata: ExtendedGoldenMetadata,
        assets: ReleaseAssets,
        releaseId: string
    ): Promise<{ packagePath: string; files: string[] }> {
        // 1. Create Release Folder
        const safeTitle = metadata.trackTitle.replace(/[^a-zA-Z0-9]/g, '_');
        const folderName = `DK_${safeTitle}_${Date.now()}`;
        const packagePath = path.join(this.stagingBaseDir, folderName);
        fs.mkdirSync(packagePath, { recursive: true });

        const packagedFiles: string[] = [];

        // 2. Generate CSV Content
        // Mapping GoldenMetadata to likely DistroKid CSV columns (Hypothetical but realistic)
        const csvHeader = [
            'Artist Name',
            'Release Title',
            'Release Date',
            'Record Label',
            'UPC',
            'Primary Genre',
            'Secondary Genre',
            'Language',
            'Track Title',
            'ISRC',
            'Explicit'
        ].join(',');

        const csvRow = [
            `"${metadata.artistName}"`, // Quote to handle commas
            `"${metadata.releaseTitle || metadata.trackTitle}"`,
            `"${metadata.releaseDate}"`,
            `"${metadata.labelName}"`,
            `"${metadata.upc || ''}"`,
            `"${metadata.genre}"`,
            `"${metadata.subGenre || ''}"`,
            `"${metadata.language || 'English'}"`,
            `"${metadata.trackTitle}"`,
            `"${metadata.isrc || ''}"`,
            `"${metadata.explicit ? 'Yes' : 'No'}"`
        ].join(',');

        const csvPath = path.join(packagePath, 'metadata.csv');
        fs.writeFileSync(csvPath, `${csvHeader}\n${csvRow}`);
        packagedFiles.push(csvPath);

        // 3. Copy Assets
        if (assets.audioFile && assets.audioFile.url) {
            const ext = path.extname(assets.audioFile.url) || '.wav';
            const destAudioPath = path.join(packagePath, `01 - ${safeTitle}${ext}`);
            await this.copyAsset(assets.audioFile.url, destAudioPath);
            packagedFiles.push(destAudioPath);
        }

        if (assets.coverArt && assets.coverArt.url) {
            const ext = path.extname(assets.coverArt.url) || '.jpg';
            const destCoverPath = path.join(packagePath, `cover${ext}`);
            await this.copyAsset(assets.coverArt.url, destCoverPath);
            packagedFiles.push(destCoverPath);
        }

        console.log(`[DistroKidBuilder] Built package: ${packagePath}`);
        return { packagePath, files: packagedFiles };
    }

    private async copyAsset(sourceUrl: string, destPath: string): Promise<void> {
        const sourcePath = sourceUrl.replace('file://', '');
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Asset not found: ${sourcePath}`);
        }
        fs.copyFileSync(sourcePath, destPath);
    }
}
