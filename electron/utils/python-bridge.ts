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

    static async runScript(category: string, scriptName: string, args: string[] = [], onProgress?: (progress: number) => void): Promise<any> {
        return new Promise((resolve, reject) => {
            const python = this.getPythonPath();
            // Construct path: execution/<category>/<scriptName>
            const fullScriptPath = path.join(this.getScriptPath(path.join(category, scriptName)));

            console.log(`[PythonBridge] Executing: ${python} ${fullScriptPath} ${args.join(' ')}`);

            const process = spawn(python, [fullScriptPath, ...args]);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;

                if (onProgress) {
                    // Check for progress pattern PROGRESS:XX.XX
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.includes('PROGRESS:')) {
                            const match = line.match(/PROGRESS:(\d+\.?\d*)/);
                            if (match && match[1]) {
                                onProgress(parseFloat(match[1]));
                            }
                        }
                    }
                }
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
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

            process.on('error', (err) => {
                reject(err);
            });
        });
    }
}
