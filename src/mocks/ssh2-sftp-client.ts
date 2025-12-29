/**
 * Mock for ssh2-sftp-client to allow browser builds (Vite) to pass.
 * This class should match the public interface used by SFTPTransporter.
 */

export default class Client {
    async connect(config: any): Promise<void> {
        console.warn('[SFTP Mock] Connect called (not supported in browser)', config);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 100));
        // Throw an error because we can't actually connect in the browser
        throw new Error('SFTP is not supported in the browser environment.');
    }

    async exists(remotePath: string): Promise<boolean | string> {
        console.warn('[SFTP Mock] Exists check', remotePath);
        return false;
    }

    async mkdir(remotePath: string, recursive: boolean = false): Promise<string> {
        console.warn('[SFTP Mock] Mkdir', remotePath);
        return remotePath;
    }

    async uploadDir(localPath: string, remotePath: string, options?: any): Promise<string> {
        console.warn('[SFTP Mock] UploadDir', localPath, '->', remotePath);
        return 'Mock upload complete';
    }

    async list(remotePath: string): Promise<any[]> {
        console.warn('[SFTP Mock] List', remotePath);
        return [];
    }

    async end(): Promise<void> {
        console.log('[SFTP Mock] End connection');
    }
}
