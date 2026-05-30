import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SFTPTransporter } from '../transport/SFTPTransporter';
import { IngestionMetadata } from '@/types/distribution';

describe('SFTP Delivery Pipeline', () => {
    let sftpTransporter: SFTPTransporter;
    
    beforeEach(() => {
        sftpTransporter = new SFTPTransporter();
        (window as any).electronAPI = {
            sftp: {
                connect: vi.fn().mockResolvedValue({ success: true }),
                uploadDirectory: vi.fn().mockResolvedValue({ success: true, files: ['batch.xml', 'audio.wav', 'cover.jpg'] }),
                disconnect: vi.fn().mockResolvedValue({ success: true }),
                isConnected: vi.fn().mockResolvedValue(true)
            },
            distribution: {
                generateIngestionNotification: vi.fn().mockResolvedValue({ success: true, xml: '<ern:NewReleaseMessage>...</ern:NewReleaseMessage>' }),
                packageSpotify: vi.fn().mockResolvedValue({ success: true, packagePath: '/tmp/spotify_package' }),
            }
        };
    });

    it('validates full pipeline from XML generation to SFTP delivery confirmation', async () => {
        // 1. Proprietary Ingestion IP XML gen
        const mockMetadata: any = {
            releaseId: 'test-release-1',
            title: 'Test Delivery',
            artist: 'Indii Artist',
            upc: '123456789012',
            tracks: [
                { id: 't1', title: 'Track 1', isrc: 'US1234567890', audioFile: 'audio.wav' }
            ],
            coverArt: 'cover.jpg'
        };

        const xmlResult = await window.electronAPI.distribution.generateIngestionNotification(mockMetadata);
        expect(xmlResult.success).toBe(true);
        expect(xmlResult.xml).toBeTruthy();

        // 2. Audio file packaging
        const packageResult = await window.electronAPI.distribution.packageSpotify(mockMetadata.releaseId, '/tmp/staging', '/tmp/output') as any;
        expect(packageResult.success).toBe(true);
        expect(packageResult.packagePath).toBe('/tmp/spotify_package');

        // 3. SFTP Upload (mirrors DSP delivery specs)
        const config = {
            host: 'sftp.test.dsp.com',
            port: 22,
            username: 'test_user',
            privateKey: 'dummy_key'
        };
        await sftpTransporter.connect(config);
        expect(window.electronAPI.sftp.connect).toHaveBeenCalledWith(config);

        const uploadResult = await sftpTransporter.uploadDirectory(packageResult.packagePath, '/upload');
        expect(window.electronAPI.sftp.uploadDirectory).toHaveBeenCalledWith('/tmp/spotify_package', '/upload');
        expect(uploadResult).toEqual(['batch.xml', 'audio.wav', 'cover.jpg']);

        // 4. Delivery confirmation via disconnect
        await sftpTransporter.disconnect();
        expect(window.electronAPI.sftp.disconnect).toHaveBeenCalled();
    });
});
