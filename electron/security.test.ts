import { describe, it, expect, vi } from 'vitest';
import { FetchUrlSchema, SftpUploadSchema } from './validation';
import { validateSender } from './utils/ipc-security';
import { validateSafeDistributionSource } from './utils/security-checks';

describe('Sentinel: IPC Validation Security', () => {
    describe('FetchUrlSchema (SSRF Protection)', () => {
        it('should accept valid public URLs', () => {
            const validUrls = [
                'https://google.com',
                'https://api.example.com/v1/data',
                'http://example.org',
                'https://www.w3.org'
            ];
            validUrls.forEach(url => {
                expect(() => FetchUrlSchema.parse(url)).not.toThrow();
            });
        });

        it('should reject invalid protocols', () => {
            const invalidProtocols = [
                'ftp://example.com',
                'file:///etc/passwd',
                'gopher://example.com',
                'javascript:alert(1)'
            ];
            invalidProtocols.forEach(url => {
                expect(() => FetchUrlSchema.parse(url)).toThrow();
            });
        });

        it('should reject localhost', () => {
            const localhostVariants = [
                'http://localhost',
                'https://localhost:8080',
                'http://local.localhost'
            ];
            localhostVariants.forEach(url => {
                expect(() => FetchUrlSchema.parse(url)).toThrow();
            });
        });

        it('should reject private IP addresses (IPv4)', () => {
            const privateIps = [
                'http://127.0.0.1',
                'http://127.0.1.1',
                'http://10.0.0.1',
                'http://192.168.1.1',
                'http://172.16.0.1',
                'http://169.254.169.254' // AWS Metadata
            ];
            privateIps.forEach(url => {
                expect(() => FetchUrlSchema.parse(url)).toThrow();
            });
        });

        it('should reject private IP addresses (IPv6)', () => {
            const privateIps = [
                'http://[::1]',
                'http://[::1]:8080',
                'http://[fc00::1]',
                'http://[fe80::1]'
            ];
            privateIps.forEach(url => {
                expect(() => FetchUrlSchema.parse(url)).toThrow();
            });
        });
    });

    describe('SftpUploadSchema (Path Traversal Protection)', () => {
        it('should accept valid relative paths', () => {
            const valid = {
                localPath: 'dist/build',
                remotePath: '/var/www/html'
            };
            expect(() => SftpUploadSchema.parse(valid)).not.toThrow();
        });

        it('should accept absolute paths (System Integrity)', () => {
             // We allow absolute paths because file dialogs return them.
             // We rely on ".." checks and Sender Validation for security.
             const validUnix = {
                localPath: '/Users/jules/project/dist',
                remotePath: '/var/www'
            };
            const validWin = {
                localPath: 'C:\\Users\\Jules\\Project\\Dist',
                remotePath: '/var/www'
            };
            expect(() => SftpUploadSchema.parse(validUnix)).not.toThrow();
            expect(() => SftpUploadSchema.parse(validWin)).not.toThrow();
        });

        it('should reject directory traversal in local path', () => {
            const invalid = {
                localPath: '../../ssh/keys',
                remotePath: '/var/www/html'
            };
            expect(() => SftpUploadSchema.parse(invalid)).toThrow();
        });

        it('should reject directory traversal in remote path', () => {
            const invalid = {
                localPath: 'dist',
                remotePath: '../../etc/init.d'
            };
            expect(() => SftpUploadSchema.parse(invalid)).toThrow();
        });
    });

    describe('validateSender (IPC Hijack Protection)', () => {
        const mockEvent = (url: string) => ({
            senderFrame: { url }
        } as any);

        it('should accept file:// URLs', () => {
            expect(() => validateSender(mockEvent('file:///app/index.html'))).not.toThrow();
        });

        it('should accept Dev Server URL', () => {
            process.env.VITE_DEV_SERVER_URL = 'http://localhost:4242';
            expect(() => validateSender(mockEvent('http://localhost:4242/'))).not.toThrow();
            delete process.env.VITE_DEV_SERVER_URL;
        });

        it('should reject external URLs', () => {
             expect(() => validateSender(mockEvent('https://malicious.com'))).toThrow('Security: Unauthorized sender URL');
        });

        it('should reject empty/undefined URLs', () => {
            expect(() => validateSender(mockEvent(''))).toThrow('Security: Missing sender URL');
            expect(() => validateSender({} as any)).toThrow('Security: Missing sender frame');
        });
    });

    describe('validateSafeDistributionSource (LFI Prevention)', () => {
        it('should accept valid media files', () => {
            const valid = [
                '/Users/artist/Music/song.wav',
                '/Users/artist/Downloads/cover.jpg',
                'C:\\Users\\Artist\\Documents\\lyrics.txt'
            ];
            valid.forEach(p => {
                expect(() => validateSafeDistributionSource(p)).not.toThrow();
            });
        });

        it('should reject system directories', () => {
            const invalid = [
                '/etc/passwd',
                '/var/log/syslog',
                '/usr/bin/bash',
                'C:\\Windows\\System32\\drivers\\etc\\hosts'
            ];
            invalid.forEach(p => {
                expect(() => validateSafeDistributionSource(p)).toThrow(/system directories/);
            });
        });

        it('should reject hidden files and directories', () => {
            const invalid = [
                '/Users/artist/.ssh/id_rsa',
                '/Users/artist/.config/app/secret.json',
                '/Users/artist/project/.env'
            ];
            invalid.forEach(p => {
                expect(() => validateSafeDistributionSource(p)).toThrow(/hidden files/);
            });
        });

        it('should reject prohibited extensions', () => {
            const invalid = [
                '/Users/artist/Music/song.exe',
                '/Users/artist/script.sh',
                '/Users/artist/config.yaml' // YAML not in allowlist
            ];
            invalid.forEach(p => {
                expect(() => validateSafeDistributionSource(p)).toThrow(/File type/);
            });
        });

        it('should reject path traversal attempts', () => {
             expect(() => validateSafeDistributionSource('../../../etc/passwd')).toThrow(/Path traversal/);
        });
    });
});
