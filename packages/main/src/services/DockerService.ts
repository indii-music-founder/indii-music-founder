import { exec } from 'child_process';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import util from 'util';

const execPromise = util.promisify(exec);

export class DockerService {
    private static getWorkingDir(): string {
        // docker-compose.yml is in the project root
        return app.isPackaged
            ? process.resourcesPath
            : process.cwd();
    }

    /**
     * Ensures all Docker services are running.
     * Maps to 'docker-compose up -d'
     */
    static async ensureStarted(): Promise<{ success: boolean; log?: string }> {
        const cwd = this.getWorkingDir();
        log.info(`[DockerService] Starting containers in ${cwd}...`);

        try {
            // We use --remove-orphans to keep the environment clean
            // Using 'docker compose' (v2 path-safe) instead of 'docker-compose'
            const { stdout, stderr } = await execPromise('docker compose up -d --remove-orphans', { cwd });
            log.info(`[DockerService] Startup Output: ${stdout}`);
            if (stderr) log.warn(`[DockerService] Startup Warnings: ${stderr}`);

            return { success: true, log: stdout };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`[DockerService] Startup Failed: ${msg}`);
            return { success: false, log: msg };
        }
    }

    /**
     * Restarts the entire AI stack.
     * Useful for troubleshooting and first-time setup model pulls.
     */
    static async restartSystem(): Promise<{ success: boolean; log?: string }> {
        const cwd = this.getWorkingDir();
        log.info(`[DockerService] Restarting AI system...`);

        try {
            await execPromise('docker compose down', { cwd });
            return await this.ensureStarted();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`[DockerService] Restart Failed: ${msg}`);
            return { success: false, log: msg };
        }
    }

    /**
     * Stops the containers gracefully.
     * Called on app quit.
     */
    static async stopSystem(): Promise<void> {
        const cwd = this.getWorkingDir();
        log.info(`[DockerService] Stopping AI containers...`);
        try {
            // We use 'stop' instead of 'down' to preserve container state but free up resources
            await execPromise('docker compose stop', { cwd });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`[DockerService] Stop Failed: ${msg}`);
        }
    }
}
