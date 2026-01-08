import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface StagedFile {
    type: 'content' | 'path';
    data: string;
    name: string;
}

export const setupDistributionHandlers = () => {
    ipcMain.handle('distribution:stage-release', async (_, releaseId: string, files: StagedFile[]) => {
        try {
            const tempDir = os.tmpdir();
            const stagingPath = path.join(tempDir, 'indiiOS-releases', releaseId);

            // cleaned up previous staging if exists
            try {
                await fs.rm(stagingPath, { recursive: true, force: true });
            } catch (e) {
                // ignore
            }

            await fs.mkdir(stagingPath, { recursive: true });

            const writtenFiles: string[] = [];

            for (const file of files) {
                const destPath = path.resolve(stagingPath, file.name);

                // Security Check: Path Traversal Prevention
                if (!destPath.startsWith(path.resolve(stagingPath))) {
                    console.error(`[Distribution] Path traversal attempt detected: ${file.name}`);
                    throw new Error(`Security Error: Invalid file path ${file.name}`);
                }

                if (file.type === 'content') {
                    await fs.writeFile(destPath, file.data, 'utf-8');
                } else if (file.type === 'path') {
                    // Handle file:// protocol if present
                    const sourcePath = file.data.startsWith('file://') ? new URL(file.data).pathname : file.data;
                    await fs.copyFile(decodeURIComponent(sourcePath), destPath);
                }
                writtenFiles.push(file.name);
            }

            console.info(`[Distribution] Staged release ${releaseId} at ${stagingPath}`);
            return { success: true, packagePath: stagingPath, files: writtenFiles };

        } catch (error) {
            console.error('[Distribution] Stage release failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
};
