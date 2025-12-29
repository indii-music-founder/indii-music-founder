import Client from 'ssh2-sftp-client';
import path from 'path';

export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

class SFTPService {
    private client: Client;
    private connected = false;

    constructor() {
        this.client = new Client();
    }

    async connect(config: SFTPConfig): Promise<void> {
        try {
            console.log(`[SFTPService] Connecting to ${config.host}:${config.port || 22}...`);
            await this.client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
            });
            this.connected = true;
            console.log('[SFTPService] Connected.');
        } catch (error) {
            console.error('[SFTPService] Connection failed:', error);
            throw error;
        }
    }

    async uploadDirectory(localPath: string, remotePath: string): Promise<string[]> {
        if (!this.connected) throw new Error('SFTP client not connected');

        console.log(`[SFTPService] Uploading directory: ${localPath} -> ${remotePath}`);
        const uploadedFiles: string[] = [];

        try {
            // Ensure remote directory exists
            const remoteExists = await this.client.exists(remotePath);
            if (!remoteExists) {
                await this.client.mkdir(remotePath, true);
            }

            // Upload directory contents
            await this.client.uploadDir(localPath, remotePath, {
                useFastput: true,
            });

            // List uploaded files
            const list = await this.client.list(remotePath);
            uploadedFiles.push(...list.map(item => item.name));

            console.log(`[SFTPService] Upload complete: ${remotePath}`);
            return uploadedFiles;
        } catch (error) {
            console.error(`[SFTPService] Upload failed:`, error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
            console.log('[SFTPService] Disconnected.');
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

export const sftpService = new SFTPService();
