import Client from 'ssh2-sftp-client';
export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

// Local definition to avoid cross-project import issues in Electron main process
export class SFTPError extends Error {
    constructor(public code: string, message: string, public originalError?: unknown) {
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
            console.log('[SFTPService] Connecting to SFTP host:', config.host);
            await this.client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
            });
            this.connected = true;
            console.log('[SFTPService] SFTP connection established successfully.');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[SFTPService] SFTP connection failed:', msg);
            throw new SFTPError('CONNECTION_FAILED', `Failed to connect to SFTP: ${msg}`, error);
        }
    }

    async uploadDirectory(localPath: string, remotePath: string): Promise<string[]> {
        if (!this.connected) throw new SFTPError('NOT_CONNECTED', 'SFTP client not connected');

        console.log(`[SFTPService] Beginning directory upload from ${localPath} to ${remotePath}...`);
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

            void 0;
            return uploadedFiles;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            void 0;
            throw new SFTPError('UPLOAD_FAILED', `Failed to upload directory: ${msg}`, error);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async listDirectory(remotePath: string): Promise<any[]> {
        if (!this.connected) throw new SFTPError('NOT_CONNECTED', 'SFTP client not connected');
        try {
            return await this.client.list(remotePath);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new SFTPError('LIST_FAILED', `Failed to list directory: ${msg}`, error);
        }
    }

    async readFile(remotePath: string): Promise<string> {
        if (!this.connected) throw new SFTPError('NOT_CONNECTED', 'SFTP client not connected');
        try {
            const buffer = await this.client.get(remotePath);
            return buffer.toString('utf8');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new SFTPError('READ_FAILED', `Failed to read file: ${msg}`, error);
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
            void 0;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

export const sftpService = new SFTPService();
