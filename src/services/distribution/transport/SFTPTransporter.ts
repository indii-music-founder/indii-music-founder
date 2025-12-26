/**
 * SFTP Transporter
 * Handles secure file transmission to distributor endpoints
 */

import Client from 'ssh2-sftp-client';
import path from 'path';
import fs from 'fs';

export interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

export class SFTPTransporter {
    private client: Client;
    private connected = false;
    private config: SFTPConfig | null = null;

    constructor(private dryRun: boolean = false) {
        this.client = new Client();
    }

    /**
     * Connect to SFTP server
     */
    async connect(config: SFTPConfig): Promise<void> {
        this.config = config;
        try {
            console.log(`[SFTP] Connecting to ${config.host}:${config.port || 22}...`);
            await this.client.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
            });
            this.connected = true;
            console.log('[SFTP] Connected.');
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

        console.log(`[SFTP] Uploading directory: ${localPath} -> ${remotePath}`);
        const uploadedFiles: string[] = [];

        try {
            // Ensure remote directory exists
            const remoteExists = await this.client.exists(remotePath);
            if (!remoteExists) {
                await this.client.mkdir(remotePath, true);
            }

            // Upload directory contents
            await this.client.uploadDir(localPath, remotePath, {
                useFastput: true, // Use fastput for better performance
            });

            // List uploaded files (simplification, reliable way to know what was uploaded)
            const list = await this.client.list(remotePath);
            uploadedFiles.push(...list.map(item => item.name));

            console.log(`[SFTP] Upload complete: ${remotePath}`);
            return uploadedFiles;
        } catch (error) {
            console.error(`[SFTP] Upload failed:`, error);
            throw error;
        }
    }

    /**
     * Check if connected
     * Note: ssh2-sftp-client doesn't have a direct 'isConnected' property exposed easily 
     * without side effects, but we can track our own state.
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Disconnect from server
     */
    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
            this.config = null;
            console.log('[SFTP] Disconnected.');
        }
    }
}
