import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSafeDistributionSource } from './security-checks';

// Mock fs
const mocks = vi.hoisted(() => ({
    fs: {
        realpathSync: vi.fn(),
    }
}));

vi.mock('fs', () => ({
    default: {
        ...mocks.fs
    },
    realpathSync: mocks.fs.realpathSync
}));

describe('🛡️ Security Checks Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow safe files', () => {
        mocks.fs.realpathSync.mockReturnValue('/Users/alice/music/track.wav');
        expect(() => validateSafeDistributionSource('/Users/alice/music/track.wav')).not.toThrow();
    });

    it('should block symlinks to system files (LFI Protection)', () => {
        // Input path looks safe and has valid extension
        const inputPath = '/Users/alice/music/safe_song.wav';

        // But simulates a symlink resolving to a system file
        mocks.fs.realpathSync.mockReturnValue('/etc/passwd');

        // Should throw due to system root check on RESOLVED path
        expect(() => validateSafeDistributionSource(inputPath)).toThrow(/Security Violation/);
    });

    it('should block resolved path with invalid extension', () => {
        // Input path has valid extension
        const inputPath = '/Users/alice/music/song.wav';

        // Resolves to file with invalid extension (e.g., symlink to script)
        mocks.fs.realpathSync.mockReturnValue('/Users/alice/music/script.sh');

        expect(() => validateSafeDistributionSource(inputPath)).toThrow(/File type '\.sh' is not allowed/);
    });

    it('should block system directories even if resolved path has valid extension', () => {
         // e.g. /etc/config.json (valid extension .json)
         mocks.fs.realpathSync.mockReturnValue('/etc/config.json');
         expect(() => validateSafeDistributionSource('/Users/alice/config.json')).toThrow(/Access to system directories is denied/);
    });

    it('should block private keys by default but allow them with option', () => {
        mocks.fs.realpathSync.mockReturnValue('/Users/alice/secrets/private.pem');

        // Default: Block
        expect(() => validateSafeDistributionSource('/Users/alice/secrets/private.pem')).toThrow(/File type '\.pem' is not allowed/);

        // With Option: Allow
        expect(() => validateSafeDistributionSource('/Users/alice/secrets/private.pem', { allowKeys: true })).not.toThrow();
    });
});
