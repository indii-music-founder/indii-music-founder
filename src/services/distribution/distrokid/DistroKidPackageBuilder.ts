
import path from 'path';
import fs from 'fs';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseAssets } from '@/services/distribution/types/distributor';

export class DistroKidPackageBuilder {
    private stagingBaseDir: string;

    constructor() {
        // Use a temp directory for staging in Electron/Node environment
        this.stagingBaseDir = path.resolve(process.cwd(), 'distrokid_staging');
    }

    async buildPackage(
        metadata: ExtendedGoldenMetadata,
        assets: ReleaseAssets,
        releaseId: string
    ): Promise<{ packagePath: string }> {
        const packageDir = path.join(this.stagingBaseDir, releaseId);

        // Ensure directory exists
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
        }

        // 1. Generate Metadata CSV (DistroKid Bulk Format)
        const csvContent = this.generateCSV(metadata);
        fs.writeFileSync(path.join(packageDir, `${releaseId}_metadata.csv`), csvContent);

        // 2. Copy Assets
        if (assets.coverArt?.url) {
            await this.copyAsset(assets.coverArt.url, packageDir, 'cover.jpg');
        }

        if (assets.audioFile?.url) {
             // Single audio file
            await this.copyAsset(assets.audioFile.url, packageDir, 'audio.wav');
        } else if (assets.audioFiles) {
            // Multiple audio files
            for (let i = 0; i < assets.audioFiles.length; i++) {
                const audio = assets.audioFiles[i];
                if (audio.url) {
                    await this.copyAsset(audio.url, packageDir, `track_${i + 1}.wav`);
                }
            }
        }

        return { packagePath: packageDir };
    }

    private async copyAsset(sourcePath: string, destDir: string, destName: string): Promise<void> {
        const destPath = path.join(destDir, destName);

        // If it's a local file path
        if (fs.existsSync(sourcePath)) {
            try {
                fs.copyFileSync(sourcePath, destPath);
                console.log(`[DistroKid] Copied asset: ${sourcePath} -> ${destPath}`);
            } catch (err) {
                console.error(`[DistroKid] Failed to copy asset ${sourcePath}:`, err);
                throw err;
            }
        } else {
             // Handle cloud URLs or Blob URLs if possible, or just log for now if we can't download
             // In a real Electron app, we might download the URL to a file.
             // For "No-Mock", we should ideally support it, but downloading requires fetch and stream to FS.
             if (sourcePath.startsWith('http')) {
                 // TODO: Implement download for cloud assets
                 console.log(`[DistroKid] Skipping cloud asset download for now (No-Mock requires fs logic): ${sourcePath}`);
             } else {
                 console.warn(`[DistroKid] Asset source not found: ${sourcePath}`);
             }
        }
    }

    private generateCSV(metadata: ExtendedGoldenMetadata): string {
        // DistroKid CSV format including Explicit flag
        const headers = [
            'Artist Name', 'Release Title', 'Release Date', 'Spotify Artist URI',
            'Apple Artist ID', 'Genre', 'Subgenre', 'Label', 'UPC', 'ISRC',
            'Track Title', 'Track Version', 'Explicit'
        ];

        const row = [
            metadata.artistName,
            metadata.releaseTitle,
            metadata.releaseDate,
            '', // Spotify URI
            '', // Apple ID
            metadata.genre,
            metadata.subGenre || '',
            metadata.labelName || 'Independent',
            metadata.upc || '',
            metadata.isrc || '',
            metadata.trackTitle,
            '', // Version
            metadata.explicit ? 'Yes' : 'No'
        ];

        return `${headers.join(',')}\n${row.map(f => `"${f}"`).join(',')}`;
    }
}
