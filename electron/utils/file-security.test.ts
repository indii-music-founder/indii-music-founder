import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateSafeAudioPath } from './file-security';
import fs from 'fs';
import path from 'path';

// Mock fs to control realpathSync behavior without touching the disk
vi.mock('fs', async (importOriginal) => {
    const mod = await importOriginal() as any;
    return {
        ...mod,
        default: {
            ...mod.default,
            realpathSync: vi.fn(),
        },
        realpathSync: vi.fn(),
    };
});

describe('Shield 🛡️: Audio Path Validation Security', () => {

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should allow valid, safe audio files', () => {
        const safePath = '/Users/indii/Music/song.mp3';
        vi.mocked(fs.realpathSync).mockReturnValue(safePath);

        expect(validateSafeAudioPath(safePath)).toBe(safePath);
    });

    it('should BLOCK Path Traversal attempts resolving to system files', () => {
        // Attack: "../../../etc/passwd" -> resolves to "/etc/passwd"
        // Note: The function checks Extension BEFORE System Directory.
        // So "/etc/passwd" (no ext) fails on extension check.
        // To test System Directory check, we simulate a file with valid extension in system dir.

        const attackPath = '/Users/indii/Music/../../../etc/passwd.mp3';
        const resolvedPath = '/etc/passwd.mp3';

        vi.mocked(fs.realpathSync).mockReturnValue(resolvedPath);

        expect(() => validateSafeAudioPath(attackPath))
            .toThrow(/Security Violation: Access to system directory/);
    });

    it('should BLOCK Symlink Attacks pointing to sensitive files', () => {
        // Attack: "innocent_song.wav" -> symlink to "/etc/shadow"
        // Again, if /etc/shadow has no extension, it fails extension check first.
        // We test that it fails SECURELY.

        const innocentPath = '/Users/indii/Music/innocent_song.wav';
        const targetPath = '/etc/shadow';

        vi.mocked(fs.realpathSync).mockReturnValue(targetPath);

        expect(() => validateSafeAudioPath(innocentPath))
            .toThrow(/Security Violation: File type '' is not allowed/);

        // ALSO test a symlink to a file that HAS a valid extension but is in a system dir
        // e.g. /etc/config.mp3
        const targetSystemPath = '/etc/config.mp3';
        vi.mocked(fs.realpathSync).mockReturnValue(targetSystemPath);
        expect(() => validateSafeAudioPath(innocentPath))
             .toThrow(/Security Violation: Access to system directory/);
    });

    it('should BLOCK hidden files (dotfiles)', () => {
        // Attack: accessing SSH keys masquerading as audio or just hidden
        const hiddenPath = '/Users/indii/.ssh/id_rsa';

        vi.mocked(fs.realpathSync).mockReturnValue(hiddenPath);

        // Fails extension check first
        expect(() => validateSafeAudioPath(hiddenPath))
            .toThrow(/Security Violation: File type '' is not allowed/);

        // Test hidden file with valid extension
        const hiddenAudio = '/Users/indii/.hidden.mp3';
        vi.mocked(fs.realpathSync).mockReturnValue(hiddenAudio);
        expect(() => validateSafeAudioPath(hiddenAudio))
            .toThrow(/Security Violation: Access to hidden files/);
    });

    it('should BLOCK hidden directories', () => {
        const hiddenDirPath = '/Users/indii/.secret/song.mp3';
        vi.mocked(fs.realpathSync).mockReturnValue(hiddenDirPath);

        expect(() => validateSafeAudioPath(hiddenDirPath))
            .toThrow(/Security Violation: Access to hidden files/);
    });

    it('should BLOCK forbidden extensions (Spoofing)', () => {
        // Attack: "song.mp3.exe"
        const exePath = '/Users/indii/Music/song.mp3.exe';
        vi.mocked(fs.realpathSync).mockReturnValue(exePath);

        expect(() => validateSafeAudioPath(exePath))
            .toThrow(/Security Violation: File type '.exe' is not allowed/);
    });

    it('should BLOCK shell scripts', () => {
        const scriptPath = '/Users/indii/Music/malware.sh';
        vi.mocked(fs.realpathSync).mockReturnValue(scriptPath);

        expect(() => validateSafeAudioPath(scriptPath))
            .toThrow(/Security Violation: File type '.sh' is not allowed/);
    });

    it('should BLOCK non-existent files (Information Disclosure prevention)', () => {
        vi.mocked(fs.realpathSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });

        expect(() => validateSafeAudioPath('/does/not/exist.mp3'))
            .toThrow(/Security Violation: Invalid file path/);
    });

    it('should BLOCK System Roots', () => {
        // We use .mp3 extension to ensure we bypass extension check and hit system root check
        const roots = ['/bin/bash.mp3', '/usr/bin/python.mp3', '/var/log/syslog.mp3'];

        roots.forEach(root => {
            vi.mocked(fs.realpathSync).mockReturnValue(root);
            expect(() => validateSafeAudioPath(root))
                .toThrow(/Security Violation: Access to system directory/);
        });
    });

});
