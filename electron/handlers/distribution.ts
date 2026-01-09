import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DistributionStageReleaseSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';

interface StagedFile {
    type: 'content' | 'path';
    data: string;
    name: string;
}

export const setupDistributionHandlers = () => {
    ipcMain.handle('distribution:stage-release', async (event, releaseId: string, files: StagedFile[]) => {
        try {
            validateSender(event);
            // Validate inputs
            const validated = DistributionStageReleaseSchema.parse({ releaseId, files });

            const tempDir = os.tmpdir();
            const stagingPath = path.join(tempDir, 'indiiOS-releases', validated.releaseId);
            const resolvedStagingPath = path.resolve(stagingPath) + path.sep; // Ensure trailing slash for security check

            // cleaned up previous staging if exists
            try {
                await fs.rm(stagingPath, { recursive: true, force: true });
            } catch (e) {
                // ignore
            }

            await fs.mkdir(stagingPath, { recursive: true });

            const writtenFiles: string[] = [];
            const safeStagingPath = path.resolve(stagingPath) + path.sep;

            for (const file of validated.files) {
                const destPath = path.resolve(stagingPath, file.name);

                // Security Check: Path Traversal
                // Ensure the resolved destination path starts with the safe staging directory
                if (!destPath.startsWith(safeStagingPath)) {
                    console.error(`[Distribution] Security Alert: Blocked path traversal attempt to ${destPath}`);
                    throw new Error(`Security Error: Invalid file path "${file.name}" (Path Traversal Detected)`);
                }

                if (file.type === 'content') {
                    // Ensure subdirectories exist if filename implies them (e.g. "subdir/file.txt")
                    const dirName = path.dirname(destPath);
                    if (dirName !== stagingPath) {
                        await fs.mkdir(dirName, { recursive: true });
                    }
                    await fs.writeFile(destPath, file.data, 'utf-8');
                } else if (file.type === 'path') {
                    // Ensure subdirectories exist
                    const dirName = path.dirname(destPath);
                    if (dirName !== stagingPath) {
                        await fs.mkdir(dirName, { recursive: true });
                    }

                    // Handle file:// protocol if present
                    const sourcePath = file.data.startsWith('file://') ? new URL(file.data).pathname : file.data;
                    await fs.copyFile(decodeURIComponent(sourcePath), destPath);
                }
                writtenFiles.push(file.name);
            }

            console.info(`[Distribution] Staged release ${validated.releaseId} at ${stagingPath}`);
            return { success: true, packagePath: stagingPath, files: writtenFiles };

        } catch (error) {
            console.error('[Distribution] Stage release failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
};
