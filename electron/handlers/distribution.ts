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

            for (const file of files) {
                const destPath = path.resolve(stagingPath, file.name);

                // Security Check: Prevent Path Traversal
                // Ensure the resolved destination path starts with the safe staging directory
                if (!destPath.startsWith(safeStagingPath)) {
                    console.error(`[Distribution] Security Alert: Blocked path traversal attempt to ${destPath}`);
                    throw new Error(`Security Error: Invalid file path "${file.name}" (Path Traversal Detected)`);
                // Security: Prevent Path Traversal
                // Resolve the destination path relative to the current working directory?
                // No, path.join resolves relative to stagingPath, but ".." components are processed.
                // We must check the final resolved path.
                const destPath = path.resolve(stagingPath, file.name);

                if (!destPath.startsWith(resolvedStagingPath)) {
                    console.error(`[Security] Blocked path traversal attempt: ${file.name} -> ${destPath}`);
                    throw new Error(`Security Violation: Invalid file path ${file.name}`);
                const destPath = path.resolve(stagingPath, file.name);

                // Security Check: Path Traversal Prevention
                if (!destPath.startsWith(path.resolve(stagingPath))) {
                    console.error(`[Distribution] Path traversal attempt detected: ${file.name}`);
                    throw new Error(`Security Error: Invalid file path ${file.name}`);
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

            console.info(`[Distribution] Staged release ${releaseId} at ${stagingPath}`);
            return { success: true, packagePath: stagingPath, files: writtenFiles };

        } catch (error) {
            console.error('[Distribution] Stage release failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
};
