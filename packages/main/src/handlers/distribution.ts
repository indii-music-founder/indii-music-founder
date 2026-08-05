import log from 'electron-log';
import { ipcMain, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { DistributionStageReleaseSchema } from '../utils/validation';
import { validateSafeDistributionSource } from '../utils/security-checks';
import { validateSafeAudioPath } from '../utils/file-security';
import { validateSender } from '../utils/ipc-security';
import { validateSafeHostAsync } from '../utils/network-security';
import { accessControlService } from '../security/AccessControlService';
import { z } from 'zod';

import { AgentSupervisor } from '../utils/AgentSupervisor';
import { credentialService } from '../services/CredentialService';
import { authStorage } from '../services/AuthStorage';
import { stageCanonicalMasters } from '../services/MasterAudioStagingService';
import { stageCanonicalCoverArt } from '../services/CanonicalCoverArtStagingService';

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
        return path.join(os.tmpdir(), 'indii-distribution');
    }
};

export const setupDistributionHandlers = () => {
    ipcMain.handle('distribution:stage-release', async (event, releaseId: string, files: StagedFile[]) => {
        try {
            validateSender(event);
            // Validate inputs
            const validated = DistributionStageReleaseSchema.parse({ releaseId, files });

            const tempDir = os.tmpdir();
            const stagingPath = path.join(tempDir, 'indii-releases', validated.releaseId);
            const _resolvedStagingPath = path.resolve(stagingPath) + path.sep; // Ensure trailing slash for security check

            // cleaned up previous staging if exists
            try {
                await fs.rm(stagingPath, { recursive: true, force: true });
            } catch (_e) {
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
                    log.error(`[Distribution] Security Alert: Blocked path traversal attempt to ${destPath}`);
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

            log.info(`[Distribution] Staged release ${validated.releaseId} at ${stagingPath}`);
            return { success: true, packagePath: stagingPath, files: writtenFiles };

        } catch (error) {
            log.error('[Distribution] Stage release failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:run-forensics', async (event, filePath: string) => {
        try {
            validateSender(event);
            log.info(`[Distribution] Running audio forensics on: ${filePath}`);

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
            log.error('[Distribution] Forensics failed:', error);
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

            log.info(`[Distribution] Packaging ITMSP for release: ${releaseId}`);

            // Resolve the staging path (using the same logic as stage-release)
            const tempDir = os.tmpdir();
            const stagingPath = path.join(tempDir, 'indii-releases', releaseId);

            // Execute Python Script
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'package_itmsp.py', [
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
            log.error('[Distribution] Packaging failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:calculate-tax', async (event, data: Record<string, unknown>) => {
        try {
            validateSender(event);
            const { userId, amount } = data || {};
            const sessionUid = await authStorage.getAuthenticatedUserId();
            const effectiveUserId = sessionUid || userId;
            if (!effectiveUserId || amount === undefined) throw new Error('Missing userId or amount');
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'tax_withholding_engine.py', [
                'calculate',
                effectiveUserId as string,
                String(amount),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 });
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:certify-tax', async (event, userId: string, data: unknown) => {
        try {
            validateSender(event);
            const sessionUid = await authStorage.getAuthenticatedUserId();
            const effectiveUserId = sessionUid || userId;
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute('distribution', 'tax_withholding_engine.py', [
                'certify',
                effectiveUserId,
                JSON.stringify(data),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [2]); // Redact JSON data
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:execute-waterfall', async (event, data: unknown) => {
        try {
            validateSender(event);
            const report = await AgentSupervisor.execute('finance', 'waterfall_payout.py', [
                JSON.stringify(data)
            ], { timeoutMs: 60000 }, undefined, {}, [0]); // Redact JSON data
            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:validate-metadata', async (event, metadata: unknown) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'qc_validator.py', [
                JSON.stringify(metadata),
                '--storage-path',
                storagePath
            ], { timeoutMs: 60000 }, undefined, {}, [0]); // Redact metadata
            return { success: report.valid, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-isrc', async (event, options?: unknown) => {
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
            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'isrc_manager.py', args, { timeoutMs: 30000 }, undefined, {}, sensitiveIndices);
            return { success: true, isrc: report.isrc, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-content-id-csv', async (event, data: unknown) => {
        try {
            validateSender(event);
            // ISSUE-789: unwrap the script's structured JSON to the top-level
            // `csv` field the renderer (DistributionService.generateContentIdAssets)
            // actually reads, and surface RightsVerificationError messages
            // (ISSUE-786) as the returned error rather than a generic failure.
            const storagePath = getStoragePath();
            const result = await AgentSupervisor.execute<{ status?: string; csv?: string; recordCount?: number; error?: string }>(
                'distribution', 'content_id_csv_generator.py', [
                    JSON.stringify(data),
                    '--storage-path',
                    storagePath
                ], { timeoutMs: 30000 }, undefined, {}, [0]); // Redact JSON data

            if (typeof result !== 'object' || result === null) {
                throw new Error("Invalid output format: content_id_csv_generator.py must return structured JSON.");
            }
            if (result.status !== 'SUCCESS' || !result.csv) {
                return { success: false, error: result.error || 'Content ID CSV generation failed.' };
            }
            return { success: true, csv: result.csv, recordCount: result.recordCount, report: result };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:generate-upc', async (event, options?: unknown) => {
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
            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'isrc_manager.py', args, { timeoutMs: 30000 }, undefined, {}, sensitiveIndices);
            // ISSUE-1285: success must reflect whether a UPC was actually produced, in
            // every environment. This previously read `NODE_ENV !== 'production' || !!report.upc`,
            // so a dev/staging build reported success even when the generator returned no UPC —
            // the exact kind of failure that then "works in staging" and breaks in production.
            return { success: !!report.upc, upc: report.upc, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:register-release', async (event, metadata: unknown, releaseId?: string) => {
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

    ipcMain.handle('distribution:generate-ddex', async (event, metadata: unknown) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const result = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'ingestion_generator.py', [
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

    ipcMain.handle('distribution:generate-bwarm', async (event, data: unknown) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();
            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'keys_manager.py', [
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

    ipcMain.handle('distribution:check-merlin-status', async (event, data: unknown) => {
        try {
            validateSender(event);
            const storagePath = getStoragePath();

            // ISSUE-1122: Aggregate track-level data to flat shape for fail-closed verification
            // Input: { catalog_id, tracks: [{ isrc, title, rights_holder, exclusive_rights }, ...] }
            // Output: { total_tracks, has_isrcs, has_upcs, exclusive_rights }
            const dataObj = data as Record<string, unknown>;
            const tracks = Array.isArray(dataObj?.tracks) ? dataObj.tracks : [];
            const aggregatedData = {
                total_tracks: tracks.length,
                has_isrcs: tracks.some((t: Record<string, unknown>) => !!t.isrc),
                has_upcs: tracks.some((t: Record<string, unknown>) => !!t.upc),
                exclusive_rights: tracks.every((t: Record<string, unknown>) => t.exclusive_rights === true)
            };

            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'keys_manager.py', [
                'merlin_check',
                JSON.stringify(aggregatedData),
            // Transform input: handle both KeysPanel format {catalog_id, tracks:[]}
            // and DistributionTools format {total_tracks, has_isrcs, has_upcs, exclusive_rights}
            let pythonInput: Record<string, unknown>;
            const input = data as Record<string, unknown>;

            if (Array.isArray(input.tracks)) {
                // KeysPanel format: aggregate tracks array to flat format
                const tracks = input.tracks as Array<Record<string, unknown>>;
                const hasIsrcs = tracks.some(t => t.isrc);
                const hasUpcs = tracks.some(t => t.upc);
                const allExclusive = tracks.every(t => t.exclusive_rights !== false);
                pythonInput = {
                    total_tracks: tracks.length,
                    has_isrcs: hasIsrcs,
                    has_upcs: hasUpcs,
                    exclusive_rights: allExclusive
                };
            } else {
                // Already in flat format from DistributionTools
                pythonInput = {
                    total_tracks: input.total_tracks ?? 0,
                    has_isrcs: input.has_isrcs ?? false,
                    has_upcs: input.has_upcs ?? false,
                    exclusive_rights: input.exclusive_rights ?? false
                };
            }

            const pythonReport = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'keys_manager.py', [
                'merlin_check',
                JSON.stringify(pythonInput),
                '--storage-path',
                storagePath
            ], { timeoutMs: 30000 }, undefined, {}, [1]);

            // Transform output from Python {status, score, checks, timestamp}
            // to MerlinReport format {status, issues, passed_count, failed_count, timestamp}
            const checks = (pythonReport.checks as string[]) || [];
            const passedChecks = checks.filter(c => c.includes('✓') || c.includes('confirmed') || c.includes('assigned'));
            const failedChecks = checks.filter(c => !c.includes('✓') && !c.includes('confirmed'));

            const report = {
                status: pythonReport.status === 'READY' ? 'READY' : 'NOT_READY',
                issues: checks,
                passed_count: passedChecks.length,
                failed_count: failedChecks.length,
                timestamp: pythonReport.timestamp || new Date().toISOString()
            };

            return { success: true, report };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    ipcMain.handle('distribution:transmit', async (event, config: Record<string, unknown>) => {
        try {
            validateSender(event);
            const { protocol, host, user, password, key, localPath, remotePath } = config as Record<string, string | undefined>;
            const port = config.port as string | number | undefined;

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

            // Security: Provide credentials dynamically from CredentialService
            let runtimePassword = password;
            const runtimeKey = key;
            const distributorId = config.distributorId as string | undefined;

            if (distributorId) {
                const creds = await credentialService.getCredentials(distributorId);
                if (creds) {
                    if (!runtimePassword) runtimePassword = creds.sftpPassword || creds.password;
                }
            }

            const env: NodeJS.ProcessEnv = {};
            if (protocol === 'ASPERA') {
                if (runtimePassword) env.ASPERA_PASSWORD = runtimePassword;
                if (runtimeKey) env.ASPERA_KEY_PATH = runtimeKey;
            } else {
                if (runtimePassword) env.SFTP_PASSWORD = runtimePassword;
                if (runtimeKey) env.SFTP_KEY_PATH = runtimeKey;
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

            const report = await AgentSupervisor.execute<Record<string, unknown>>(
                'distribution',
                scriptName,
                args,
                { timeoutMs: 300000, retries: 1 }, // 5 mins timeout for large uploads + retry
                (progress, log) => {
                    if (progress >= 0 && !event.sender.isDestroyed()) {
                        event.sender.send('distribution:transmit-progress', { progress });
                    }
                    if (log && !event.sender.isDestroyed()) {
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
    ipcMain.handle('distribution:submit-release', async (event, releaseData: Record<string, unknown>) => {
        let cleanupStagedMasters: (() => Promise<void>) | undefined;
        let cleanupStagedCover: (() => Promise<void>) | undefined;
        try {
            validateSender(event);

            if (!releaseData || typeof releaseData !== 'object') {
                throw new Error('Missing or invalid release data');
            }

            const stagedMasters = await stageCanonicalMasters(releaseData);
            cleanupStagedMasters = stagedMasters.cleanup;
            const stagedCover = await stageCanonicalCoverArt(releaseData.cover_asset);
            cleanupStagedCover = stagedCover.cleanup;
            releaseData = { ...stagedMasters.releaseData, cover_asset: stagedCover.coverAsset };

            const storagePath = getStoragePath();

            // Security: Resolve credentials dynamically via CredentialService
            const env: Record<string, string | undefined> = {};
            let sftpCfg = releaseData.sftpConfig as Record<string, string | undefined> | undefined;
            const distributorId = releaseData.distributorId as string | undefined;

            if (distributorId) {
                const secureCreds = await credentialService.getCredentials(distributorId);
                if (secureCreds && (secureCreds.sftpPassword || secureCreds.password)) {
                    env.SFTP_PASSWORD = secureCreds.sftpPassword || secureCreds.password;
                    // Inject connection meta if missing
                    if (!sftpCfg) {
                        sftpCfg = {};
                        releaseData.sftpConfig = sftpCfg;
                    }
                    if (!sftpCfg.host) sftpCfg.host = secureCreds.sftpHost;
                    if (!sftpCfg.user) sftpCfg.user = secureCreds.sftpUsername || secureCreds.username;
                }
            }

            if (sftpCfg?.password) {
                // If the UI still passed a password (e.g. for testing), use it but redact it
                if (!env.SFTP_PASSWORD) env.SFTP_PASSWORD = sftpCfg.password;
                releaseData = { ...releaseData, sftpConfig: { ...sftpCfg, password: undefined } };
            }
            if (sftpCfg?.key) {
                env.SFTP_KEY_PATH = sftpCfg.key;
                // @ts-expect-error - safe cloning of releaseData with key removed
                releaseData = { ...releaseData, sftpConfig: { ...releaseData.sftpConfig, key: undefined } };
            }

            const result = await AgentSupervisor.execute<Record<string, unknown>>(
                'distribution',
                // ISSUE-968: this pointed at 'ddex_build.py', which has never existed —
                // every desktop submission failed with a missing-file error before
                // reaching QC/ISRC/DDEX at all. ingestion_build.py is the actual
                // end-to-end orchestrator (QC -> ISRC -> DDEX ERN XML -> SFTP) and
                // accepts this exact <release_json> [--storage-path PATH] signature.
                'ingestion_build.py',
                [JSON.stringify(releaseData), '--storage-path', storagePath],
                { timeoutMs: 300000 },  // 5 min for large releases
                (progress, log) => {
                    if (progress >= 0 && !event.sender.isDestroyed()) {
                        event.sender.send('distribution:submit-progress', { progress });
                    }
                    if (log && !event.sender.isDestroyed()) {
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
        } finally {
            if (cleanupStagedMasters) {
                try {
                    await cleanupStagedMasters();
                } catch (cleanupError) {
                    log.warn('[Distribution] Failed to clean canonical master staging directory:', cleanupError);
                }
            }
            if (cleanupStagedCover) {
                try {
                    await cleanupStagedCover();
                } catch (cleanupError) {
                    log.warn('[Distribution] Failed to clean canonical cover staging directory:', cleanupError);
                }
            }
        }
    });

    ipcMain.handle('distribution:package-spotify', async (event, releaseId: string, stagingPath: string, outputPath?: string) => {
        try {
            validateSender(event);

            // Security: Validate releaseId to prevent path traversal
            if (!z.string().uuid().safeParse(releaseId).success) {
                throw new Error("Security Error: Invalid releaseId format. Must be a UUID.");
            }

            // Security: Validate stagingPath and outputPath
            if (stagingPath.includes('..') || (outputPath && outputPath.includes('..'))) {
                throw new Error("Security Error: Path traversal detected in arguments.");
            }

            log.info(`[Distribution] Packaging Spotify release: ${releaseId} from ${stagingPath}`);

            const storagePath = getStoragePath();
            const args = [releaseId, stagingPath];
            if (outputPath) {
                args.push('--output', outputPath);
            }
            args.push('--storage-path', storagePath);

            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'package_spotify.py', args, { timeoutMs: 120000 });

            return {
                success: report.status === 'PASS',
                batchId: report.batch_id,
                packagePath: report.package_path,
                files: report.files,
                message: report.details,
                error: report.status === 'FAIL' ? report.error : undefined
            };
        } catch (error) {
            log.error('[Distribution] Spotify packaging failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:deliver-apple', async (event, command: string, bundlePath: string) => {
        try {
            validateSender(event);

            if (!['upload', 'verify', 'status'].includes(command)) {
                throw new Error(`Invalid deliver-apple command: ${command}`);
            }

            // Security: Validate path traversal
            if (bundlePath.includes('..')) {
                throw new Error("Security Error: Path traversal detected in arguments.");
            }

            log.info(`[Distribution] Apple Transporter: ${command} on ${bundlePath}`);

            const args: string[] = [command];
            if (command === 'status') {
                args.push('--vendor-id', bundlePath);
            } else {
                args.push(bundlePath);
            }

            const storagePath = getStoragePath();
            args.push('--storage-path', storagePath);

            // Read secure credentials dynamically from CredentialService or env
            const env: NodeJS.ProcessEnv = {};
            const appleCreds = await credentialService.getCredentials('apple');
            if (appleCreds) {
                if (appleCreds.username) env.APPLE_TRANSPORTER_USER = appleCreds.username;
                if (appleCreds.password) env.APPLE_TRANSPORTER_PASSWORD = appleCreds.password;
                if (appleCreds.providerId) env.APPLE_PROVIDER_ID = appleCreds.providerId;
            }

            // Also fallback to existing env keys if present in process.env
            if (!env.APPLE_TRANSPORTER_USER && process.env.APPLE_TRANSPORTER_USER) {
                env.APPLE_TRANSPORTER_USER = process.env.APPLE_TRANSPORTER_USER;
            }
            if (!env.APPLE_TRANSPORTER_PASSWORD && process.env.APPLE_TRANSPORTER_PASSWORD) {
                env.APPLE_TRANSPORTER_PASSWORD = process.env.APPLE_TRANSPORTER_PASSWORD;
            }
            if (!env.APPLE_PROVIDER_ID && process.env.APPLE_PROVIDER_ID) {
                env.APPLE_PROVIDER_ID = process.env.APPLE_PROVIDER_ID;
            }

            const report = await AgentSupervisor.execute<Record<string, unknown>>(
                'distribution',
                'deliver_apple.py',
                args,
                { timeoutMs: 300000 },
                undefined,
                env
            );

            return {
                success: report.status === 'SUCCESS',
                exitCode: report.exit_code,
                output: report.output,
                message: report.error || report.summary || 'Apple delivery execution completed.',
                error: report.status === 'FAIL' ? report.error : undefined
            };
        } catch (error) {
            log.error('[Distribution] Apple Transporter failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('distribution:validate-xsd', async (event, xmlContent: string) => {
        try {
            validateSender(event);

            log.info('[Distribution] Validating Proprietary Ingestion IP XML against XSD');

            // Write to a temporary file for safety and robustness
            const tempFile = path.join(os.tmpdir(), `xsd-validation-${crypto.randomUUID()}.xml`);
            await fs.writeFile(tempFile, xmlContent, 'utf-8');

            const report = await AgentSupervisor.execute<Record<string, unknown>>('distribution', 'xsd_validator.py', [
                tempFile,
                '--require-xsd'
            ], { timeoutMs: 30000 });

            // Clean up temp file
            try {
                await fs.unlink(tempFile);
            } catch (_e) {
                // ignore
            }

            return {
                success: report.valid === true && report.mode === 'xsd',
                report
            };
        } catch (error) {
            log.error('[Distribution] XSD validation failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
};
