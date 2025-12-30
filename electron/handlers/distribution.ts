import { ipcMain } from 'electron';
import { CDBabyPackageBuilder } from '../../src/services/distribution/cdbaby/CDBabyPackageBuilder';
import { SymphonicPackageBuilder } from '../../src/services/distribution/symphonic/SymphonicPackageBuilder';
// DistroKid builder is dynamically imported in the original code, we can import it statically here for the main process
// assuming it exists at ../../src/services/distribution/distrokid/DistroKidPackageBuilder
// If it was dynamic for some reason (maybe missing?), we should check. But for now I will assume it exists.
// Actually, earlier view showed it was imported from ../distrokid/DistroKidPackageBuilder in the adapter.
import { DistroKidPackageBuilder } from '../../src/services/distribution/distrokid/DistroKidPackageBuilder';

export function registerDistributionHandlers() {
    ipcMain.handle('distribution:build-package', async (event, distributorId: string, metadata: any, assets: any, releaseId: string) => {
        console.log(`[Main] Building package for ${distributorId}...`);
        try {
            let builder;
            switch (distributorId) {
                case 'cdbaby':
                    builder = new CDBabyPackageBuilder();
                    break;
                case 'symphonic':
                    builder = new SymphonicPackageBuilder();
                    break;
                case 'distrokid':
                    builder = new DistroKidPackageBuilder();
                    break;
                default:
                    throw new Error(`Unknown distributor ID: ${distributorId}`);
            }

            const result = await builder.buildPackage(metadata, assets, releaseId);
            return { success: true, packagePath: result.packagePath, files: result.files };
        } catch (error: any) {
            console.error(`[Main] Failed to build package for ${distributorId}:`, error);
            return { success: false, error: error.message };
        }
    });
}
