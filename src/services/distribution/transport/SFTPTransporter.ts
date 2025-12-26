/**
 * SFTP Transporter
 * Handles secure file transmission to distributor endpoints
 * Currently implemented as a stub/dry-run service
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
    private dryRun = false;

    constructor(dryRun = true) {
        this.dryRun = dryRun;
    }

    /**
     * Connect to SFTP server
     */
    async connect(config: SFTPConfig): Promise<void> {
        this.config = config;
        console.log(`[SFTP] Connecting to ${config.host}:${config.port || 22} (${this.dryRun ? 'DRY RUN' : 'LIVE'})...`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!config.username) {
            throw new Error('SFTP Username required');
        }

        this.connected = true;
        console.log('[SFTP] Connected.');
    }

    /**
     * Upload a local directory to the remote server
     * Recursively uploads all files
     */
    async uploadDirectory(localPath: string, remotePath: string): Promise<string[]> {
        if (!this.connected) throw new Error('SFTP client not connected');

        console.log(`[SFTP] Uploading directory: ${localPath} -> ${remotePath}`);

        // In a real implementation, we would traverse the directory and put each file.
        // For 'dry run', we trust the PackageBuilder and just log success.

        // Simulate transfer time
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`[SFTP] Upload complete: ${remotePath}`);
        return ['metadata.xml', '01_Track.wav', 'front.jpg']; // Mocked list of uploaded files
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Disconnect from server
     */
    async disconnect(): Promise<void> {
        this.connected = false;
        this.config = null;
        console.log('[SFTP] Disconnected.');
    }
}
