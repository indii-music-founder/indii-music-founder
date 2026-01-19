import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

export class PythonBridge {
    private static getPythonPath(): string {
        // In production, we might bundle a python runtime or expect one
        // For now, assume 'python3' is in PATH
        return 'python3';
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
            if (sensitiveFlags.includes(redacted[i])) {
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
        onProgress?: (progress: number, log?: string) => void,
        env: NodeJS.ProcessEnv = {}
        env: Record<string, string> = {}
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const python = this.getPythonPath();
            // Construct path: execution/<category>/<scriptName>
            const fullScriptPath = path.join(this.getScriptPath(path.join(category, scriptName)));

            console.log(`[PythonBridge] Executing: ${python} ${fullScriptPath} ${this.redactArgs(args)}`);

            // Redact sensitive args for logging
            const redactedArgs = args.map((arg, index) => {
                const prev = args[index - 1];
                if (prev && (prev === '--password' || prev === '--key')) {
                    return '********';
                }
                return arg;
            });
            const sensitiveFlags = ['--password', '--key', '--access-token', '--refresh-token', '--api-key', '--secret'];
            const redactedArgs = args.map((arg, index) => {
                // Check if the PREVIOUS argument was a sensitive flag
                if (index > 0 && sensitiveFlags.includes(args[index - 1])) {
                    return '[REDACTED]';
                }
                return arg;
            });

            console.log(`[PythonBridge] Executing: ${python} ${fullScriptPath} ${redactedArgs.join(' ')}`);

            console.log(`[PythonBridge] Executing: ${python} ${fullScriptPath} ${redactedArgs.join(' ')}`);

            const childProcess = spawn(python, [fullScriptPath, ...args], {
                env: { ...process.env, ...env }
            });

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
                                onProgress(parseFloat(match[1]));
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
                    console.error(`[PythonBridge] Script failed with code ${code}. Stderr: ${stderr}`);
                    return reject(new Error(`Python script execution failed: ${stderr || 'Unknown error'}`));
                }

                try {
                    // Try to parse the last line as JSON, as our scripts print the result at the end
                    const lines = stdout.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const result = JSON.parse(lastLine);
                    resolve(result);
                } catch (e) {
                    // If not JSON, return full stdout
                    console.warn('[PythonBridge] Could not parse output as JSON, returning raw string.');
                    resolve(stdout);
                }
            });

            childProcess.on('error', (err) => {
                reject(err);
            });
        });
    }
}
