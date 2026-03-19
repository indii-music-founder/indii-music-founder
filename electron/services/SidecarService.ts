/**
 * SidecarService.ts
 *
 * Manages the bundled Python agent sidecar as a child process.
 * Replaces DockerService for packaged desktop builds, eliminating the Docker
 * dependency so the app ships as a standalone DMG/exe/AppImage.
 *
 * Strategy:
 *   - Packaged app  → spawn the PyInstaller binary from app.getPath('resources')
 *   - Dev / Docker  → fall back to DockerService (zero changes to the dev loop)
 *
 * The sidecar binary listens on localhost:50080, identical to the Docker container.
 * The renderer's agent service requires no changes.
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import log from 'electron-log';
import { DockerService } from './DockerService';

// Name of the bundled binary (per-platform suffix added at runtime)
const BINARY_BASE = 'agent_sidecar';
const SIDECAR_PORT = 50080;
const STARTUP_TIMEOUT_MS = 30_000;
const STARTUP_POLL_INTERVAL_MS = 500;

export class SidecarService {
    private static child: ChildProcess | null = null;
    private static _usingBundled = false;

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Ensures the sidecar is running.
     * In a packaged app: spawns the bundled binary.
     * In dev: delegates to DockerService.
     */
    static async ensureStarted(): Promise<{ success: boolean; log?: string }> {
        if (!app.isPackaged) {
            log.info('[SidecarService] Dev mode — delegating to DockerService');
            return DockerService.ensureStarted();
        }

        if (this.child && this.child.exitCode === null) {
            log.info('[SidecarService] Sidecar already running');
            return { success: true };
        }

        return this._spawnBinary();
    }

    /**
     * Restarts the sidecar.
     * In dev: delegates to DockerService.
     */
    static async restartSystem(): Promise<{ success: boolean; log?: string }> {
        if (!app.isPackaged) {
            return DockerService.restartSystem();
        }
        await this.stopSystem();
        return this._spawnBinary();
    }

    /**
     * Stops the sidecar.
     * In dev: delegates to DockerService.
     */
    static async stopSystem(): Promise<void> {
        if (!app.isPackaged) {
            return DockerService.stopSystem();
        }
        if (this.child && this.child.exitCode === null) {
            log.info('[SidecarService] Stopping bundled sidecar…');
            this.child.kill('SIGTERM');
            // Give it a moment to shut down gracefully
            await new Promise<void>((resolve) => setTimeout(resolve, 1500));
            if (this.child.exitCode === null) {
                this.child.kill('SIGKILL');
            }
            this.child = null;
        }
    }

    /** True when running the bundled binary (not Docker). */
    static get usingBundled(): boolean {
        return this._usingBundled;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static _resolveBinaryPath(): string {
        // In a packaged app, extraResources land at:
        //   macOS:   <app>.app/Contents/Resources/sidecar/
        //   Windows: resources/sidecar/
        //   Linux:   resources/sidecar/
        const binaryName =
            process.platform === 'win32'
                ? `${BINARY_BASE}.exe`
                : BINARY_BASE;

        return path.join(
            process.resourcesPath,
            'sidecar',
            binaryName
        );
    }

    private static async _spawnBinary(): Promise<{ success: boolean; log?: string }> {
        const binaryPath = this._resolveBinaryPath();
        log.info(`[SidecarService] Spawning bundled sidecar: ${binaryPath}`);

        try {
            const child = spawn(binaryPath, ['--port', String(SIDECAR_PORT)], {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    INDII_SIDECAR: '1',
                },
            });

            child.stdout?.on('data', (data: Buffer) => {
                log.info(`[Sidecar] ${data.toString().trim()}`);
            });
            child.stderr?.on('data', (data: Buffer) => {
                log.warn(`[Sidecar:err] ${data.toString().trim()}`);
            });
            child.on('exit', (code, signal) => {
                log.info(`[SidecarService] Process exited — code=${code} signal=${signal}`);
                this.child = null;
            });
            child.on('error', (err) => {
                log.error(`[SidecarService] Spawn error: ${err.message}`);
                this.child = null;
            });

            this.child = child;

            // Wait for the HTTP server to come up
            const ready = await this._waitForHealth(STARTUP_TIMEOUT_MS, STARTUP_POLL_INTERVAL_MS);
            if (!ready) {
                child.kill();
                this.child = null;
                return { success: false, log: 'Sidecar did not become healthy within timeout' };
            }

            this._usingBundled = true;
            log.info('[SidecarService] Bundled sidecar is healthy');
            return { success: true };
        } catch (error: any) {
            log.error(`[SidecarService] Failed to spawn: ${error.message}`);
            return { success: false, log: error.message };
        }
    }

    private static async _waitForHealth(
        timeoutMs: number,
        intervalMs: number
    ): Promise<boolean> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`http://localhost:${SIDECAR_PORT}/health`);
                if (res.ok) return true;
            } catch {
                // Not ready yet
            }
            await new Promise((r) => setTimeout(r, intervalMs));
        }
        return false;
    }
}
