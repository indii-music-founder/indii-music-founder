import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export class PythonBridge {
    private static getPythonPath(): string {
        if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
        if (process.env.PYTHON_CMD) return process.env.PYTHON_CMD;
        
        // Dynamically detect python executable
        try {
            const py3 = spawnSync('python3', ['--version'], { stdio: 'ignore' });
            if (py3.status === 0) return 'python3';
        } catch (_e) {
            // fallback to python
        }
        
        return 'python';
    }

    private static getScriptPath(scriptName: string): string {
        // Scripts are located in the 'execution' folder in the project root during dev
        // In production, they should be copied to resources using extraResources
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'execution', scriptName);
        }
        return path.join(process.cwd(), 'execution', scriptName);
    }

    private static redactArgs(args: string[]): string {
        const sensitiveFlags = ['--password', '--key', '--token', '-p', '--api-key'];
        const redacted = [...args];
        for (let i = 0; i < redacted.length; i++) {
            if (sensitiveFlags.includes(redacted[i]!)) {
                if (i + 1 < redacted.length) {
                    redacted[i + 1] = '[REDACTED]';
                }
            }
        }
        return redacted.join(' ');
    }

    static async runScript(
        category: string,
        scriptName: string,
        args: string[] = [],
        onProgress?: (progress: number, logLine?: string) => void,
        env: NodeJS.ProcessEnv = {},
        sensitiveArgsIndices: number[] = [],
        signal?: AbortSignal
    ): Promise<unknown> {
        return new Promise((resolve, reject) => {
            // Validate category and scriptName segments (ISSUE-382)
            const segmentRegex = /^[a-zA-Z0-9_-]+$/;
            const filenameRegex = /^[a-zA-Z0-9_.-]+$/;

            if (!segmentRegex.test(category)) {
                return reject(new Error(`Invalid category: ${category}`));
            }
            if (!filenameRegex.test(scriptName)) {
                return reject(new Error(`Invalid script name: ${scriptName}`));
            }

            const baseDir = path.resolve(this.getScriptPath(''));
            const fullScriptPath = path.resolve(this.getScriptPath(path.join(category, scriptName)));

            if (!fullScriptPath.startsWith(baseDir + path.sep)) {
                return reject(new Error('Path traversal detected'));
            }

            const python = this.getPythonPath();

            // Redact sensitive args for logging
            const sensitiveFlags = ['--password', '--key', '--access-token', '--refresh-token', '--api-key', '--secret'];
            const redactedArgs = args.map((arg, index) => {
                // Explicitly sensitive argument by index
                if (sensitiveArgsIndices.includes(index)) {
                    return '[REDACTED]';
                }
                // Check if the PREVIOUS argument was a sensitive flag
                if (index > 0 && sensitiveFlags.includes(args[index - 1]!)) {
                    return '[REDACTED]';
                }
                return arg;
            });

            log.info(`[PythonBridge] Executing: ${python} ${fullScriptPath} ${redactedArgs.join(' ')}`);

            const childProcess = spawn(python, [fullScriptPath, ...args], {
                env: { ...process.env, ...env }
            });

            if (signal) {
                signal.addEventListener('abort', () => {
                    log.warn(`[PythonBridge] Abort signal received. Force killing child process ${childProcess.pid}`);
                    // Use SIGKILL to prevent orphaned processes if SIGTERM is ignored
                    childProcess.kill('SIGKILL');
                });
            }

            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;

                // Real-time progress parsing
                if (onProgress) {
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.includes('PROGRESS:')) {
                            const match = line.match(/PROGRESS:(\d+\.?\d*)/);
                            if (match) {
                                onProgress(parseFloat(match[1]!));
                            }
                        } else if (line.trim() && !line.startsWith('{')) {
                            // If it's a log line but not the final JSON result, pass it as a log
                            onProgress(-1, line.trim());
                        }
                    }
                }
            });

            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                if (code !== 0) {
                    log.error(`[PythonBridge] Script failed with code ${code}. Stderr: ${stderr}`);
                    return reject(new Error(`Python script execution failed: ${stderr || 'Unknown error'}`));
                }

                try {
                    // Try to parse the last line as JSON, as our scripts print the result at the end
                    const lines = stdout.trim().split('\n');
                    const lastLine = lines[lines.length - 1]!;
                    const result = JSON.parse(lastLine);
                    resolve(result);
                } catch (_e) {
                    // If not JSON, return full stdout
                    log.warn('[PythonBridge] Could not parse output as JSON, returning raw string.');
                    resolve(stdout);
                }
            });

            childProcess.on('error', (err) => {
                reject(err);
            });
        });
    }
}
