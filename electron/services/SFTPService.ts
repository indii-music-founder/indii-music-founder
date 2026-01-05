import Client from 'ssh2-sftp-client';
import path from 'path';

export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

// Local definition to avoid cross-project import issues in Electron main process
export class SFTPError extends Error {
    constructor(public code: string, message: string, public originalError?: any) {
        super(message);
        this.name = 'SFTPError';
    }
}

class SFTPService {
    private client: Client;
    private connected = false;

    constructor() {
        this.client = new Client();
    }

    async connect(config: SFTPConfig): Promise<void> {
        try {
            console.info(`[SFTPService] Connecting to ${config.host}:${config.port || 22}...`);
            await this.client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
            });
            this.connected = true;
            console.info('[SFTPService] Connected.');
        } catch (error: any) {
            console.error('[SFTPService] Connection failed:', error);
            throw new SFTPError('CONNECTION_FAILED', `Failed to connect to SFTP: ${error.message}`, error);
        }
    }

    async uploadDirectory(localPath: string, remotePath: string): Promise<string[]> {
        if (!this.connected) throw new SFTPError('NOT_CONNECTED', 'SFTP client not connected');

        console.info(`[SFTPService] Uploading directory: ${localPath} -> ${remotePath}`);
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

            console.info(`[SFTPService] Upload complete: ${remotePath}`);
            return uploadedFiles;
        } catch (error: any) {
            console.error(`[SFTPService] Upload failed:`, error);
            throw new SFTPError('UPLOAD_FAILED', `Failed to upload directory: ${error.message}`, error);
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
            console.info('[SFTPService] Disconnected.');
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

export const sftpService = new SFTPService();
