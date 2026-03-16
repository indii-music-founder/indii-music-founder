import { ipcMain, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DistributionStageReleaseSchema } from '../utils/validation';
import { validateSafeDistributionSource } from '../utils/security-checks';
import { validateSafeAudioPath } from '../utils/file-security';
import { validateSender } from '../utils/ipc-security';
import { validateSafeHostAsync } from '../utils/network-security';
import { accessControlService } from '../security/AccessControlService';
import { z } from 'zod';

import { PythonBridge } from '../utils/python-bridge';
import { AgentSupervisor } from '../utils/AgentSupervisor';

interface StagedFile {
    type: 'content' | 'path';
    data: string;
    name: string;
}

/**
 * Get the storage path for distribution data persistence.
 * Uses app.getPath('userData') in production, falls back to temp in dev.
 */
const getStoragePath = (): string => {
    try {
        return path.join(app.getPath('userData'), 'distribution');
    } catch {
        // Fallback for development/testing
        return path.join(os.tmpdir(), 'indiiOS-distribution');
    }
};

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
                    const rawPath = file.data.startsWith('file://') ? new URL(file.data).pathname : file.data;
                    const sourcePath = decodeURIComponent(rawPath);

                    // Security: Verify Access Authorization
                    if (!accessControlService.verifyAccess(sourcePath)) {
                        throw new Error(`Security Violation: Access to ${sourcePath} is denied. File was not authorized by user.`);
                    }

                    // Security Check: LFI Prevention
                    validateSafeDistributionSource(sourcePath);

                    await fs.copyFile(sourcePath, destPath);
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

    ipcMain.handle('distribution:run-forensics', async (event, filePath: string) => {
        try {
            validateSender(event);
            console.log(`[Distribution] Running audio forensics on: ${filePath}`);

            // Clean path
            const rawPath = filePath.startsWith('file://') ? new URL(filePath).pathname : filePath;
            const absolutePath = decodeURIComponent(rawPath);

            // Security check using audio handler logic
            validateSafeAudioPath(absolutePath);
            // SECURITY: Validate Path (Symlinks, System Roots, Hidden Files, Audio Extensions)
            const validatedPath = validateSafeAudioPath(absolutePath);

            // Execute Python Script
            const report = await AgentSupervisor.execute('audio', 'audio_forensics.py', [validatedPath], { timeoutMs: 60000 });
            return { success: true, report };

        } catch (error) {
            console.error('[Distribution] Forensics failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:package-itmsp', async (event, releaseId: string) => {
        try {
            validateSender(event);

            // Security: Validate releaseId to prevent path traversal
            if (!z.string().uuid().safeParse(releaseId).success) {
                throw new Error("Security Error: Invalid releaseId format. Must be a UUID.");
            }

            console.log(`[Distribution] Packaging ITMSP for release: ${releaseId}`);

            // Resolve the staging path (using the same logic as stage-release)
            const tempDir = os.tmpdir();
            const stagingPath = path.join(tempDir, 'indiiOS-releases', releaseId);

            // Execute Python Script
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'package_itmsp.py', [
                releaseId,
                stagingPath,
                '--storage-path',
                storagePath
            ], { timeoutMs: 120000 });

            return {
                success: report.status === 'PASS',
                itmspPath: report.bundle_path,
                message: report.details,
                error: report.status === 'FAIL' ? report.error : undefined
            };

        } catch (error) {
            console.error('[Distribution] Packaging failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:calculate-tax', async (event, data: any) => {
        try {
            validateSender(event);
            const { userId, amount } = data || {};
            if (!userId || amount === undefined) throw new Error('Missing userId or amount');
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'tax_withholding_engine.py', [
                'calculate',
                userId,
                String(amount),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 });
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:certify-tax', async (event, userId: string, data: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'tax_withholding_engine.py', [
                'certify',
                userId,
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [2]); // Redact JSON data
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:execute-waterfall', async (event, data: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('finance', 'waterfall_payout.py', [
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 60000 }, undefined, {}, [0]); // Redact JSON data
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:validate-metadata', async (event, metadata: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'qc_validator.py', [
                JSON.stringify(metadata),
                '--storage-path',
                storagePath
            ], { timeoutMs: 60000 }, undefined, {}, [0]); // Redact metadata
            return { success: report.valid, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-isrc', async (event, options?: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const args = ['generate_isrc'];
            let sensitiveIndices: number[] = [];
            if (options) {
                args.push(JSON.stringify(options));
                sensitiveIndices = [1];
            }
            args.push('--storage-path', storagePath);
            const report = await AgentSupervisor.execute('distribution', 'isrc_manager.py', args, { timeoutMs: 30000 }, undefined, {}, sensitiveIndices);
            return { success: true, isrc: report.isrc, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-content-id-csv', async (event, data: any) => {
        try {
            validateSender(event);
            // Script outputs CSV content to stdout if successful, or maybe a JSON object with location?
            // verify_all_scripts check suggests it prints the CSV or relevant info.
            // Let's assume it returns a JSON with the content or path, or we might need to adjust python script to match expectation.
            // verifying verify_all_scripts: it checks `assert "sound_recording" in res.stdout`
            // This implies the script might be dumping raw CSV to stdout?
            // DistributionService expects a report/result.
            // Let's rely on PythonBridge parsing JSON last line.
            // If the script dumps CSV, PythonBridge JSON parse will fail and return raw string.
            // We should ideally wrap the Python script output in JSON.
            // But for now, let's pass the raw string if it's CSV.
            const storagePath = getStoragePath();
            const result = await AgentSupervisor.execute('distribution', 'content_id_csv_generator.py', [
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [0]); // Redact JSON data

            // If result is a string (CSV content), wrap it. If it's an object (report), return it.
            if (typeof result === 'string') {
                return { success: true, csvData: result };
            }
            return { success: true, report: result };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-upc', async (event, options?: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const args = ['generate_upc'];
            let sensitiveIndices: number[] = [];
            if (options) {
                args.push(JSON.stringify(options));
                sensitiveIndices = [1];
            }
            args.push('--storage-path', storagePath);
            const report = await AgentSupervisor.execute('distribution', 'isrc_manager.py', args, { timeoutMs: 30000 }, undefined, {}, sensitiveIndices);
            return { success: process.env.NODE_ENV !== 'production' || !!report.upc, upc: report.upc, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:register-release', async (event, metadata: any, releaseId?: string) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const args = ['register', JSON.stringify(metadata)];
            const sensitiveIndices = [1];
            if (releaseId) args.push(releaseId);
            args.push('--storage-path', storagePath);
            const report = await AgentSupervisor.execute('distribution', 'isrc_manager.py', args, { timeoutMs: 30000 }, undefined, {}, sensitiveIndices);
            return { success: true, release: report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-ddex', async (event, metadata: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const result = await AgentSupervisor.execute('distribution', 'ddex_generator.py', [
                JSON.stringify(metadata),
                '--storage-path',
                storagePath
            ], { timeoutMs: 90000 }, undefined, {}, [0]); // Redact metadata
            // Enhanced ddex_generator returns JSON with xml field
            if (typeof result === 'object' && result.xml) {
                return { success: result.status === 'SUCCESS', xml: result.xml, report: result };
            }
            // Fallback for raw XML string
            return { success: true, xml: typeof result === 'string' ? result : JSON.stringify(result) };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-bwarm', async (event, data: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'keys_manager.py', [
                'bwarm',
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [1]); // Redact JSON data
            return { success: report.status === 'SUCCESS', csv: report.csv, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:check-merlin-status', async (event, data: any) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'keys_manager.py', [
                'merlin_check',
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [1]); // Redact JSON data
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    ipcMain.handle('distribution:transmit', async (event, config: any) => {
        try {
            validateSender(event);
            const { protocol, host, port, user, password, key, localPath, remotePath } = config;

            if (!host || !user || !localPath) {
                throw new Error('Missing required transmission configuration (host, user, or localPath)');
            }

            // Security: Validate host to prevent SSRF
            await validateSafeHostAsync(host);

            // Security: Verify Access Authorization for source path
            if (!accessControlService.verifyAccess(localPath)) {
                throw new Error(`Security Violation: Access to ${localPath} is denied. File was not authorized by user.`);
            }

            // Security: Validate source path
            validateSafeDistributionSource(localPath);

            // Security: If key is a path, validate it
            if (key && (key.includes('/') || key.includes('\\'))) {
                if (!accessControlService.verifyAccess(key)) {
                    throw new Error(`Security Violation: Access to key file ${key} is denied.`);
                }
                validateSafeDistributionSource(key, { allowKeys: true });
            }

            const storagePath = getStoragePath();
            const scriptName = (protocol === 'ASPERA') ? 'aspera_uploader.py' : 'sftp_uploader.py';

            // Security: Pass sensitive data via Environment Variables, NOT command line arguments.
            const env: NodeJS.ProcessEnv = {};
            if (protocol === 'ASPERA') {
                if (password) env.ASPERA_PASSWORD = password;
                if (key) env.ASPERA_KEY_PATH = key;
            } else {
                if (password) env.SFTP_PASSWORD = password;
                if (key) env.SFTP_KEY_PATH = key;
            }

            const args = [
                '--host', host,
                '--user', user,
                '--local', localPath,
                '--remote', remotePath || '.',
                '--storage-path', storagePath
            ];

            if (port) args.push('--port', String(port));
            // Note: Password/Key are now passed via env vars, not CLI args

            const report = await AgentSupervisor.execute(
                'distribution',
                scriptName,
                args,
                { timeoutMs: 300000, retries: 1 }, // 5 mins timeout for large uploads + retry
                (progress, log) => {
                    if (progress >= 0) {
                        event.sender.send('distribution:transmit-progress', { progress });
                    }
                    if (log) {
                        event.sender.send('distribution:transmit-progress', { log });
                    }
                },
                env // Pass the secure environment
            );
            return { success: report.status === 'SUCCESS', report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * End-to-end release submission:
     * QC validate → assign ISRCs → generate DDEX XML → SFTP upload
     * Progress events are streamed back as 'distribution:submit-progress'.
     */
    ipcMain.handle('distribution:submit-release', async (event, releaseData: any) => {
        try {
            validateSender(event);

            if (!releaseData || typeof releaseData !== 'object') {
                throw new Error('Missing or invalid release data');
            }

            const storagePath = getStoragePath();

            // Credentials for SFTP are injected via env vars, never CLI args
            const env: Record<string, string | undefined> = {};
            const sftpCfg = releaseData.sftpConfig;
            if (sftpCfg?.password) {
                env.SFTP_PASSWORD = sftpCfg.password;
                // Redact from the payload before passing to the script
                releaseData = { ...releaseData, sftpConfig: { ...sftpCfg, password: undefined } };
            }
            if (sftpCfg?.key) {
                env.SFTP_KEY_PATH = sftpCfg.key;
                releaseData = { ...releaseData, sftpConfig: { ...releaseData.sftpConfig, key: undefined } };
            }

            const result = await AgentSupervisor.execute(
                'distribution',
                'ddex_build.py',
                [JSON.stringify(releaseData), '--storage-path', storagePath],
                { timeoutMs: 300000 },  // 5 min for large releases
                (progress, log) => {
                    if (progress >= 0) {
                        event.sender.send('distribution:submit-progress', { progress });
                    }
                    if (log) {
                        // Forward structured step events to the renderer
                        try {
                            const parsed = JSON.parse(log);
                            event.sender.send('distribution:submit-progress', parsed);
                        } catch {
                            event.sender.send('distribution:submit-progress', { log });
                        }
                    }
                },
                env,
                [0]  // Redact release JSON (index 0) from logs
            );

            return { success: result.status === 'SUCCESS', report: result };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
};
