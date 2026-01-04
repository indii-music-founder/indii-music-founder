/**
 * SFTP Transporter
 * Handles secure file transmission to distributor endpoints via Electron IPC
 */

export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

export class SFTPTransporter {
    private connected = false;
    private config: SFTPConfig | null = null;

    constructor(private dryRun: boolean = false) {
    }

    /**
     * Connect to SFTP server
     */
    async connect(config: SFTPConfig): Promise<void> {
        this.config = config;
        if (this.dryRun) {
            console.info('[SFTP] Dry run connected.');
            this.connected = true;
            return;
        }

        try {
            console.info(`[SFTP] Connecting to ${config.host}:${config.port || 22}...`);
            // Use Electron Bridge
            if (window.electronAPI?.sftp) {
                await window.electronAPI.sftp.connect(config);
                this.connected = true;
                console.info('[SFTP] Connected via Electron.');
            } else {
                throw new Error('SFTP not available in this environment');
            }
        } catch (error) {
            console.error('[SFTP] Connection failed:', error);
            throw error;
        }
    }

    /**
     * Upload a local directory to the remote server
     * Recursively uploads all files
     */
    async uploadDirectory(localPath: string, remotePath: string): Promise<string[]> {
        if (!this.connected) throw new Error('SFTP client not connected');

        console.info(`[SFTP] Uploading directory: ${localPath} -> ${remotePath}`);

        if (this.dryRun) {
            console.info('[SFTP] Dry run upload complete.');
            return ['dry_run_file_1.xml', 'dry_run_file_2.mp3'];
        }

        try {
            if (window.electronAPI?.sftp) {
                const result = await window.electronAPI.sftp.uploadDirectory(localPath, remotePath);
                if (result.success && result.files) {
                    console.info(`[SFTP] Upload complete: ${remotePath}`);
                    return result.files;
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            }
            throw new Error('SFTP not available in this environment');
        } catch (error) {
            console.error(`[SFTP] Upload failed:`, error);
            throw error;
        }
    }

    /**
     * Check if connected
     */
    async isConnected(): Promise<boolean> { // Changed to async to match IPC
        if (this.dryRun) return this.connected;
        if (window.electronAPI?.sftp) {
            return await window.electronAPI.sftp.isConnected();
        }
        return false;
    }

    /**
     * Disconnect from server
     */
    async disconnect(): Promise<void> {
        if (this.connected) {
            if (!this.dryRun && window.electronAPI?.sftp) {
                await window.electronAPI.sftp.disconnect();
            }
            this.connected = false;
            this.config = null;
            console.info('[SFTP] Disconnected.');
        }
    }
}
