import log from 'electron-log';
import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

export class FoundationalSkillService {
    private agentsRoot: string;

    constructor() {
        // Assume agents are in the root of the project
        // In dev, this is process.cwd() / agents
        // In prod, we might need a different path
        this.agentsRoot = path.join(process.cwd(), 'agents');
    }

    async scanDirectory(): Promise<any> {
        const scriptPath = path.join(this.agentsRoot, 'foundational/audit_skill/tools/scan_directory.py');
        return this.runPythonScript(scriptPath, ['--root', this.agentsRoot]);
    }

    async updateKnowledge(filePath: string, action: 'add' | 'remove', content: string): Promise<any> {
        const scriptPath = path.join(this.agentsRoot, 'foundational/memory_skill/tools/update_knowledge.py');
        return this.runPythonScript(scriptPath, [
            '--file_path', filePath,
            '--action', action,
            '--content', content
        ]);
    }

    private runPythonScript(scriptPath: string, args: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            log.info(`[FoundationalService] Running script: ${scriptPath} with args: ${args.join(' ')}`);
            
            const pythonProcess = spawn('python3', [scriptPath, ...args]);
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
                            resolve(JSON.parse(stdout));
                        } else {
                            resolve({ success: true, message: stdout.trim() });
                        }
                    } catch (e) {
                        resolve({ success: true, message: stdout.trim() });
                    }
                } else {
                    log.error(`[FoundationalService] Script failed with code ${code}. Stderr: ${stderr}`);
                    reject(new Error(stderr || `Script exited with code ${code}`));
                }
            });
        });
    }
}

export const foundationalSkillService = new FoundationalSkillService();
