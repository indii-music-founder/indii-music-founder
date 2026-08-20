import log from 'electron-log';
import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

export interface ScanResult {
    success: boolean;
    files?: string[];
    directories?: string[];
    message?: string;
    [key: string]: unknown;
}

export interface KnowledgeUpdateResult {
    success: boolean;
    message?: string;
    [key: string]: unknown;
}

export class FoundationalSkillService {
    private agentsRoot: string;

    constructor() {
        // Resolve agents path dynamically for dev vs prod (packaged app)
        const isPackaged = app ? app.isPackaged : false;
        if (isPackaged && app) {
            this.agentsRoot = path.join(process.resourcesPath, 'agents');
        } else {
            this.agentsRoot = path.join(process.cwd(), 'agents');
        }
    }

    async scanDirectory(): Promise<ScanResult> {
        const scriptPath = path.join(this.agentsRoot, 'foundational/audit_skill/tools/scan_directory.py');
        const res = await this.runPythonScript(scriptPath, ['--root', this.agentsRoot]);
        return res as ScanResult;
    }

    async updateKnowledge(filePath: string, action: 'add' | 'remove', content: string): Promise<KnowledgeUpdateResult> {
        const scriptPath = path.join(this.agentsRoot, 'foundational/memory_skill/tools/update_knowledge.py');
        const res = await this.runPythonScript(scriptPath, [
            '--file_path', filePath,
            '--action', action,
            '--content', content
        ]);
        return res as KnowledgeUpdateResult;
    }

    private runPythonScript(scriptPath: string, args: string[]): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            log.info(`[FoundationalService] Running script: ${scriptPath} with args: ${args.join(' ')}`);

            // python3 can be missing (packaged Windows, macOS without CLT) and
            // scripts can hang. Without an 'error' listener the spawn failure
            // is swallowed by the global handler and 'close' NEVER fires —
            // the IPC invoke() hangs forever. A timeout kills hung scripts.
            const timeoutMs = 120_000;
            let settled = false;
            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                fn();
            };

            const pythonProcess = spawn('python3', [scriptPath, ...args]);
            const timeout = setTimeout(() => {
                log.error(`[FoundationalService] Script timed out after ${timeoutMs / 1000}s — killing: ${scriptPath}`);
                pythonProcess.kill('SIGKILL');
                settle(() => reject(new Error(`Python script timed out after ${timeoutMs / 1000}s.`)));
            }, timeoutMs);

            pythonProcess.on('error', (err) => {
                log.error(`[FoundationalService] Failed to spawn python3 for ${scriptPath}:`, err);
                settle(() => reject(err));
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Check if output is JSON
                        if (stdout.trim().startsWith('{') || stdout.trim().startsWith('[')) {
                            settle(() => resolve(JSON.parse(stdout) as Record<string, unknown>));
                        } else {
                            settle(() => resolve({ success: true, message: stdout.trim() }));
                        }
                    } catch (e) {
                        log.warn(`[FoundationalService] JSON parse failed, returning raw string. Error:`, e);
                        settle(() => resolve({ success: true, message: stdout.trim() }));
                    }
                } else {
                    log.error(`[FoundationalService] Script failed with code ${code}. Stderr: ${stderr}`);
                    settle(() => reject(new Error(stderr || `Script exited with code ${code}`)));
                }
            });
        });
    }
}

export const foundationalSkillService = new FoundationalSkillService();

